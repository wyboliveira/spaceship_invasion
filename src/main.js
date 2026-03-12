import { state, updateState } from './game/state.js';
import { PHYSICS, VISUAL, getWaveConfig } from './game/config.js';
import { initInput } from './game/input.js';
import { createEnemies, createShields } from './game/helpers.js';
import { update } from './game/update.js';
import {
  drawPlayer, drawEnemy,
  drawPlayerBullet, drawEnemyBullet,
  drawShieldBlock, drawDrop, drawWeaponIndicator,
} from './game/sprites.js';
import { updateHUD } from './ui/hud.js';
import { showOverlay, hideOverlay } from './ui/overlay.js';

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
  });
}

// ── Render ────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H);

  // Flash de dano
  if (state.flashTimer > 0) {
    ctx.fillStyle = `rgba(255,0,60,${0.18 * (state.flashTimer / VISUAL.HIT_FLASH_DURATION)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Escudos
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

  // Inimigos
  for (const e of state.enemies) {
    if (e.alive) drawEnemy(ctx, e.x, e.y, e.row, e.hp, e.maxHp, state.frame, e.elite);
  }

  // Jogador
  if (!state.over) drawPlayer(ctx, state.player.x, state.player.y);

  // Balas do jogador
  for (const b of state.bullets) drawPlayerBullet(ctx, b.x, b.y, b.angled);

  // Balas inimigas
  for (const b of state.eBullets) drawEnemyBullet(ctx, b.x, b.y);

  // Drops
  for (const drop of state.drops) drawDrop(ctx, drop);

  // Partículas
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

  // Indicador de nível de arma
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

function gameLoop(ts) {
  if (state.paused || state.over) return;
  const dt = Math.min(ts - (state._lastTs || ts), 50);
  updateState({ _lastTs: ts, frame: state.frame + 1 });
  update(dt, ts, GameCallbacks);
  render();
  _animId = requestAnimationFrame(gameLoop);
}

// ── Callbacks ─────────────────────────────────────────────────
const GameCallbacks = {
  updateHUD,

  triggerGameOver: () => {
    updateState({ over: true });
    cancelAnimationFrame(_animId);
    setTimeout(() => {
      showOverlay(`
        <div class="overlay-title" style="color:var(--accent2)">GAME OVER</div>
        <div class="overlay-sub">
          SCORE ${String(state.score).padStart(6, '0')} — WAVE ${String(state.wave).padStart(2, '0')}
        </div>
        <button class="press-start" id="restartBtn">TENTAR NOVAMENTE</button>
      `);
      document.getElementById('restartBtn').onclick = () => Game.start();
    }, 600);
  },

  showWaveClear: () => {
    updateState({ over: true });
    cancelAnimationFrame(_animId);
    const next = state.wave + 1;
    setTimeout(() => {
      showOverlay(`
        <div class="overlay-title" style="color:var(--green)">WAVE CLEAR</div>
        <div class="overlay-sub">
          BONUS +${(state.cfg.bonusPoints || 0).toLocaleString()} pts &nbsp;|&nbsp;
          SCORE ${String(state.score).padStart(6, '0')}
        </div>
        <button class="press-start" id="nextWaveBtn">WAVE ${String(next).padStart(2, '0')} &rarr;</button>
      `);
      document.getElementById('nextWaveBtn').onclick = () => Game.nextWave();
    }, 400);
  },

  togglePause: () => {
    if (state.over) return;
    const paused = !state.paused;
    updateState({ paused });
    if (!paused) {
      updateState({ _lastTs: performance.now() });
      requestAnimationFrame(gameLoop);
    }
  },

  reset: () => {
    cancelAnimationFrame(_animId);
    updateState({ score: 0 });
    showOverlay(`
      <div class="overlay-title" style="color:var(--accent)">SPACESHIP</div>
      <div class="overlay-title" style="color:var(--accent);margin-top:-20px">INVASION</div>
      <div class="overlay-sub">dev edition — v1.0.0</div>
      <button class="press-start" id="startBtn">PRESS START</button>
      <div class="overlay-hint" style="margin-top:12px">
        <em>← →</em> MOVER &nbsp; <em>ESPAÇO</em> ATIRAR<br>
        <em>P</em> PAUSAR &nbsp; <em>R</em> REINICIAR
      </div>
    `);
    document.getElementById('startBtn').onclick = () => Game.start();
    updateHUD();
  },
};

// ── API Pública ───────────────────────────────────────────────
const Game = {
  start() {
    updateState({ score: 0 });
    hideOverlay();
    cancelAnimationFrame(_animId);
    initWave(1);
    updateHUD();
    updateState({ _lastTs: performance.now() });
    _animId = requestAnimationFrame(gameLoop);
  },

  nextWave() {
    const next = state.wave + 1;
    hideOverlay();
    cancelAnimationFrame(_animId);
    initWave(next, state.lives, state.weaponLevel);
    updateHUD();
    updateState({ _lastTs: performance.now() });
    _animId = requestAnimationFrame(gameLoop);
  },
};

window.Game = Game;

initInput(GameCallbacks);
GameCallbacks.reset();
