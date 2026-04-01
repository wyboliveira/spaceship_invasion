/**
 * main.js — Orquestrador central
 *
 * Responsabilidades únicas deste arquivo:
 *   1. Inicializar e conectar as camadas (FSM, EventBus, localStore, I/O)
 *   2. Executar o game loop (requestAnimationFrame)
 *   3. Montar e desmontar overlays de UI em resposta a eventos da FSM
 *   4. Escutar onAuthStateChanged (Firebase) e atualizar estado de auth
 *
 * O que NÃO vive mais aqui:
 *   - Decisão de qual tela mostrar   →  GameFSM.js
 *   - Cache de progresso do jogador  →  lib/localStore.js
 *   - Chamadas diretas ao Firebase   →  api/auth.js (somente no SYNC RECORDS)
 */

import { state, updateState }            from './game/state.js';
import { PHYSICS, VISUAL, getWaveConfig } from './game/config.js';
import { initInput, keys }               from './game/input.js';
import { createEnemies, createShields }  from './game/helpers.js';
import { update }                        from './game/update.js';
import {
  drawPlayer, drawEnemy,
  drawPlayerBullet, drawEnemyBullet,
  drawShieldBlock, drawDrop,
  drawWeaponIndicator, drawBoss,
} from './game/sprites.js';
import { updateHUD, initUsernameEdit }   from './ui/hud.js';
import { 
  hideOverlay,
  showScreen, hideAllScreens, 
  showModal, hideModal 
} from './ui/overlay.js';
// auth     → instância do Firebase Authentication (gerencia sessão e tokens)
// onAuthStateChanged → observer que dispara sempre que o estado de login muda
//   Equivalente ao supabase.auth.onAuthStateChange do Supabase.
//   A diferença: recebe um User (ou null), não um { event, session }.
import { auth }                          from './lib/firebase.js';
import { onAuthStateChanged }            from 'firebase/auth';
import {
  signInWithGoogle, signInWithGithub, signOut,
  getUserProfile, createProfile, persistScore, updateUsername,
  getLeaderboard, pingDatabase,
} from './api/auth.js';
import {
  saveLocalProgress, loadLocalProgress,
  seedFromDatabase, markSynced, clearLocalProgress,
  updateLocalUsername,
} from './lib/localStore.js';
import { EventBus }     from './core/EventBus.js';
import { GameFSM }      from './core/GameFSM.js';
import { AudioManager } from './audio/AudioManager.js';

// ─────────────────────────────────────────────────────────────
// Canvas
// ─────────────────────────────────────────────────────────────
const gameCanvas = document.getElementById('gameCanvas');
const bgCanvas   = document.getElementById('bgCanvas');
const ctx  = gameCanvas.getContext('2d');
const bCtx = bgCanvas.getContext('2d');
const W = PHYSICS.CANVAS_W;
const H = PHYSICS.CANVAS_H;

// ─────────────────────────────────────────────────────────────
// Fundo estrelado
// ─────────────────────────────────────────────────────────────
const stars = Array.from({ length: VISUAL.STAR_COUNT }, () => ({
  x:  Math.random() * W,
  y:  Math.random() * H,
  r:  Math.random() * 1.3 + 0.3,
  s:  Math.random() * 0.4 + 0.1,
  op: Math.random(),
}));

function tickStars() {
  bCtx.clearRect(0, 0, W, H);
  for (const s of stars) {
    s.op += s.s * 0.018;
    if (s.op > 1) s.op = 0;
    bCtx.beginPath();
    bCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    bCtx.fillStyle = `rgba(${VISUAL.COLOR_STAR_BASE},${s.op * 0.75})`;
    bCtx.fill();
  }
}
setInterval(tickStars, 60);

// ─────────────────────────────────────────────────────────────
// Wave — inicialização
// ─────────────────────────────────────────────────────────────

/** Wave em que o jogador morreu — usada pelo botão "Tentar Novamente". */
let _deathWave = 1;

