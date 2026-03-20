import { state, updateState } from './game/state.js';
import { PHYSICS, VISUAL, getWaveConfig } from './game/config.js';
import { initInput, keys } from './game/input.js';
import { createEnemies, createShields } from './game/helpers.js';
import { update } from './game/update.js';
import {
  drawPlayer, drawEnemy,
  drawPlayerBullet, drawEnemyBullet,
  drawShieldBlock, drawDrop, drawWeaponIndicator,
  drawBoss,
} from './game/sprites.js';
import { updateHUD } from './ui/hud.js';
import { showOverlay, hideOverlay } from './ui/overlay.js';
import { supabase } from './lib/supabase.js';
import { 
  signInWithGoogle, signInWithGithub, signOut, 
  getUserProfile, updateMaxScore, clearUserHistory, 
  processPendingResets 
} from './api/auth.js';

const gameCanvas = document.getElementById('gameCanvas');
const bgCanvas   = document.getElementById('bgCanvas');
const ctx  = gameCanvas.getContext('2d');
const bCtx = bgCanvas.getContext('2d');
const W = PHYSICS.CANVAS_W, H = PHYSICS.CANVAS_H;

// ── Estrelas de fundo ─────────────────────────────────────────
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

// ── Inicialização de wave ─────────────────────────────────────
function initWave(waveNumber, livesCarryOver, weaponLevelCarryOver) {
  const cfg = getWaveConfig(waveNumber);

  updateState({
    cfg,
    wave:   waveNumber,
    lives:  livesCarryOver     !== undefined ? livesCarryOver     : cfg.playerLives,
    weaponLevel: weaponLevelCarryOver !== undefined ? weaponLevelCarryOver : 1,
    player: {
      x: W / 2 - PHYSICS.PLAYER_W / 2,
      y: H - PHYSICS.PLAYER_Y_OFFSET,
      w: PHYSICS.PLAYER_W,
      h: PHYSICS.PLAYER_H,
    },
    bullets:   [],
    eBullets:  [],
    drops:     [],
    enemies:   createEnemies(cfg),
    shields:   createShields(cfg),
    particles: [],
    enemyDir:       1,
    enemyMoveTimer: 0,
    enemyFireTimer: 0,
    frame:      0,
    flashTimer: 0,
    lastFire:   0,
    paused:     false,
    over:       false,
    _lastTs:    0,
    isBossDebugRun: false,   // limpa o flag de debug ao iniciar fase normal
    boss: {
// ── Construção do Objeto Boss no estado global ──────────────────
      active: false, introAnim: false, hp: 0, maxHp: 0,
      x: 0, y: 0, side: 'left', shield: 0,
      flashTimer: 0, neon: false,
    },
  });
}

// ── Render ────────────────────────────────────────────────────
/**
 * Pinta o estado atual do jogo na tela. Chamado nativamente 
 * dezenas de vezes por segundo pelo Game Loop. Importa muito do sprites.js.
 */
