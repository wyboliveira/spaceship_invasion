/**
 * main.js — Orquestrador central
 *
 * Responsabilidades únicas deste arquivo:
 *   1. Inicializar e conectar as 4 camadas (FSM, EventBus, SyncQueue, I/O)
 *   2. Executar o game loop (requestAnimationFrame)
 *   3. Montar e desmontar overlays de UI em resposta a eventos da FSM
 *   4. Escutar onAuthStateChange e emitir AUTH_EVENT no bus (sem chamar reset() diretamente)
 *
 * O que NÃO vive mais aqui:
 *   - Lógica de retry / timeout de I/O  →  SyncQueue.js
 *   - Decisão de qual tela mostrar      →  GameFSM.js
 *   - Chamadas diretas ao Supabase      →  auth.js (via SyncQueue)
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
import { updateHUD }                     from './ui/hud.js';
import { 
  showOverlay, hideOverlay, 
  showScreen, hideAllScreens, 
  showModal, hideModal 
} from './ui/overlay.js';
import { supabase }                      from './lib/supabase.js';
import {
  signInWithGoogle, signInWithGithub, signOut,
  getUserProfile, persistScore,
  clearUserHistory, processPendingResets,
} from './api/auth.js';
import { EventBus }  from './core/EventBus.js';
import { GameFSM }   from './core/GameFSM.js';
import { SyncQueue } from './core/SyncQueue.js';

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
// Sync helpers — constroem taskFns para a SyncQueue
// ─────────────────────────────────────────────────────────────

/**
 * Enfileira uma sincronização de score na SyncQueue.
 * Captura score e wave NO MOMENTO do enfileiramento para evitar
 * que o estado mude antes da tarefa executar.
 */
function enqueueSyncScore(context) {
  if (!state.session || state.wave <= 0) return;

  const userId    = state.session.user.id;
  const score     = state.score;
  const wave      = state.wave;
  const profile   = state.userProfile;
  const sessionId = SyncQueue.currentSessionId;

  SyncQueue.enqueue(
    context,
    async () => {
      const saved = await persistScore(userId, score, wave, profile);
      // Atualiza perfil local com dados confirmados pelo banco
      updateState({ userProfile: saved, syncError: null });
    },
    sessionId,
  );
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
   * Transição: PLAYING → SYNCING → GAME_OVER
   */
  triggerGameOver() {
    updateState({ over: true });
    stopLoop();
    enqueueSyncScore('GameOver');
    GameFSM.transition('SYNCING', { next: 'GAME_OVER' });
  },

  /**
   * Chamado por update.js quando todos os inimigos foram eliminados
   * e não há boss nesta wave.
   * Transição: PLAYING → SYNCING → WAVE_END
   */
  showWaveClear() {
    updateState({ over: true });
    stopLoop();
    enqueueSyncScore('WaveClear');
    GameFSM.transition('SYNCING', { next: 'WAVE_END' });
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

/**
 * SYNCING: mostra spinner enquanto a SyncQueue processa.
 * Ao receber SYNC_DONE, avança para o próximo estado (WAVE_END ou GAME_OVER).
 * O botão "PULAR" resolve a espera imediatamente sem cancelar a fila
 * (a fila continua em background — os dados ainda serão salvos).
 */
EventBus.on('FSM_SYNCING', ({ payload }) => {
  const next = payload?.next || 'MENU'; // 'WAVE_END' ou 'GAME_OVER'

  showScreen('modal-sync');

  // Handler único para SYNC_DONE neste contexto
  const onDone = () => {
    EventBus.off('SYNC_DONE', onDone);
    hideModal('modal-sync');
    GameFSM.transition(next);
  };
  EventBus.on('SYNC_DONE', onDone);

  // Timeout de segurança: avança mesmo se a fila travar
  const timeoutId = setTimeout(() => {
    EventBus.off('SYNC_DONE', onDone);
    hideModal('modal-sync');
    console.warn('[Sync] Timeout de segurança atingido, avançando sem confirmação.');
    GameFSM.transition(next);
  }, 6000);

  // Limpa o timeout quando SYNC_DONE chegar antes
  EventBus.on('SYNC_DONE', () => clearTimeout(timeoutId));

  // Botão pular: avança imediatamente (fila continua em background)
  const skipBtn = document.getElementById('skipSyncBtn');
  if (skipBtn) {
    skipBtn.onclick = () => {
      EventBus.off('SYNC_DONE', onDone);
      clearTimeout(timeoutId);
      hideModal('modal-sync');
      GameFSM.transition(next);
    };
  }
});

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
      Game.start();
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
    document.getElementById('maxScoreVal').textContent = state.userProfile?.max_score || 0;
    document.getElementById('maxWaveVal').textContent = state.userProfile?.max_wave || 0;
    document.getElementById('lastScoreVal').textContent = state.userProfile?.last_score || 0;
    document.getElementById('lastWaveVal').textContent = state.userProfile?.last_wave || 0;
  } else {
    guestEl.classList.remove('hidden');
    loggedEl.classList.add('hidden');
  }

  // Boss Debug - rebuild only if needed or just toggle it
  const bossDebugContainer = document.getElementById('bossDebugContainer');
  if (bossDebugContainer) {
    bossDebugContainer.innerHTML = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(w => `
      <button class="debug-btn" onclick="Game.jumpToBoss(${w})"
        style="background:#222; color:#aaa; border:1px solid #444; padding:3px 6px; cursor:pointer; font-size:10px;">W${w}</button>
    `).join('');
  }

  showScreen('screen-menu');

  document.getElementById('startBtn').onclick = () => Game.start();

  if (state.session) {
    document.getElementById('logoutBtn').onclick = (e) => {
      e.stopPropagation();
      GameUI.showConfirm('DESEJA REALMENTE SAIR?', async () => {
        // 1. Atualização Otimista: Remove sessão localmente e renderiza Menu GUEST
        updateState({ session: null, userProfile: null });
        _renderMenu();

        // 2. Fire-and-forget de rede (sem awaits para não travar o modal)
        enqueueSyncScore('Logout');
        signOut().catch(err => console.warn('[Auth] Falha ignorada no signOut em background:', err));
      });
    };

    document.getElementById('clearHistoryBtn').onclick = (e) => {
      e.stopPropagation();
      GameUI.showConfirm(
        'TEM CERTEZA QUE DESEJA ZERAR OS DADOS?<br>NÃO HAVERÁ COMO RECUPERAR O REGISTRO',
        async () => {
          // Atualização Otimista: zera tudo localmente e renderiza imediatamente
          updateState({
            userProfile: { ...state.userProfile, max_score: 0, max_wave: 0, last_score: 0, last_wave: 0 },
            syncError: null,
          });
          _renderMenu();

          // Enfileira em background (fire and forget)
          SyncQueue.enqueue(
            'ClearHistory',
            async () => {
              await clearUserHistory(state.session.user.id);
            },
            SyncQueue.currentSessionId,
          );
        },
      );
    };
  } else {
    document.getElementById('loginGoogleBtn').onclick = () => signInWithGoogle();
    document.getElementById('loginGithubBtn').onclick = () => signInWithGithub();
  }
}