function initWave(waveNumber, livesCarryOver, weaponLevelCarryOver) {
  const cfg = getWaveConfig(waveNumber);
  updateState({
    cfg,
    wave:        waveNumber,
    lives:       livesCarryOver     !== undefined ? livesCarryOver     : cfg.playerLives,
    weaponLevel: weaponLevelCarryOver !== undefined ? weaponLevelCarryOver : 1,
    player: {
      x: W / 2 - PHYSICS.PLAYER_W / 2,
      y: H - PHYSICS.PLAYER_Y_OFFSET,
      w: PHYSICS.PLAYER_W,
      h: PHYSICS.PLAYER_H,
    },
    bullets:   [], eBullets:  [], drops:     [],
    enemies:   createEnemies(cfg),
    shields:   createShields(cfg),
    particles: [],
    enemyDir:       1,
    enemyMoveTimer: 0,
    enemyFireTimer: 0,
    frame:          0,
    flashTimer:     0,
    lastFire:       0,
    paused:         false,
    over:           false,
    isBossDebugRun: false,
    postWaveMagnet: false,
    boss: {
      active: false, introAnim: false, hp: 0, maxHp: 0,
      x: 0, y: 0, side: 'left', shield: 0,
      flashTimer: 0, neon: false,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H);

  if (state.flashTimer > 0) {
    ctx.fillStyle = `rgba(255,0,60,${0.18 * (state.flashTimer / VISUAL.HIT_FLASH_DURATION)})`;
    ctx.fillRect(0, 0, W, H);
  }

  for (const sh of state.shields) {
    for (const bl of sh.blocks) {
      if (bl.hp <= 0) continue;
      drawShieldBlock(
        ctx,
        sh.x + bl.c * PHYSICS.SHIELD_BLOCK_SZ,
        sh.y + bl.r * PHYSICS.SHIELD_BLOCK_SZ,
        bl.hp,
      );
    }
  }

  for (const e of state.enemies) {
    if (e.alive) drawEnemy(ctx, e.x, e.y, e.row, e.hp, e.maxHp, state.frame, e.elite);
  }

  if (state.boss.active) drawBoss(ctx, state.boss, state.frame, state.wave);
  if (!state.over)       drawPlayer(ctx, state.player.x, state.player.y);

  for (const b of state.bullets)  drawPlayerBullet(ctx, b.x, b.y, b.angled);
  for (const b of state.eBullets) drawEnemyBullet(ctx, b.x, b.y);
  for (const drop of state.drops) drawDrop(ctx, drop);

  for (const p of state.particles) {
    ctx.globalAlpha = p.life;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 5;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;

  if (state.weaponLevel > 1) drawWeaponIndicator(ctx, state.weaponLevel, W, H);

  if (state.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = VISUAL.COLOR_PLAYER;
    ctx.font      = "bold 13px 'Orbitron',monospace";
    ctx.textAlign = 'center';
    ctx.fillText('— PAUSED —', W / 2, H / 2);
    ctx.textAlign = 'left';
  }
}

// ─────────────────────────────────────────────────────────────
// Game Loop
// ─────────────────────────────────────────────────────────────
let _animId = null;

function gameLoop(ts) {
  if (state.paused || state.over) return;
  const dt = Math.min(ts - (state._lastTs || ts), 50);
  updateState({ _lastTs: ts, frame: state.frame + 1 });
  update(dt, ts);
  render();
  _animId = requestAnimationFrame(gameLoop);
}

function startLoop() {
  cancelAnimationFrame(_animId);
  updateState({ _lastTs: performance.now() });
  _animId = requestAnimationFrame(gameLoop);
}

function stopLoop() {
  cancelAnimationFrame(_animId);
}

// ─────────────────────────────────────────────────────────────
// Sync helper — salva progresso no localStorage (sem rede)
// ─────────────────────────────────────────────────────────────

/**
 * Salva score e wave no localStorage imediatamente, sem chamada de rede.
 * O dado ficará marcado como pendingSync = true até o usuário clicar SYNC RECORDS.
 */
function _saveLocalScore(context) {
  if (!state.session || state.wave <= 0) return;
  const updated = saveLocalProgress(state.session.user.id, state.score, state.wave);
  updateState({ userProfile: { ...updated, role: state.userProfile?.role || updated.role }, syncError: null });
  console.log(`[LocalStore] Score salvo localmente (${context}): score=${state.score} wave=${state.wave}`);
}

// ─────────────────────────────────────────────────────────────
// EventBus — Listeners de Jogo
// ─────────────────────────────────────────────────────────────
EventBus.on('GAME_OVER',           () => GameUI.triggerGameOver());
EventBus.on('GAME_WAVE_CLEAR',     () => GameUI.showWaveClear());
EventBus.on('GAME_UPDATE_HUD',     () => updateHUD());
EventBus.on('INPUT_TOGGLE_PAUSE',  () => GameUI.togglePause());
EventBus.on('INPUT_REQUEST_RESTART', () => {
    GameUI.showConfirm('DESEJA REINICIAR A PARTIDA? (O PROGRESSO ATUAL SERÁ SALVO)', () => {
        Game.backToMenu();
    });
});
EventBus.on('GAME_BOSS_TEST_COMPLETE', (wave) => GameUI.showBossTestComplete(wave));

const GameUI = {
  /**
   * Chamado por update.js quando o jogador perde todas as vidas
   * ou os inimigos alcançam a linha do jogador.
   * Transição: PLAYING → GAME_OVER (score salvo localmente, sem espera de rede)
   */
  triggerGameOver() {
    _deathWave = state.wave;
    updateState({ over: true, particles: [] });
    stopLoop();
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    _saveLocalScore('GameOver');
    GameFSM.transition('GAME_OVER');
  },

  /**
   * Chamado por update.js quando todos os inimigos foram eliminados
   * e não há boss nesta wave.
   * Transição: PLAYING → WAVE_END (score salvo localmente, sem espera de rede)
   */
  showWaveClear() {
    updateState({ over: true, particles: [] });
    stopLoop();
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
    _saveLocalScore('WaveClear');
    GameFSM.transition('WAVE_END');
  },

  /**
   * Chamado por update.js após derrotar o boss no modo debug.
   * Não sincroniza score — retorna ao menu após contagem regressiva.
   */
  showBossTestComplete(wave) {
    updateState({ over: true });
    stopLoop();
    
    const container = document.getElementById('screen-overlay');
    if (container) {
      container.innerHTML = `
        <div class="overlay-title" style="color:#00ffcc; font-size:28px;">TESTE DE CHEFÃO W${wave} OK</div>
        <div class="overlay-sub" style="color:#aaa; margin-top:10px;">
          Boss derrotado com sucesso!<br>Retornando ao menu em <span id="countdown">5</span>s...
        </div>
      `;
      container.classList.remove('hidden');
    }
    
    let secs = 5;
    const tick = setInterval(() => {
      secs--;
      const el = document.getElementById('countdown');
      if (el) el.textContent = secs;
      if (secs <= 0) { clearInterval(tick); Game.backToMenu(); }
    }, 1000);
  },

  togglePause() {
    if (state.over) return;
    const paused = !state.paused;
    updateState({ paused });
    const indicator = document.getElementById('pauseIndicator');
    if (paused) {
      indicator.classList.remove('hidden');
      GameFSM.transition('PAUSED');
    } else {
      indicator.classList.add('hidden');
      updateState({ _lastTs: performance.now() });
      GameFSM.transition('PLAYING');
      requestAnimationFrame(gameLoop);
    }
  },

  /**
   * Exibe um diálogo de confirmação genérico.
   * @param {string}   message  — HTML aceito
   * @param {Function} onOk     — callback executado ao confirmar
   * @param {Function} [onCancel] — callback opcional ao cancelar
   */
  showConfirm(message, onOk, onCancel) {
    const wasPlaying = !state.over && !state.paused;
    if (wasPlaying) this.togglePause();

    const okBtn     = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    // Reset botões para estado padrão (evita "ZERANDO..." de cliques anteriores)
    if (okBtn) {
      okBtn.disabled = false;
      okBtn.textContent = 'OK';
    }

    let _navHandler = null;
    document.getElementById('confirmText').innerHTML = message;
    showModal('modal-confirm');

    setTimeout(() => okBtn?.focus(), 10);

    _navHandler = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        (document.activeElement === okBtn ? cancelBtn : okBtn).focus();
        e.preventDefault();
      }
      if (e.key === 'Escape') cancelBtn.click();
    };
    window.addEventListener('keydown', _navHandler);

    const cleanup = () => {
      window.removeEventListener('keydown', _navHandler);
      _navHandler = null;
    };

    okBtn.onclick = async () => {
      // Executa o callback ANTES de fechar o modal, permitindo mostrar progresso (ex: "SAINDO...")
      if (onOk) await onOk();
      
      cleanup();
      hideModal('modal-confirm');
    };

    cancelBtn.onclick = () => {
      cleanup();
      hideModal('modal-confirm');
      if (onCancel) {
        onCancel();
      } else if (wasPlaying) {
        this.togglePause();
      }
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Handlers da FSM — reagem a transições de estado
// ─────────────────────────────────────────────────────────────

/** WAVE_END: mostra resultado da wave e botão para a próxima. */
EventBus.on('FSM_WAVE_END', () => {
  const next = state.wave + 1;
  setTimeout(() => {
    document.getElementById('waveBonusVal').textContent = (state.cfg?.bonusPoints || 0).toLocaleString();
    document.getElementById('waveScoreVal').textContent = String(state.score).padStart(6, '0');
    document.getElementById('nextWaveBtn').textContent = `WAVE ${String(next).padStart(2, '0')} →`;
    
    showScreen('screen-wave-end');

    document.getElementById('nextWaveBtn').onclick = () => {
      hideOverlay();
      Game.nextWave();
    };
  }, 300);
});

/** GAME_OVER: mostra resultado e opções de ação. */
EventBus.on('FSM_GAME_OVER', () => {
  setTimeout(() => {
    document.getElementById('finalScoreVal').textContent = String(state.score).padStart(6, '0');
    document.getElementById('finalWaveVal').textContent  = String(state.wave).padStart(2, '0');
    
    showScreen('screen-game-over');

    const restartBtn = document.getElementById('restartBtn');
    const menuBtn    = document.getElementById('backToMenuBtn');

    setTimeout(() => { if (restartBtn) restartBtn.focus(); }, 10);

    const navHandler = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        (document.activeElement === restartBtn ? menuBtn : restartBtn).focus();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', navHandler);

    restartBtn.onclick = () => {
      window.removeEventListener('keydown', navHandler);
      Game.retry();
    };
    menuBtn.onclick = () => {
      window.removeEventListener('keydown', navHandler);
      Game.backToMenu();
    };
  }, 300);
});

/** PLAYING: garante que a interface de menu/overlay suma. */
EventBus.on('FSM_PLAYING', () => {
  hideAllScreens();
  hideOverlay();
});

/** MENU: monta a tela inicial com dados de auth atuais. */
EventBus.on('FSM_MENU', () => {
  updateState({ score: 0, wave: 0 });
  _renderMenu();
});

// ─────────────────────────────────────────────────────────────
// Menu — renderização
// ─────────────────────────────────────────────────────────────
function _renderMenu() {
  updateHUD();
  document.getElementById('pauseIndicator')?.classList.add('hidden');

  const username = state.session
    ? (state.userProfile?.username || state.session.user.email.split('@')[0])
    : 'GUEST';

  const guestEl = document.getElementById('auth-guest');
  const loggedEl = document.getElementById('auth-logged');

  if (state.session) {
    guestEl.classList.add('hidden');
    loggedEl.classList.remove('hidden');
    document.getElementById('userNickname').textContent = `USER: ${username.toUpperCase()}`;

    const local = loadLocalProgress(state.session.user.id) || state.userProfile || {};
    document.getElementById('maxScoreVal').textContent  = local.max_score  || 0;
    document.getElementById('maxWaveVal').textContent   = local.max_wave   || 0;
    document.getElementById('lastScoreVal').textContent = local.last_score || 0;
    document.getElementById('lastWaveVal').textContent  = local.last_wave  || 0;

    // Exibe o status de sincronização
    const syncStatusEl = document.getElementById('syncStatusText');
    if (syncStatusEl) {
      if (local.lastSyncedAt) {
        const d = new Date(local.lastSyncedAt);
        const dateStr = d.toLocaleDateString('pt-BR');
        const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        syncStatusEl.textContent = `LAST SYNC: ${dateStr} ${timeStr}`;
        syncStatusEl.style.color = local.pendingSync ? '#FFD700' : '#555';
      } else {
        syncStatusEl.textContent = 'NUNCA SINCRONIZADO';
        syncStatusEl.style.color = '#ff4444';
      }
    }

    // Ajusta a cor do botão de acordo com se há dados pendentes
    const syncBtn = document.getElementById('syncRecordsBtn');
    if (syncBtn) {
      syncBtn.disabled  = false;
      syncBtn.textContent = 'SYNC RECORDS';
      if (local.pendingSync) {
        syncBtn.style.borderColor = '#FFD700';
        syncBtn.style.color       = '#FFD700';
      } else {
        syncBtn.style.borderColor = '#00ff88';
        syncBtn.style.color       = '#00ff88';
      }
    }
  } else {
    guestEl.classList.remove('hidden');
    loggedEl.classList.add('hidden');
  }

  // Boss Debug — exclusivo para role=admin
  const bossDebugEl = document.getElementById('bossDebug');
  const isAdmin = state.userProfile?.role === 'admin';
  if (bossDebugEl) {
    if (isAdmin) {
      bossDebugEl.classList.remove('hidden');
      const bossDebugContainer = document.getElementById('bossDebugContainer');
      if (bossDebugContainer) {
        bossDebugContainer.innerHTML = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(w => `
          <button class="debug-btn" onclick="Game.jumpToBoss(${w})"
            style="background:#222; color:#aaa; border:1px solid #444; padding:3px 6px; cursor:pointer; font-size:10px;">W${w}</button>
        `).join('');
      }
    } else {
      bossDebugEl.classList.add('hidden');
    }
  }

  showScreen('screen-menu');

  document.getElementById('startBtn').onclick = () => Game.start();

  if (state.session) {
    document.getElementById('logoutBtn').onclick = (e) => {
      e.stopPropagation();
      GameUI.showConfirm('DESEJA REALMENTE SAIR?', async () => {
        // Limpa o estado local e re-renderiza o menu como GUEST imediatamente.
        // O signOut (rede) é fire-and-forget — a UI não fica esperando.
        updateState({ session: null, userProfile: null });
        _renderMenu();
        signOut().catch(err => console.warn('[Auth] Falha ignorada no signOut:', err));
      });
    };

    document.getElementById('clearHistoryBtn').onclick = (e) => {
      e.stopPropagation();
      GameUI.showConfirm(
        'TEM CERTEZA QUE DESEJA ZERAR OS DADOS?<br>NÃO HAVERÁ COMO RECUPERAR O REGISTRO',
        async () => {
          // Zera o localStorage local e re-renderiza com zeros imediatamente.
          // O banco será zerado quando o usuário clicar em SYNC RECORDS.
          const cleared = clearLocalProgress(state.session.user.id);
          updateState({ userProfile: { ...cleared, role: state.userProfile?.role || cleared.role }, syncError: null });
          _renderMenu();
        },
      );
    };

    document.getElementById('syncRecordsBtn').onclick = async () => {
      const btn      = document.getElementById('syncRecordsBtn');
      const statusEl = document.getElementById('syncStatusText');
      const userId   = state.session?.user?.id;
      if (!userId) return;

      const localData = loadLocalProgress(userId);

      btn.disabled    = true;
      btn.textContent = 'SINCRONIZANDO...';
      if (statusEl) { statusEl.textContent = 'CONECTANDO AO BANCO...'; statusEl.style.color = '#aaa'; }

      try {
        await _lbWithRetry(
          () => persistScore(userId, localData?.last_score || 0, localData?.last_wave || 0, localData),
          12000,
        );
        const updated = markSynced();
        updateState({ userProfile: { ...updated, role: state.userProfile?.role || updated.role }, syncError: null });
        _renderMenu(); // re-renderiza com novo timestamp
      } catch (err) {
        console.error('[Sync] Falha no SYNC RECORDS:', err.message);
        btn.disabled    = false;
        btn.textContent = 'SYNC RECORDS';
        if (statusEl) { statusEl.textContent = 'FALHA — TENTE NOVAMENTE'; statusEl.style.color = '#ff4444'; }
      }
    };
  } else {
    document.getElementById('loginGoogleBtn').onclick = () => signInWithGoogle();
    document.getElementById('loginGithubBtn').onclick = () => signInWithGithub();
  }

  document.getElementById('rankingBtn').onclick = () => Leaderboard.open();
}

// ─────────────────────────────────────────────────────────────
// Leaderboard
// ─────────────────────────────────────────────────────────────
const LB_PER_PAGE = 10;
let _lbData = [];
let _lbPage = 0;

const DOTS = '. '.repeat(60); // overflow hidden faz o clip automaticamente

/**
 * Executa uma factory de promise com timeout.
 * Se timeout ocorrer, envia um ping para acordar o banco e tenta 1 vez.
 * @param {() => Promise} fn  — factory que cria a promise (chamada a cada tentativa)
 * @param {number} ms         — timeout por tentativa (ms)
 */
async function _lbWithRetry(fn, ms) {
  const _once = (factory) => Promise.race([
    factory(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout após ${ms}ms — banco pode estar acordando, tente novamente`)), ms)
    ),
  ]);

  try {
    return await _once(fn);
  } catch (err) {
    if (!err.message.startsWith('Timeout')) throw err;
    // Ping silencioso para acordar o banco, depois tenta de novo
    console.warn('[DB] Timeout — enviando ping e tentando novamente...');
    await pingDatabase().catch(() => {});
    return await _once(fn);
  }
}

const Leaderboard = {
  async open() {
    _lbPage = 0;
    showScreen('screen-leaderboard');
    this._bindButtons();
    await this._fetch();
  },

  _bindButtons() {
    document.getElementById('lbBackBtn').onclick  = () => { showScreen('screen-menu'); _renderMenu(); };
    document.getElementById('lbPrevBtn').onclick  = () => { _lbPage--; this._render(); };
    document.getElementById('lbNextBtn').onclick  = () => { _lbPage++; this._render(); };
    document.getElementById('lbSyncBtn').onclick  = () => this._sync();
  },

  async _fetch() {
    const statusEl = document.getElementById('lbStatus');
    const listEl   = document.getElementById('lbList');
    listEl.innerHTML = '';
    statusEl.textContent = 'CARREGANDO...';
    statusEl.style.color = '#555';

    try {
      _lbData = await _lbWithRetry(() => getLeaderboard(), 12000);
      statusEl.textContent = '';
      this._render();
    } catch (err) {
      console.error('[Leaderboard] Erro ao buscar dados:', err.message);
      statusEl.textContent = err.message.startsWith('Timeout')
        ? 'BANCO ACORDANDO — AGUARDE E TENTE NOVAMENTE'
        : 'FALHA AO CARREGAR — VERIFIQUE A CONEXÃO';
      statusEl.style.color = '#ff4444';
    }
  },

  _render() {
    const listEl    = document.getElementById('lbList');
    const pageInfo  = document.getElementById('lbPageInfo');
    const prevBtn   = document.getElementById('lbPrevBtn');
    const nextBtn   = document.getElementById('lbNextBtn');

    const totalPages = Math.max(1, Math.ceil(_lbData.length / LB_PER_PAGE));
    _lbPage = Math.max(0, Math.min(_lbPage, totalPages - 1));

    const slice = _lbData.slice(_lbPage * LB_PER_PAGE, (_lbPage + 1) * LB_PER_PAGE);
    const currentUsername = state.userProfile?.username || state.session?.user?.email?.split('@')[0];

    listEl.innerHTML = slice.map((row, i) => {
      const pos      = _lbPage * LB_PER_PAGE + i + 1;
      const name     = (row.username || 'ANÔNIMO').slice(0, 20).toUpperCase();
      const score    = (row.max_score || 0).toLocaleString('pt-BR');
      const wave     = String(row.max_wave || 0).padStart(2, '0');
      const isSelf   = currentUsername && name === currentUsername.toUpperCase();
      const podium   = pos === 1 ? 'lb-gold' : pos === 2 ? 'lb-silver' : pos === 3 ? 'lb-bronze' : '';
      const selfCls  = isSelf ? 'lb-self' : '';

      return `
        <div class="lb-row ${podium} ${selfCls}">
          <span class="lb-col-pos">${pos}</span>
          <span class="lb-col-name" title="${name}">${name}</span>
          <span class="lb-col-fill">${DOTS}</span>
          <span class="lb-col-score">${score}</span>
          <span class="lb-col-wave">${wave}</span>
        </div>`;
    }).join('');

    if (_lbData.length === 0) {
      listEl.innerHTML = '<div style="text-align:center; color:#334; font-size:11px; padding:30px 0; letter-spacing:2px;">NENHUM REGISTRO ENCONTRADO</div>';
    }

    pageInfo.textContent = `${_lbPage + 1} / ${totalPages}`;
    prevBtn.disabled = _lbPage === 0;
    nextBtn.disabled = _lbPage >= totalPages - 1;
  },

  async _sync() {
    const btn      = document.getElementById('lbSyncBtn');
    const statusEl = document.getElementById('lbStatus');
    const userId   = state.session?.user?.id;
    if (!userId) {
      statusEl.textContent = 'FAÇA LOGIN PARA SINCRONIZAR';
      statusEl.style.color = '#ff4444';
      return;
    }

    const localData = loadLocalProgress(userId);
    btn.disabled    = true;
    btn.textContent = 'SINCRONIZANDO...';
    statusEl.textContent = 'ENVIANDO DADOS...';
    statusEl.style.color = '#aaa';

    try {
      await _lbWithRetry(
        () => persistScore(userId, localData?.last_score || 0, localData?.last_wave || 0, localData),
        12000,
      );
      markSynced();
      statusEl.textContent = 'SINCRONIZADO — ATUALIZANDO RANKING...';
      statusEl.style.color = '#00ff88';
      await this._fetch();
    } catch (err) {
      console.error('[Leaderboard] Falha no sync:', err.message);
      statusEl.textContent = err.message.startsWith('Timeout')
        ? 'BANCO ACORDANDO — TENTE NOVAMENTE EM INSTANTES'
        : 'FALHA NA SINCRONIZAÇÃO';
      statusEl.style.color = '#ff4444';
    } finally {
      btn.disabled    = false;
      btn.textContent = 'SYNC RECORDS';
    }
  },
};

// ─────────────────────────────────────────────────────────────
// Auth Listener — Camada 4
// Escuta o Firebase e atualiza o estado de auth.
// A FSM decide o que fazer — nenhum reset() direto aqui.
// ─────────────────────────────────────────────────────────────
// ─── onAuthStateChanged: observer de estado de autenticação ──────────────────
// Firebase → callback recebe apenas (user)
//   user !== null → usuário logado    (uid, email disponíveis)
//   user === null → usuário deslogado
//   Refresh de token é silencioso e NÃO dispara o callback — sem ruído.
// O Firebase usa popup (não redirect), então não há hash/search na URL
// para limpar após o login.
//
// state.session é um objeto construído localmente para compatibilidade com o
// restante do código que acessa state.session?.user?.id e state.session?.user?.email.
// Firebase fornece user.uid (não user.id) — normalizamos para 'id' aqui.
onAuthStateChanged(auth, async (firebaseUser) => {
  // Constrói um objeto "session-like" para manter compatibilidade com o restante
  // do código que usa state.session?.user?.id.
  // Em vez de refatorar tudo de uma vez, adaptamos o shape do Firebase para o
  // formato que o restante do app já conhece.
  const session = firebaseUser
    ? { user: { id: firebaseUser.uid, email: firebaseUser.email } }
    : null;

  console.log('[Auth] Estado:', firebaseUser ? `logado (${firebaseUser.email})` : 'deslogado');

  const prevUserId = state.session?.user?.id;
  updateState({ session });

  if (session) {
    // Tenta usar dados locais primeiro (sem chamada de rede)
    const localData = loadLocalProgress(session.user.id);
    if (localData) {
      updateState({ userProfile: { ...localData, role: state.userProfile?.role || localData.role }, syncError: null });
    }

    // Role é permissão de servidor — sempre busca do banco para garantir valor atual.
    // Firestore não tem cold start então esta chamada é rápida (~50ms).
    const profile = await getUserProfile(session.user.id).catch(err => {
      console.warn('[Auth] Falha ao carregar perfil do banco:', err.message);
      return null;
    });

    if (!localData) {
      // Primeiro login ou dispositivo diferente — inicializa o cache local com dados do banco.
      // Se profile === null significa que o documento ainda não existe no Firestore
      // (diferente do Supabase que tinha trigger SQL criando automaticamente).
      // Criamos o documento agora e usamos o perfil novo como base do cache local.
      const resolvedProfile = profile ?? await createProfile(session.user.id, session.user.email).catch(() => null);
      const seeded = resolvedProfile
        ? seedFromDatabase(session.user.id, resolvedProfile)
        : null;
      updateState({ userProfile: seeded, syncError: null });
    } else if (profile) {
      // Atualiza apenas o role no estado (role sempre vem do banco, não do cache)
      updateState({ userProfile: { ...state.userProfile, role: profile.role || 'player' }, syncError: null });
    }
    // Re-renderiza o menu após o role ser resolvido (pode ter chegado de forma assíncrona)
    if (GameFSM.state === 'MENU') _renderMenu();
  } else {
    updateState({ userProfile: null, syncError: null });
  }

  updateHUD();

  // Navega para o menu em mudanças significativas de auth
  // (login ou logout — não em atualizações silenciosas de token)
  const isMeaningfulChange = (!!session) !== (!!prevUserId);
  if (isMeaningfulChange) {
    if (GameFSM.state === 'MENU') {
      _renderMenu();
    } else if (GameFSM.canTransition('MENU')) {
      GameFSM.transition('MENU');
    }
  }
});

// ─────────────────────────────────────────────────────────────
// API Pública
// ─────────────────────────────────────────────────────────────
const Game = {
  start() {
    updateState({ score: 0, paused: false });
    hideOverlay();
    document.getElementById('pauseIndicator').classList.add('hidden');
    initWave(1);
    updateHUD();
    GameFSM.transition('PLAYING');
    startLoop();
  },

  /** Reinicia a partir da wave em que o jogador morreu (score zerado, vidas cheias). */
  retry() {
    updateState({ score: 0, paused: false });
    hideOverlay();
    document.getElementById('pauseIndicator').classList.add('hidden');
    initWave(_deathWave);
    updateHUD();
    GameFSM.transition('PLAYING');
    startLoop();
  },

  nextWave() {
    const next = state.wave + 1;
    updateState({ paused: false });
    hideOverlay();
    document.getElementById('pauseIndicator').classList.add('hidden');
    initWave(next, state.lives, state.weaponLevel);
    updateHUD();
    GameFSM.transition('PLAYING');
    startLoop();
  },

  jumpToBoss(wave) {
    hideOverlay();
    initWave(wave);
    state.isBossDebugRun = wave;
    updateHUD();
    GameFSM.forceState('MENU'); // força para permitir transição para PLAYING
    GameFSM.transition('PLAYING');
    startLoop();
  },

  /**
   * Volta ao menu com sync se necessário.
   * Diferente do reset() anterior, não mistura sync e navegação —
   * o fluxo vai PLAYING → SYNCING → MENU via FSM/EventBus.
   */
  backToMenu() {
    stopLoop();
    updateState({ over: true });

    // Salva localmente se saiu no meio de uma partida com score (sem passar por game over/wave end)
    const isGameOverOrWaveEnd = GameFSM.state === 'GAME_OVER' || GameFSM.state === 'WAVE_END';
    if (!isGameOverOrWaveEnd && state.score > 0 && state.session) {
      _saveLocalScore('BackToMenu');
    }

    if (GameFSM.canTransition('MENU')) {
      GameFSM.transition('MENU');
    } else {
      GameFSM.forceState('GAME_OVER');
      GameFSM.transition('MENU');
    }
  },
};

window.Game = Game;

// ─────────────────────────────────────────────────────────────
// Exposição para testes
// ─────────────────────────────────────────────────────────────
window.keys     = keys;
window.getState = () => state;
window.GameFSM  = GameFSM;
window.GameTest = {
  pressKey(code, durationMs = 300) {
    keys[code] = true;
    setTimeout(() => { keys[code] = false; }, durationMs);
  },
  holdKey(code)    { keys[code] = true; },
  releaseKey(code) { keys[code] = false; },
  releaseAll()     { Object.keys(keys).forEach(k => { keys[k] = false; }); },
};

// ─────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────
initInput();
AudioManager.init();

// Botão Liga/Desliga Música
// (o FSM_MENU dispara música apenas em transições; no primeiro load a tela
//  de menu é montada diretamente por _renderMenu() sem passar pela FSM.
//  Por isso iniciamos a música aqui explicitamente.)
AudioManager.playMusic('menu');

const _musicBtn = document.getElementById('musicToggleBtn');
if (_musicBtn) {
  _musicBtn.addEventListener('click', () => {
    if (typeof AudioManager.setMusicMuted !== 'function') return;
    const muted = AudioManager.setMusicMuted();
    _musicBtn.classList.toggle('music-muted', muted);
  });
}

// Inicializa o editor inline de username no HUD (uma única vez)
initUsernameEdit(async (newUsername) => {
  if (!state.session) return;
  const userId = state.session.user.id;

  // Atualiza local imediatamente
  const updated = updateLocalUsername(userId, newUsername);
  if (updated) updateState({ userProfile: { ...updated, role: state.userProfile?.role || updated.role } });
  updateHUD();

  // Envia ao Firestore em background (sem travar a UI)
  updateUsername(userId, newUsername)
    .catch(err => console.warn('[Auth] Falha ao salvar username no banco:', err.message));
});

// Inicializa no MENU — o onAuthStateChange vai popular os dados de auth
// e chamar _renderMenu() quando a sessão for resolvida.
_renderMenu();