function render() {
  ctx.clearRect(0, 0, W, H);

  // 1. Flash de dano (Sobrepõe toda a tela de vermelho fraco)
  if (state.flashTimer > 0) {
    ctx.fillStyle = `rgba(255,0,60,${0.18 * (state.flashTimer / VISUAL.HIT_FLASH_DURATION)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // 2. Escudos do jogador
  for (const sh of state.shields) {
    for (const bl of sh.blocks) {
      if (bl.hp <= 0) continue; // Bloco quebrado (HP 0) não é desenhado
      drawShieldBlock(
        ctx,
        sh.x + bl.c * PHYSICS.SHIELD_BLOCK_SZ,
        sh.y + bl.r * PHYSICS.SHIELD_BLOCK_SZ,
        bl.hp,
      );
    }
  }

  // 3. Inimigos normais
  for (const e of state.enemies) {
    if (e.alive) drawEnemy(ctx, e.x, e.y, e.row, e.hp, e.maxHp, state.frame, e.elite);
  }

  // 4. Chefão (Boss) se fase for múltipla de 10
  if (state.boss.active) {
    drawBoss(ctx, state.boss, state.frame, state.wave);
  }

  // 5. Nave do jogador
  if (!state.over) drawPlayer(ctx, state.player.x, state.player.y);

  // 6. Projéteis (Player e Inimigos)
  for (const b of state.bullets) drawPlayerBullet(ctx, b.x, b.y, b.angled);
  for (const b of state.eBullets) drawEnemyBullet(ctx, b.x, b.y);

  // 7. Power-ups e curas caindo
  for (const drop of state.drops) drawDrop(ctx, drop);

  // 8. Partículas (Faíscas/explosões)
  for (const p of state.particles) {
    ctx.globalAlpha = p.life; // Fica mais transparente conforme a vida acaba
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 5;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;

  // 9. Indicador de Nível de Arma (Canto inferior direito)

  if (state.weaponLevel > 1) drawWeaponIndicator(ctx, state.weaponLevel, W, H);

  // Pausa
  if (state.paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle   = VISUAL.COLOR_PLAYER;
    ctx.font        = "bold 13px 'Orbitron',monospace";
    ctx.textAlign   = 'center';
    ctx.fillText('— PAUSED —', W / 2, H / 2);
    ctx.textAlign   = 'left';
  }
}

// ── Game Loop ─────────────────────────────────────────────────
let _animId = null;
let _lastSyncedScore = -1; // Rastreia o último score sincronizado para evitar duplicidade

function gameLoop(ts) {
  if (state.paused || state.over) return;
  const dt = Math.min(ts - (state._lastTs || ts), 50);
  updateState({ _lastTs: ts, frame: state.frame + 1 });
  update(dt, ts, GameCallbacks);
  render();
  _animId = requestAnimationFrame(gameLoop);
}

// ── Callbacks ─────────────────────────────────────────────────
/**
 * Objeto centralizador de Callbacks.
 * Permite que o motor do jogo (update.js) acione eventos de UI sem acoplamento direto.
 */
const GameCallbacks = {
  /** Atualiza o HUD com os valores atuais de score, onda e vidas. */
  updateHUD,

  /** 
   * Trata o fim de jogo por morte ou invasão.
   * Salva o progresso no Supabase e exibe o overlay de Game Over.
   */
  triggerGameOver: () => {
    updateState({ over: true });
    cancelAnimationFrame(_animId);
    
    // Sincronização automática em background se houver sessão ativa
    if (state.session && state.score !== _lastSyncedScore) {
      _lastSyncedScore = state.score;
      updateMaxScore(state.session.user.id, state.score, state.wave);
    }

    setTimeout(() => {
      showOverlay(`
        <div class="overlay-title" style="color:var(--accent2)">GAME OVER</div>
        <div class="overlay-sub">
          SCORE ${String(state.score).padStart(6, '0')} — WAVE ${String(state.wave).padStart(2, '0')}
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; align-items:center;">
          <button class="press-start" id="restartBtn">TENTAR NOVAMENTE</button>
          <button class="press-start" id="backToMenuBtn" style="background:#444; color:#fff; border-color:#666; font-size:10px; height:auto; padding:10px 20px;">VOLTAR AO MENU</button>
        </div>
      `);
      document.getElementById('restartBtn').onclick = () => Game.start();
      document.getElementById('backToMenuBtn').onclick = () => GameCallbacks.reset();
    }, 600);
  },

  showWaveClear: () => {
    updateState({ over: true });
    cancelAnimationFrame(_animId);
    const next = state.wave + 1;
    // Salva progresso em background (Persistence background sync)
    if (state.session && state.score !== _lastSyncedScore) {
      _lastSyncedScore = state.score;
      updateMaxScore(state.session.user.id, state.score, state.wave);
    }

    setTimeout(() => {
      try {
        showOverlay(`
          <div class="overlay-title" style="color:var(--green)">WAVE CLEAR</div>
          <div class="overlay-sub">
            BONUS +${(state.cfg?.bonusPoints || 0).toLocaleString()} pts &nbsp;|&nbsp;
            SCORE ${String(state.score).padStart(6, '0')}
          </div>
          <button class="press-start" id="nextWaveBtn">WAVE ${String(next).padStart(2, '0')} &rarr;</button>
        `);
        document.getElementById('nextWaveBtn').onclick = () => {
          hideOverlay();
          Game.nextWave();
        };
      } catch (e) {
        console.error("[UI Error] Error showing Wave Clear overlay:", e);
      }
    }, 600);
  },

  showBossTestComplete: (wave) => {
    updateState({ over: true });
    cancelAnimationFrame(_animId);
    setTimeout(() => {
      showOverlay(`
        <div class="overlay-title" style="color:#00ffcc; font-size:28px;">TESTE DE CHEFÃO W${wave} OK</div>
        <div class="overlay-sub" style="color:#aaa; margin-top:10px;">
          Boss derrotado com sucesso!<br>Retornando ao menu em <span id="countdown">5</span>s...
        </div>
      `);
      let secs = 5;
      const tick = setInterval(() => {
        secs--;
        const el = document.getElementById('countdown');
        if (el) el.textContent = secs;
        if (secs <= 0) {
          clearInterval(tick);
          GameCallbacks.reset();
        }
      }, 1000);
    }, 600);
  },

  togglePause: () => {
    if (state.over) return;
    const paused = !state.paused;
    updateState({ paused });
    
    const indicator = document.getElementById('pauseIndicator');
    if (paused) {
      indicator.classList.remove('hidden');
    } else {
      indicator.classList.add('hidden');
      updateState({ _lastTs: performance.now() });
      requestAnimationFrame(gameLoop);
    }
  },

  /**
   * Reseta o jogo para o estado inicial de menu.
   * Garante a persistência do score atual antes de limpar o estado.
   */
  reset: () => {
    // Evita recursão e garante que o resto do código saiba que estamos no menu
    const wasOver = state.over;
    const wasWave0 = state.wave === 0;

    // Salva progresso em background antes de resetar (caso não tenha sido salvo no GameOver)
    if (state.session && state.score > 0 && state.score !== _lastSyncedScore) {
      _lastSyncedScore = state.score;
      updateMaxScore(state.session.user.id, state.score, state.wave).catch(e => console.error("[Sync] Erro ao salvar no reset:", e));
    }

    cancelAnimationFrame(_animId);
    updateState({ score: 0, paused: false, over: true, wave: 0 });
    document.getElementById('pauseIndicator').classList.add('hidden');

    const username = state.session 
      ? (state.userProfile?.username || state.session.user.email.split('@')[0])
      : 'GUEST';

    const authContent = state.session ? `
      <div style="margin-bottom:20px; text-align:center;">
        <div style="font-size:18px; color:#00ff88; margin-bottom:10px;">USER: ${username.toUpperCase()}</div>
        
        <div style="font-size:11px; color:#aaa; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px;">RECORDS</div>
        <div style="font-size:13px; color:#FFD700; display:flex; gap:15px; justify-content:center; font-weight:bold; margin-bottom:15px;">
          <span>MAX SCORE: ${state.userProfile?.max_score || 0}</span>
          <span>MAX WAVE: ${state.userProfile?.max_wave || 0}</span>
        </div>

        <div style="font-size:11px; color:#aaa; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px;">LAST GAME</div>
        <div style="font-size:13px; color:#00ddff; display:flex; gap:15px; justify-content:center; font-weight:bold; margin-bottom:15px;">
          <span>YOUR LAST SCORE: ${state.userProfile?.last_score || 0}</span>
          <span>WAVES COMPLETED: ${state.userProfile?.last_wave || 0}</span>
        </div>

        <div style="display:flex; gap:10px; justify-content:center;">
          <button class="press-start" id="logoutBtn" style="font-size:10px; padding:5px 15px; background:#ff4444; border:none; height:auto; line-height:1; opacity:0.8;">SAIR</button>
          <button class="press-start" id="clearHistoryBtn" style="font-size:10px; padding:5px 15px; background:#444; border:1px solid #666; color:#aaa; height:auto; line-height:1; opacity:0.8;">ZERAR HISTÓRICO</button>
        </div>
      </div>
    ` : `
      <div style="margin-bottom:20px; text-align:center;">
        <div style="font-size:10px; color:#666; margin-bottom:10px;">CONECTAR CONTA</div>
        <div style="display:flex; gap:10px; justify-content:center;">
          <button class="press-start" id="loginGoogleBtn" style="font-size:10px; padding:8px 12px; margin:0; background:#4285F4; border:none; height:auto; line-height:1;">GOOGLE</button>
          <button class="press-start" id="loginGithubBtn" style="font-size:10px; padding:8px 12px; margin:0; background:#333; border:none; height:auto; line-height:1;">GITHUB</button>
        </div>
      </div>
    `;

    showOverlay(`
      <div class="overlay-title" style="color:var(--accent)">SPACESHIP</div>
      <div class="overlay-title" style="color:var(--accent);margin-top:-20px">INVASION</div>
      
      ${authContent}

      <button class="press-start" id="startBtn">PRESS START</button>
      <div class="overlay-hint" style="margin-top:12px">
        <em>← →</em> MOVER &nbsp; <em>ESPAÇO</em> ATIRAR<br>
        <em>P</em> PAUSAR &nbsp; <em>R</em> REINICIAR
      </div>
      <div id="bossDebug" style="margin-top:20px; border-top:1px solid #333; padding-top:10px;">
        <div style="font-size:10px; color:#666; margin-bottom:5px;">TESTE DE BOSSES</div>
        <div style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center;">
          ${[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(w => `
            <button class="debug-btn" onclick="Game.jumpToBoss(${w})" style="background:#222; color:#aaa; border:1px solid #444; padding:3px 6px; cursor:pointer; font-size:10px;">W${w}</button>
          `).join('')}
        </div>
      </div>
    `);
    
    document.getElementById('startBtn').onclick = () => Game.start();
    
    if (state.session) {
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
          e.stopPropagation();
          GameCallbacks.showConfirm('DESEJA REALMENTE SAIR?', async () => {
            try {
              const okBtn = document.getElementById('confirmOkBtn');
              const cancelBtn = document.getElementById('confirmCancelBtn');
              if (okBtn) { okBtn.disabled = true; okBtn.textContent = 'SAINDO...'; }
              if (cancelBtn) cancelBtn.style.display = 'none';
              
              // Tenta salvar o último progresso antes de fechar a sessão
              if (state.score > 0) {
                await updateMaxScore(state.session.user.id, state.score, state.wave);
              }
              
              await signOut();
              // O reset() virá pelo onAuthStateChange, mas forçamos aqui por segurança
              GameCallbacks.reset(); 
            } catch (err) {
              console.error("[Logout] Failed:", err);
              updateState({ session: null, userProfile: null });
              GameCallbacks.reset();
            }
          }, () => {
            GameCallbacks.reset();
          });
        };
      }

      const clearBtn = document.getElementById('clearHistoryBtn');
      if (clearBtn) {
        clearBtn.onclick = (e) => {
          e.stopPropagation();
          GameCallbacks.showConfirm('TEM CERTEZA QUE DESEJA ZERAR OS DADOS?<br>NÃO HAVERÁ COMO RECUPERAR O REGISTRO', async () => {
            try {
              const okBtn = document.getElementById('confirmOkBtn');
              const cancelBtn = document.getElementById('confirmCancelBtn');
              if (okBtn) { okBtn.disabled = true; okBtn.textContent = 'ZERANDO...'; }
              if (cancelBtn) cancelBtn.style.display = 'none';

              await clearUserHistory(state.session.user.id);
            } catch (err) {
              console.error("[History] Error clearing:", err);
            } finally {
              GameCallbacks.reset(); // Re-renderiza o menu para mostrar os zeros e destravar o botão
            }
          }, () => {
            GameCallbacks.reset();
          });
        };
      }
    } else {
      const gBtn = document.getElementById('loginGoogleBtn');
      const ghBtn = document.getElementById('loginGithubBtn');
      if (gBtn) gBtn.onclick = () => signInWithGoogle();
      if (ghBtn) ghBtn.onclick = () => signInWithGithub();
    }

    updateHUD();
  },

  /**
   * Exibe uma caixa de diálogo de confirmação personalizada (Overlay).
   * @param {string} message - Mensagem (HTML aceito) a ser exibida.
   * @param {Function} onOk - Callback executado ao clicar em OK.
   * @param {Function} onCancel - Callback opcional executado ao clicar em CANCELAR.
   */
  showConfirm: (message, onOk, onCancel) => {
    // Pausa o jogo automaticamente se estiver em execução
    const wasPaused = state.paused;
    if (!state.over && !wasPaused) GameCallbacks.togglePause();

    showOverlay(`
      <div class="overlay-title" style="color:var(--accent); font-size:20px; margin-bottom:15px;">CONFIRMAÇÃO</div>
      <div class="overlay-sub" style="color:#fff; margin-bottom:25px; font-size:16px;">${message}</div>
      <div style="display:flex; gap:15px; justify-content:center;">
        <button class="press-start" id="confirmOkBtn" style="background:var(--accent); color:#000; min-width:100px; font-size: 10px; padding: 8px 20px;">OK</button>
        <button class="press-start" id="confirmCancelBtn" style="border-color:#666; color:#666; min-width:100px; font-size: 10px; padding: 8px 20px;">CANCELAR</button>
      </div>
    `);

    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    // Foca no botão OK para que ENTER funcione imediatamente
    setTimeout(() => okBtn.focus(), 10);

    okBtn.onclick = async () => {
      if (onOk) {
        await onOk();
      }
      
      // Se após o callback ainda estivermos com o overlay de confirmação (ou se ele não mostrou o menu), fechamos.
      // No caso do reset(), o showOverlay() lá já terá substituído o conteúdo, então hideOverlay() aqui
      // só deve ser chamado se o callback NÃO abriu outra coisa.
      // Como não temos um jeito fácil de checar o conteúdo do innerHTML de forma limpa, 
      // vamos apenas fechar se não estivermos no menu principal.
      if (!state.over || state.wave !== 0) {
        hideOverlay();
      }
    };

    cancelBtn.onclick = () => {
      hideOverlay();
      if (onCancel) {
        onCancel();
      } else if (!state.over && !wasPaused) {
        // Se cancelou e o jogo estava rodando, despausa
        GameCallbacks.togglePause();
      }
    };
  }
};

// ── Listener de Autenticação Reativo ──────────────────────────
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('[Auth] State change event:', event);
  const oldSessionId = state.session?.user?.id;
  updateState({ session });
  
  if (session) {
    const profile = await getUserProfile(session.user.id);
    updateState({ userProfile: profile });
    // Verifica se há limpezas de histórico pendentes para este usuário
    processPendingResets();
  } else {
    updateState({ userProfile: null });
  }
  
  updateHUD();

  // Só re-renderiza o menu se o evento for relevante e estivermos tecnicamente no menu ou acabamos de sair
  const isLogout = event === 'SIGNED_OUT' || (oldSessionId && !session);
  const isLogin = event === 'SIGNED_IN' && !oldSessionId;

  if (state.over && (state.wave === 0 || isLogout || isLogin)) {
    // Se o overlay sumiu ou se o evento de auth mudou no menu, redesenhamos
    GameCallbacks.reset();
  }
});

// Listener extra para garantir reset quando forçado manualmente
window.addEventListener('auth-status-changed', () => {
  if (state.over && state.wave === 0) GameCallbacks.reset();
});

// ── Inicialização Final ──────────────────────────────────────
// A lógica de inicialização agora está concentrada no final do arquivo.
// ── API Pública ───────────────────────────────────────────────
const Game = {
  start() {
    _lastSyncedScore = -1; // Reseta o rastreio para a nova partida
    updateState({ score: 0, paused: false });
    hideOverlay();
    document.getElementById('pauseIndicator').classList.add('hidden');
    cancelAnimationFrame(_animId);
    initWave(1);
    updateHUD();
    updateState({ _lastTs: performance.now() });
    _animId = requestAnimationFrame(gameLoop);
  },

  nextWave() {
    const next = state.wave + 1;
    updateState({ paused: false });
    hideOverlay();
    document.getElementById('pauseIndicator').classList.add('hidden');
    cancelAnimationFrame(_animId);
    initWave(next, state.lives, state.weaponLevel);
    updateHUD();
    updateState({ _lastTs: performance.now() });
    _animId = requestAnimationFrame(gameLoop);
  },

  jumpToBoss(wave) {
    // Inicia a fase normalmente (com inimigos e nave visíveis)
    hideOverlay();
    cancelAnimationFrame(_animId);
    initWave(wave);
    // Marca como modo debug de boss para exibir mensagem especial ao vencer
    state.isBossDebugRun = wave;
    updateHUD();
    updateState({ _lastTs: performance.now() });
    _animId = requestAnimationFrame(gameLoop);
  }
};

window.Game = Game;

// ── Exposição global para testes automatizados ────────────────
// O objeto `keys` é compartilhado por referência — qualquer escrita reflete no game loop
window.keys = keys;
// `state` é substituído por updateState, então usamos um proxy para sempre retornar o mais recente
window.getState = () => state;


// Helper de testes — simula controles sem necessidade de foco no teclado
window.GameTest = {
  /** Pressiona e solta uma tecla após durationMs */
  pressKey(code, durationMs = 300) {
    keys[code] = true;
    setTimeout(() => { keys[code] = false; }, durationMs);
  },
  holdKey(code)    { keys[code] = true; },
  releaseKey(code) { keys[code] = false; },
  releaseAll()     { Object.keys(keys).forEach(k => { keys[k] = false; }); },
};

initInput(GameCallbacks);
GameCallbacks.reset();
processPendingResets(); // Sincroniza limpezas pendentes no boot