/**
 * Aguarda SYNC_DONE ou um timeout, o que ocorrer primeiro.
 * Usado antes de operações que dependem do banco estar atualizado.
 */
function _waitSyncOrTimeout(ms) {
  if (!SyncQueue.busy) return Promise.resolve();

  return new Promise(resolve => {
    let timer = setTimeout(() => {
      EventBus.off('SYNC_DONE', onEvent);
      EventBus.off('SYNC_FAILED', onEvent);
      console.warn(`[Sync] Timeout de espera pela fila (${ms}ms)`);
      resolve();
    }, ms);

    const onEvent = () => {
      // Resolvemos apenas quando a fila estiver vazia (ou ociosa)
      if (!SyncQueue.busy) {
        clearTimeout(timer);
        EventBus.off('SYNC_DONE', onEvent);
        EventBus.off('SYNC_FAILED', onEvent);
        resolve();
      }
    };

    EventBus.on('SYNC_DONE', onEvent);
    EventBus.on('SYNC_FAILED', onEvent);
  });
}

// ─────────────────────────────────────────────────────────────
// Auth Listener — Camada 4
// Escuta o Supabase e emite AUTH_EVENT no bus.
// A FSM decide o que fazer — nenhum reset() direto aqui.
// ─────────────────────────────────────────────────────────────
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('[Auth] Evento:', event);

  // TOKEN_REFRESHED é silencioso — não interrompe o jogo em nenhuma hipótese
  if (event === 'TOKEN_REFRESHED') return;

  // Limpa parâmetros OAuth da URL após redirect bem-sucedido
  if (event === 'SIGNED_IN' && (window.location.hash || window.location.search.includes('access_token'))) {
    history.replaceState(null, '', window.location.pathname);
  }

  const prevUserId = state.session?.user?.id;
  updateState({ session });

  if (session) {
    const profile = await getUserProfile(session.user.id).catch(err => {
      console.warn('[Auth] Falha ao carregar perfil:', err.message);
      return null;
    });
    updateState({ userProfile: profile, syncError: null });
    await processPendingResets().catch(() => {});
  } else {
    updateState({ userProfile: null, syncError: null });
    SyncQueue.clear(); // Descarta tarefas de sessão encerrada
  }

  updateHUD();

  // Só navega para o menu se estamos em um estado que permite isso
  const isMeaningfulChange = event === 'SIGNED_IN' || event === 'SIGNED_OUT' || (!session && prevUserId);
  if (isMeaningfulChange) {
    if (GameFSM.state === 'MENU') {
      // Já no menu — apenas re-renderiza com dados novos
      _renderMenu();
    } else if (GameFSM.canTransition('MENU')) {
      GameFSM.transition('MENU');
    } else {
      // Estava em estado intermediário (SYNCING, etc.) — aguarda e redireciona
      const done = () => {
        EventBus.off('FSM_MENU', done);
        EventBus.off('FSM_WAVE_END', done);
        EventBus.off('FSM_GAME_OVER', done);
      };
      EventBus.on('FSM_MENU', done);
    }
  }
});

// ─────────────────────────────────────────────────────────────
// API Pública
// ─────────────────────────────────────────────────────────────
const Game = {
  start() {
    SyncQueue.newSession();
    updateState({ score: 0, paused: false });
    hideOverlay();
    document.getElementById('pauseIndicator').classList.add('hidden');
    initWave(1);
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
    SyncQueue.newSession();
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

    // Se já estamos em um estado final (GAME_OVER ou WAVE_END), o score já foi sincronizado.
    const isGameOverOrWaveEnd = GameFSM.state === 'GAME_OVER' || GameFSM.state === 'WAVE_END';

    if (!isGameOverOrWaveEnd && state.score > 0 && state.session) {
      enqueueSyncScore('BackToMenu');
      GameFSM.transition('SYNCING', { next: 'MENU' });
    } else if (GameFSM.canTransition('MENU')) {
      GameFSM.transition('MENU');
    } else {
      // Força transição caso a FSM esteja em um estado inesperado (ex: SYNC_ERROR)
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

// Inicializa no MENU — o onAuthStateChange vai popular os dados de auth
// e chamar _renderMenu() quando a sessão for resolvida.
_renderMenu();
