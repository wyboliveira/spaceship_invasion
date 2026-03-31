import { VISUAL, PHYSICS } from './config.js';

// ── Helpers de cor ───────────────────────────────────────────
/**
 * Retorna a cor do inimigo com base em qual linha (row) da grade ele está.
 * Linhas mais frontais (0, 1) possuem cores e valores diferentes.
 */
export function enemyColor(row) {
  if (row < 1) return VISUAL.COLOR_ENEMY_A; // Tipo A (frente)
  if (row < 3) return VISUAL.COLOR_ENEMY_B; // Tipo B (meio)
  return VISUAL.COLOR_ENEMY_C;              // Tipo C (trás)
}

// ── Player (Nave principal) ───────────────────────────────────
/**
 * Desenha a nave do jogador na tela com um propulsor (thruster) animado.
 */
export function drawPlayer(ctx, x, y) {
  ctx.shadowColor = VISUAL.COLOR_PLAYER_GLOW;
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = VISUAL.COLOR_PLAYER;

  // Montagem do Sprite (Pixel art)
  ctx.fillRect(x + 10, y + 8,  6, 18);   // fuselagem central
  ctx.fillRect(x + 2,  y + 16, 8,  6);   // asa esquerda
  ctx.fillRect(x + 16, y + 16, 8,  6);   // asa direita
  ctx.fillRect(x + 11, y + 2,  4,  8);   // bico/nariz
  ctx.fillRect(x + 12, y,      2,  4);   // ponta da arma

  // Thruster animado (Fogo do motor)
  ctx.fillStyle = `rgba(255,200,50,0.85)`;
  ctx.fillRect(x + 11, y + 26, 4, Math.floor(Math.random() * 7) + 2);

  ctx.shadowBlur = 0;
}

// ── Enemy (normal e elite) ───────────────────────────────────
/**
 * Desenha um inimigo individual na tela.
 * A forma geométrica varia dependendo da linha (row) a qual o inimigo pertence.
 * Inimigos 'elite' pulsam lentamente e possuem uma pequena "coroa" brilhante no topo.
 */
export function drawEnemy(ctx, x, y, row, hp, maxHp, frame, isElite = false) {
  const baseCol = enemyColor(row);
  const t       = Math.floor(frame * 0.05) % 2; // Alterna entre estado 0 e 1 (para movimentar patinhas/tentáculos)

  // Elite: pulsação visual fluida interpolando cor base e dourado
  let col = baseCol;
  if (isElite) {
    const pulse = (Math.sin(frame * 0.12) + 1) / 2;  // Vai de 0 a 1 suavemente
    col = lerpColor(baseCol, VISUAL.COLOR_ELITE_PULSE, 0.4 + pulse * 0.6);
  }

  ctx.shadowColor = col;
  ctx.shadowBlur  = isElite ? 14 : 7;
  ctx.fillStyle   = col;

  // ── Sprites pixel art ──────────────────────────────────────
  if (row < 1) {
    // Tipo A — calamar
    ctx.fillRect(x + 6,  y + 2,  14, 4);
    ctx.fillRect(x + 4,  y + 6,  18, 8);
    ctx.fillRect(x + 2,  y + 14, 22, 4);
    ctx.fillRect(x + 4,  y,       3, 3);
    ctx.fillRect(x + 19, y,       3, 3);
    if (t === 0) {
      ctx.fillRect(x + 3,  y + 18, 4, 4);
      ctx.fillRect(x + 10, y + 18, 4, 4);
      ctx.fillRect(x + 17, y + 18, 4, 4);
    } else {
      ctx.fillRect(x + 5,  y + 18, 4, 4);
      ctx.fillRect(x + 12, y + 18, 4, 4);
      ctx.fillRect(x + 19, y + 18, 4, 4);
    }
  } else if (row < 3) {
    // Tipo B — caranguejo
    ctx.fillRect(x + 6,  y + 4,  14, 4);
    ctx.fillRect(x + 4,  y + 8,  18, 8);
    ctx.fillRect(x + 6,  y + 16, 14, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(x + 8,  y + 9,   3, 3);
    ctx.fillRect(x + 15, y + 9,   3, 3);
    ctx.fillStyle = col;
    if (t === 0) {
      ctx.fillRect(x,      y + 6, 4, 4);
      ctx.fillRect(x + 22, y + 6, 4, 4);
    } else {
      ctx.fillRect(x + 1,  y + 4, 4, 4);
      ctx.fillRect(x + 21, y + 4, 4, 4);
    }
  } else {
    // Tipo C — zumbido
    ctx.fillRect(x + 8,  y + 2,  10, 4);
    ctx.fillRect(x + 4,  y + 6,  18, 4);
    ctx.fillRect(x + 6,  y + 10, 14, 8);
    ctx.fillRect(x + 8,  y + 18, 10, 4);
    ctx.fillStyle = '#111';
    ctx.fillRect(x + 11, y + 12,  4, 3);
    ctx.fillStyle = col;
    if (t === 0) {
      ctx.fillRect(x,      y + 6, 4, 8);
      ctx.fillRect(x + 22, y + 6, 4, 8);
    } else {
      ctx.fillRect(x + 1,  y + 4, 4, 8);
      ctx.fillRect(x + 21, y + 4, 4, 8);
    }
  }

  // Overlay de dano
  if (hp < maxHp) {
    ctx.fillStyle = `rgba(255,0,0,${0.55 * (1 - hp / maxHp)})`;
    ctx.fillRect(x, y, PHYSICS.ENEMY_W, PHYSICS.ENEMY_H);
  }

  // Coroa elite: pequenos pontos brilhantes no topo
  if (isElite) {
    ctx.shadowColor = VISUAL.COLOR_ELITE_PULSE;
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = VISUAL.COLOR_ELITE_PULSE;
    ctx.fillRect(x + 8,  y - 4, 3, 3);
    ctx.fillRect(x + 14, y - 4, 3, 3);
    ctx.fillRect(x + 11, y - 7, 3, 3);
  }

  ctx.shadowBlur = 0;
}

// ── Balas ─────────────────────────────────────────────────────
export function drawPlayerBullet(ctx, x, y, angled = false) {
  const col = angled ? VISUAL.COLOR_BULLET_ANGLED : VISUAL.COLOR_BULLET;
  ctx.shadowColor = col;
  ctx.shadowBlur  = angled ? 7 : 10;
  ctx.fillStyle   = col;
  ctx.fillRect(x - 1, y - 6, 3, 12);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y - 4, 1, 5);
  ctx.shadowBlur = 0;
}

export function drawEnemyBullet(ctx, x, y) {
  ctx.shadowColor = VISUAL.COLOR_ENEMY_BULLET;
  ctx.shadowBlur  = 8;
  ctx.fillStyle   = VISUAL.COLOR_ENEMY_BULLET;
  ctx.fillRect(x - 2, y - 4, 4, 8);
  ctx.fillStyle = '#ffaacc';
  ctx.fillRect(x - 1, y - 2, 2, 4);
  ctx.shadowBlur = 0;
}

// ── Escudos ───────────────────────────────────────────────────
export function drawShieldBlock(ctx, x, y, hp) {
  ctx.globalAlpha = 0.3 + (hp / PHYSICS.SHIELD_BLOCK_HP) * 0.7;
  ctx.fillStyle   = VISUAL.COLOR_SHIELD;
  ctx.shadowColor = VISUAL.COLOR_SHIELD;
  ctx.shadowBlur  = 4;
  ctx.fillRect(x, y, PHYSICS.SHIELD_BLOCK_SZ, PHYSICS.SHIELD_BLOCK_SZ);
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

// ── Drops ─────────────────────────────────────────────────────
export function drawDrop(ctx, drop) {
  const { x, y, type, frame } = drop;
  const pulse = (Math.sin(frame * 0.15) + 1) / 2;

  if (type === 'weapon') {
    const col = VISUAL.COLOR_DROP_WEAPON;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 6 + pulse * 10;
    ctx.fillStyle   = col;
    ctx.globalAlpha = 0.7 + pulse * 0.3;

    ctx.fillRect(x - 2, y - 7, 4, 10);
    ctx.fillRect(x - 6, y - 3, 13, 3);
    ctx.fillRect(x - 4, y - 7, 9,  3);
  } else {
    const col = VISUAL.COLOR_DROP_HEART;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 6 + pulse * 10;
    ctx.fillStyle   = col;
    ctx.globalAlpha = 0.7 + pulse * 0.3;

    ctx.fillRect(x - 6, y - 4,  5, 4);
    ctx.fillRect(x + 1,  y - 4,  5, 4);
    ctx.fillRect(x - 7, y,       15, 4);
    ctx.fillRect(x - 5, y + 4,   11, 3);
    ctx.fillRect(x - 3, y + 7,   7,  2);
    ctx.fillRect(x - 1, y + 9,   3,  2);
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

// ── HUD Indicador ──────────────────────────────────────────────
export function drawWeaponIndicator(ctx, level, W, H) {
  const col = VISUAL.COLOR_DROP_WEAPON;
  ctx.shadowColor = col;
  ctx.fillStyle   = col;

  const startX = W - 20;
  const startY = H - 12;
  const spacing = 10;

  for (let i = 0; i < level; i++) {
    const ix = startX - i * spacing;
    ctx.shadowBlur = 4;
    ctx.fillRect(ix - 1, startY - 8, 3, 10);
    ctx.fillRect(ix - 3, startY - 2, 7, 2);
  }
  ctx.shadowBlur = 0;
}

// ── Boss ───────────────────────────────────────────────────────

/** Dispatcher: seleciona a função de desenho correta para cada wave de boss. */
const _BOSS_DRAW = {
  10:  _drawBoss10,
  20:  _drawBoss20,
  30:  _drawBoss30,
  40:  _drawBoss40,
  50:  _drawBoss50,
  60:  _drawBoss60,
  70:  _drawBoss70,
  80:  _drawBoss80,
  90:  _drawBoss90,
  100: _drawBoss100,
};

export function drawBoss(ctx, boss, frame, wave) {
  const { x, y } = boss;
  const W = boss.w || 119;
  const H = boss.h || 102;

  // Flash de hit (branco ao ser atingido)
  if (boss.flashTimer > 0) {
    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur  = 30;
    ctx.fillRect(x, y, W, H);
    ctx.shadowBlur  = 0;
    boss.flashTimer -= 16;
    if (boss.flashTimer < 0) boss.flashTimer = 0;
    return;
  }

  const pulse = (Math.sin(frame * 0.05) + 1) / 2;
  const drawFn = _BOSS_DRAW[wave] ?? _drawBoss10;
  drawFn(ctx, x, y, W, H, pulse);
  ctx.shadowBlur = 0;

  // Escudo (painéis flutuantes esverdeados)
  if (boss.shield > 0) drawBossShield(ctx, boss, frame);

  // Barra de HP
  const barY     = y - 14;
  const hpRatio  = Math.max(0, boss.hp / boss.maxHp);
  ctx.fillStyle  = '#333';
  ctx.fillRect(x, barY, W, 6);
  const hpCol    = hpRatio > 0.5 ? '#00ff88' : hpRatio > 0.25 ? '#ffaa00' : '#ff3355';
  ctx.fillStyle  = hpCol;
  ctx.shadowColor = hpCol;
  ctx.shadowBlur  = 6;
  ctx.fillRect(x, barY, W * hpRatio, 6);
  ctx.shadowBlur = 0;
}

// ── Wave 10 — Alien Laranja ──────────────────────────────────
function _drawBoss10(ctx, x, y, W, H, pulse) {
  ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 18 + pulse * 18;
  ctx.fillStyle = '#cc2200';
  ctx.fillRect(x + 10, y + 5,    W - 20, H - 25);
  ctx.fillRect(x,      y + 18,   W,      H - 48);
  ctx.fillRect(x + 22, y + H-22, W - 44, 22);
  ctx.fillStyle = '#ff5500';
  ctx.fillRect(x + 20, y + 12,   W - 40, H - 38);
  ctx.fillRect(x + 42, y,        W - 84, 16);
  // Olhos raivosos
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
  ctx.fillRect(x + 20, y + 27, 18, 13);
  ctx.fillRect(x + W-38, y + 27, 18, 13);
  ctx.fillStyle = '#ff3300';
  ctx.fillRect(x + 18, y + 24, 22, 3);
  ctx.fillRect(x + W-40, y + 24, 22, 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 23, y + 29, 11, 9);
  ctx.fillRect(x + W-34, y + 29, 11, 9);
  // Boca
  ctx.fillStyle = '#ffaa00'; ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8 + pulse * 8;
  ctx.fillRect(x + W/2-16, y + H-26, 32, 6);
  ctx.fillRect(x + W/2-10, y + H-20, 20, 5);
}

// ── Wave 20 — Alien Laranja com Chifre ──────────────────────
function _drawBoss20(ctx, x, y, W, H, pulse) {
  ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 18 + pulse * 18;
  // Chifre central
  ctx.fillStyle = '#ff6600';
  ctx.fillRect(x + W/2 - 7, y - 22, 14, 24);
  ctx.fillRect(x + W/2 - 4, y - 32, 8,  12);
  ctx.fillRect(x + W/2 - 2, y - 40, 4,  10);
  // Corpo (igual ao boss 10)
  ctx.fillStyle = '#cc2200';
  ctx.fillRect(x + 10, y + 5,    W - 20, H - 25);
  ctx.fillRect(x,      y + 18,   W,      H - 48);
  ctx.fillRect(x + 22, y + H-22, W - 44, 22);
  ctx.fillStyle = '#ff5500';
  ctx.fillRect(x + 20, y + 12,   W - 40, H - 38);
  ctx.fillRect(x + 42, y,        W - 84, 16);
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
  ctx.fillRect(x + 20, y + 27, 18, 13);
  ctx.fillRect(x + W-38, y + 27, 18, 13);
  ctx.fillStyle = '#ff3300';
  ctx.fillRect(x + 18, y + 24, 22, 3);
  ctx.fillRect(x + W-40, y + 24, 22, 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 23, y + 29, 11, 9);
  ctx.fillRect(x + W-34, y + 29, 11, 9);
  ctx.fillStyle = '#ffaa00'; ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8 + pulse * 8;
  ctx.fillRect(x + W/2-16, y + H-26, 32, 6);
  ctx.fillRect(x + W/2-10, y + H-20, 20, 5);
}

// ── Wave 30 — Alien Laranja com Chifre e Pinças ─────────────
function _drawBoss30(ctx, x, y, W, H, pulse) {
  ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 18 + pulse * 18;
  // Chifre
  ctx.fillStyle = '#ff6600';
  ctx.fillRect(x + W/2 - 7, y - 22, 14, 24);
  ctx.fillRect(x + W/2 - 4, y - 32, 8,  12);
  ctx.fillRect(x + W/2 - 2, y - 40, 4,  10);
  // Pinças laterais
  ctx.fillStyle = '#cc3300';
  ctx.fillRect(x - 18, y + 28, 20, 12);
  ctx.fillRect(x - 24, y + 22, 10, 9);
  ctx.fillRect(x - 24, y + 36, 10, 9);
  ctx.fillRect(x + W - 2, y + 28, 20, 12);
  ctx.fillRect(x + W + 14, y + 22, 10, 9);
  ctx.fillRect(x + W + 14, y + 36, 10, 9);
  // Corpo
  ctx.fillStyle = '#cc2200';
  ctx.fillRect(x + 10, y + 5,    W - 20, H - 25);
  ctx.fillRect(x,      y + 18,   W,      H - 48);
  ctx.fillRect(x + 22, y + H-22, W - 44, 22);
  ctx.fillStyle = '#ff5500';
  ctx.fillRect(x + 20, y + 12,   W - 40, H - 38);
  ctx.fillRect(x + 42, y,        W - 84, 16);
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
  ctx.fillRect(x + 20, y + 27, 18, 13);
  ctx.fillRect(x + W-38, y + 27, 18, 13);
  ctx.fillStyle = '#ff3300';
  ctx.fillRect(x + 18, y + 24, 22, 3);
  ctx.fillRect(x + W-40, y + 24, 22, 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 23, y + 29, 11, 9);
  ctx.fillRect(x + W-34, y + 29, 11, 9);
  ctx.fillStyle = '#ffaa00'; ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 8 + pulse * 8;
  ctx.fillRect(x + W/2-16, y + H-26, 32, 6);
  ctx.fillRect(x + W/2-10, y + H-20, 20, 5);
}

// ── Wave 40 — Caranguejo Azul ────────────────────────────────
function _drawBoss40(ctx, x, y, W, H, pulse) {
  ctx.shadowColor = '#2244ff'; ctx.shadowBlur = 18 + pulse * 18;
  // Garras
  ctx.fillStyle = '#0a1a99';
  ctx.fillRect(x - 22, y + 22, 24, 14);
  ctx.fillRect(x - 28, y + 17, 12, 10);
  ctx.fillRect(x - 28, y + 32, 12, 10);
  ctx.fillRect(x + W - 2, y + 22, 24, 14);
  ctx.fillRect(x + W + 16, y + 17, 12, 10);
  ctx.fillRect(x + W + 16, y + 32, 12, 10);
  // Carapaça
  ctx.fillStyle = '#0a1a99';
  ctx.fillRect(x + 15, y + 18, W - 30, H - 35);
  ctx.fillRect(x + 30, y + 8,  W - 60, 14);
  ctx.fillRect(x + 5,  y + 30, W - 10, H - 55);
  ctx.fillStyle = '#2244cc';
  ctx.fillRect(x + 25, y + 16, W - 50, 22);
  ctx.fillStyle = '#3355ff';
  ctx.fillRect(x + 34, y + 20, W - 68, 12);
  // Pedúnculos oculares
  ctx.fillStyle = '#0a1a99';
  ctx.fillRect(x + 36, y + 4,  7, 16);
  ctx.fillRect(x + W-43, y + 4, 7, 16);
  ctx.fillStyle = '#ff2222'; ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 10;
  ctx.fillRect(x + 32, y,     14, 8);
  ctx.fillRect(x + W-46, y,   14, 8);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 35, y + 1, 6, 6);
  ctx.fillRect(x + W-41, y + 1, 6, 6);
}

// ── Wave 50 — Caranguejo Amarelo ─────────────────────────────
function _drawBoss50(ctx, x, y, W, H, pulse) {
  ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 18 + pulse * 18;
  ctx.fillStyle = '#996600';
  ctx.fillRect(x - 22, y + 22, 24, 14);
  ctx.fillRect(x - 28, y + 17, 12, 10);
  ctx.fillRect(x - 28, y + 32, 12, 10);
  ctx.fillRect(x + W - 2, y + 22, 24, 14);
  ctx.fillRect(x + W + 16, y + 17, 12, 10);
  ctx.fillRect(x + W + 16, y + 32, 12, 10);
  ctx.fillStyle = '#996600';
  ctx.fillRect(x + 15, y + 18, W - 30, H - 35);
  ctx.fillRect(x + 30, y + 8,  W - 60, 14);
  ctx.fillRect(x + 5,  y + 30, W - 10, H - 55);
  ctx.fillStyle = '#ccaa00';
  ctx.fillRect(x + 25, y + 16, W - 50, 22);
  ctx.fillStyle = '#ffcc22';
  ctx.fillRect(x + 34, y + 20, W - 68, 12);
  ctx.fillStyle = '#996600';
  ctx.fillRect(x + 36, y + 4,  7, 16);
  ctx.fillRect(x + W-43, y + 4, 7, 16);
  ctx.fillStyle = '#ff2222'; ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 10;
  ctx.fillRect(x + 32, y,     14, 8);
  ctx.fillRect(x + W-46, y,   14, 8);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 35, y + 1, 6, 6);
  ctx.fillRect(x + W-41, y + 1, 6, 6);
}

// ── Wave 60 — Caranguejo Verde ───────────────────────────────
function _drawBoss60(ctx, x, y, W, H, pulse) {
  ctx.shadowColor = '#33cc44'; ctx.shadowBlur = 18 + pulse * 18;
  ctx.fillStyle = '#115500';
  ctx.fillRect(x - 22, y + 22, 24, 14);
  ctx.fillRect(x - 28, y + 17, 12, 10);
  ctx.fillRect(x - 28, y + 32, 12, 10);
  ctx.fillRect(x + W - 2, y + 22, 24, 14);
  ctx.fillRect(x + W + 16, y + 17, 12, 10);
  ctx.fillRect(x + W + 16, y + 32, 12, 10);
  ctx.fillStyle = '#115500';
  ctx.fillRect(x + 15, y + 18, W - 30, H - 35);
  ctx.fillRect(x + 30, y + 8,  W - 60, 14);
  ctx.fillRect(x + 5,  y + 30, W - 10, H - 55);
  ctx.fillStyle = '#1a7722';
  ctx.fillRect(x + 25, y + 16, W - 50, 22);
  ctx.fillStyle = '#33cc44';
  ctx.fillRect(x + 34, y + 20, W - 68, 12);
  ctx.fillStyle = '#115500';
  ctx.fillRect(x + 36, y + 4,  7, 16);
  ctx.fillRect(x + W-43, y + 4, 7, 16);
  ctx.fillStyle = '#ff2222'; ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 10;
  ctx.fillRect(x + 32, y,     14, 8);
  ctx.fillRect(x + W-46, y,   14, 8);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 35, y + 1, 6, 6);
  ctx.fillRect(x + W-41, y + 1, 6, 6);
}

// ── Wave 70 — Caranguejo Verde com Espinhos e Pinças ─────────
function _drawBoss70(ctx, x, y, W, H, pulse) {
  ctx.shadowColor = '#33cc44'; ctx.shadowBlur = 20 + pulse * 20;
  // Espinhos no topo
  ctx.fillStyle = '#228833';
  ctx.fillRect(x + 33, y - 10, 10, 14);
  ctx.fillRect(x + W/2 - 6, y - 18, 12, 22);
  ctx.fillRect(x + W - 43, y - 10, 10, 14);
  ctx.fillStyle = '#66ff88'; ctx.shadowColor = '#66ff88'; ctx.shadowBlur = 8;
  ctx.fillRect(x + 36, y - 12, 4, 5);
  ctx.fillRect(x + W/2 - 3, y - 21, 6, 5);
  ctx.fillRect(x + W - 40, y - 12, 4, 5);
  ctx.shadowColor = '#33cc44'; ctx.shadowBlur = 20 + pulse * 20;
  // Garras maiores
  ctx.fillStyle = '#115500';
  ctx.fillRect(x - 28, y + 18, 30, 16);
  ctx.fillRect(x - 36, y + 12, 14, 12);
  ctx.fillRect(x - 36, y + 30, 14, 12);
  ctx.fillRect(x + W - 2, y + 18, 30, 16);
  ctx.fillRect(x + W + 22, y + 12, 14, 12);
  ctx.fillRect(x + W + 22, y + 30, 14, 12);
  // Carapaça
  ctx.fillStyle = '#115500';
  ctx.fillRect(x + 15, y + 18, W - 30, H - 35);
  ctx.fillRect(x + 30, y + 8,  W - 60, 14);
  ctx.fillRect(x + 5,  y + 30, W - 10, H - 55);
  ctx.fillStyle = '#1a7722';
  ctx.fillRect(x + 25, y + 16, W - 50, 22);
  ctx.fillStyle = '#33cc44';
  ctx.fillRect(x + 34, y + 20, W - 68, 12);
  ctx.fillStyle = '#115500';
  ctx.fillRect(x + 36, y + 4,  7, 16);
  ctx.fillRect(x + W-43, y + 4, 7, 16);
  ctx.fillStyle = '#ff2222'; ctx.shadowColor = '#ff2222'; ctx.shadowBlur = 10;
  ctx.fillRect(x + 32, y,     14, 8);
  ctx.fillRect(x + W-46, y,   14, 8);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 35, y + 1, 6, 6);
  ctx.fillRect(x + W-41, y + 1, 6, 6);
}

// ── Wave 80 — Polvo Alaranjado ───────────────────────────────
function _drawBoss80(ctx, x, y, W, H, pulse) {
  ctx.shadowColor = '#ff6622'; ctx.shadowBlur = 18 + pulse * 18;
  // Tentáculos (4 pendurados abaixo)
  const tentY = y + H - 32;
  const tentXs = [x + 12, x + 34, x + 57, x + 79];
  for (const tx of tentXs) {
    ctx.fillStyle = '#aa3300';
    ctx.fillRect(tx, tentY, 14, 30);
    ctx.fillStyle = '#cc5522';
    ctx.fillRect(tx + 3, tentY + 4, 7, 20);
    ctx.fillStyle = '#aa3300';
    ctx.fillRect(tx - 3, tentY + 26, 20, 10);
  }
  // Domo da cabeça
  ctx.fillStyle = '#aa3300';
  ctx.fillRect(x + 18, y + 2,  W - 36, H - 38);
  ctx.fillRect(x + 30, y - 6,  W - 60, 14);
  ctx.fillRect(x + 10, y + 18, W - 20, H - 55);
  ctx.fillStyle = '#cc5522';
  ctx.fillRect(x + 28, y + 6,  W - 56, H - 52);
  ctx.fillStyle = '#ff8844';
  ctx.fillRect(x + 38, y + 10, W - 76, H - 68);
  // Olhos raivosos
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 14;
  ctx.fillRect(x + 20, y + 22, 24, 16);
  ctx.fillRect(x + W-44, y + 22, 24, 16);
  ctx.fillStyle = '#ff3300';
  ctx.fillRect(x + 18, y + 19, 28, 4);
  ctx.fillRect(x + W-46, y + 19, 28, 4);
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(x + 24, y + 26, 15, 10);
  ctx.fillRect(x + W-39, y + 26, 15, 10);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 28, y + 28, 7, 6);
  ctx.fillRect(x + W-35, y + 28, 7, 6);
}

// ── Wave 90 — Lula Cinzenta ──────────────────────────────────
function _drawBoss90(ctx, x, y, W, H, pulse) {
  ctx.shadowColor = '#aabbcc'; ctx.shadowBlur = 18 + pulse * 18;
  // Tentáculos (6)
  const sqY = y + H - 22;
  const sqXs = [x + 8, x + 24, x + 40, x + 56, x + 72, x + 88];
  for (const tx of sqXs) {
    ctx.fillStyle = '#445566';
    ctx.fillRect(tx, sqY, 9, 28);
    ctx.fillRect(tx - 2, sqY + 24, 13, 8);
    ctx.fillStyle = '#7788aa';
    ctx.fillRect(tx + 2, sqY + 2, 4, 18);
  }
  // Nadadeiras laterais
  ctx.fillStyle = '#445566';
  ctx.fillRect(x + 4,   y + 18, 18, 32);
  ctx.fillRect(x + W-22, y + 18, 18, 32);
  ctx.fillStyle = '#7788aa';
  ctx.fillRect(x + 7,   y + 22, 10, 24);
  ctx.fillRect(x + W-17, y + 22, 10, 24);
  // Manto/cabeça alongada
  ctx.fillStyle = '#445566';
  ctx.fillRect(x + 22, y + 2,  W - 44, H - 28);
  ctx.fillRect(x + 35, y - 12, W - 70, 18);
  ctx.fillRect(x + 12, y + 28, W - 24, H - 62);
  ctx.fillStyle = '#7788aa';
  ctx.fillRect(x + 32, y + 8,  W - 64, H - 50);
  ctx.fillStyle = '#aabbcc';
  ctx.fillRect(x + 42, y + 12, W - 84, H - 66);
  // Olhos raivosos
  ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
  ctx.fillRect(x + 25, y + 30, 22, 15);
  ctx.fillRect(x + W-47, y + 30, 22, 15);
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(x + 23, y + 26, 28, 5);
  ctx.fillRect(x + W-51, y + 26, 28, 5);
  ctx.fillStyle = '#cc0000';
  ctx.fillRect(x + 28, y + 33, 15, 9);
  ctx.fillRect(x + W-43, y + 33, 15, 9);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 32, y + 35, 6, 5);
  ctx.fillRect(x + W-38, y + 35, 6, 5);
}

// ── Wave 100 — Morcego (Boss Final) ─────────────────────────
function _drawBoss100(ctx, x, y, W, H, pulse) {
  ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 25 + pulse * 20;
  // Asas (estendem-se além do hitbox)
  ctx.fillStyle = '#2a0808';
  ctx.fillRect(x - 35, y + 8,  40, 8);
  ctx.fillRect(x - 35, y + 8,  8,  42);
  ctx.fillRect(x - 30, y + 46, 35, 8);
  ctx.fillRect(x - 5,  y + 14, 20, 36);
  ctx.fillRect(x + W - 5, y + 8,  40, 8);
  ctx.fillRect(x + W + 27, y + 8,  8,  42);
  ctx.fillRect(x + W - 5, y + 46, 35, 8);
  ctx.fillRect(x + W - 15, y + 14, 20, 36);
  // Destaque vermelho nas asas
  ctx.fillStyle = '#550000';
  ctx.fillRect(x - 28, y + 12, 24, 5);
  ctx.fillRect(x + W + 4, y + 12, 24, 5);
  // Orelhas pontiagudas
  ctx.fillStyle = '#220000';
  ctx.fillRect(x + 28, y - 16, 14, 22);
  ctx.fillRect(x + W-42, y - 16, 14, 22);
  ctx.fillStyle = '#cc1100';
  ctx.fillRect(x + 31, y - 13, 7, 16);
  ctx.fillRect(x + W-38, y - 13, 7, 16);
  // Corpo central
  ctx.fillStyle = '#220000';
  ctx.fillRect(x + 22, y + 4,  W - 44, H - 18);
  ctx.fillRect(x + 36, y,      W - 72, 10);
  ctx.fillStyle = '#440000';
  ctx.fillRect(x + 32, y + 10, W - 64, H - 35);
  ctx.fillStyle = '#660000';
  ctx.fillRect(x + 42, y + 16, W - 84, H - 50);
  // Marcações laranja/vermelhas no peito
  ctx.fillStyle = '#ff4400'; ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 8 + pulse * 6;
  ctx.fillRect(x + W/2-22, y + H-38, 44, 5);
  ctx.fillRect(x + W/2-16, y + H-31, 32, 4);
  ctx.fillRect(x + W/2-10, y + H-25, 20, 4);
  // Olhos amarelos ferozes
  ctx.fillStyle = '#ffcc00'; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 15 + pulse * 10;
  ctx.fillRect(x + 30, y + 20, 22, 14);
  ctx.fillRect(x + W-52, y + 20, 22, 14);
  ctx.fillStyle = '#ff7700';
  ctx.fillRect(x + 28, y + 17, 26, 4);
  ctx.fillRect(x + W-54, y + 17, 26, 4);
  ctx.fillStyle = '#000';
  ctx.fillRect(x + 34, y + 22, 12, 10);
  ctx.fillRect(x + W-46, y + 22, 12, 10);
  // Borda neon para boss final
  ctx.strokeStyle = '#ff4400';
  ctx.lineWidth   = 2;
  ctx.shadowColor = '#ff4400';
  ctx.shadowBlur  = 20 + pulse * 15;
  ctx.strokeRect(x + 18, y + 2, W - 36, H - 16);
}

// ── Escudo — 3 painéis flutuantes esverdeados ────────────────
function drawBossShield(ctx, boss, frame) {
  const pulse = (Math.sin(frame * 0.08) + 1) / 2;
  const float = Math.sin(frame * 0.05) * 5;
  const alpha = 0.55 + pulse * 0.35;
  const W  = boss.w || 119;
  const H  = boss.h || 102;
  const cx = boss.x + W / 2;
  const cy = boss.y + H / 2;

  ctx.shadowColor = '#33ff88';
  ctx.shadowBlur  = 14 + pulse * 10;

  // Painel superior (horizontal, centralizado)
  const topW = Math.round(W * 0.52);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#00cc66';
  ctx.fillRect(cx - topW / 2, boss.y - 20 + float, topW, 7);
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = '#88ffbb';
  ctx.fillRect(cx - topW / 2 + 2, boss.y - 19 + float, topW - 4, 2);

  // Painel esquerdo (vertical)
  const sideH = Math.round(H * 0.45);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#00cc66';
  ctx.fillRect(boss.x - 20 - float * 0.5, cy - sideH / 2, 7, sideH);
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = '#88ffbb';
  ctx.fillRect(boss.x - 19 - float * 0.5, cy - sideH / 2 + 2, 2, sideH - 4);

  // Painel direito (vertical)
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#00cc66';
  ctx.fillRect(boss.x + W + 13 + float * 0.5, cy - sideH / 2, 7, sideH);
  ctx.globalAlpha = alpha * 0.5;
  ctx.fillStyle = '#88ffbb';
  ctx.fillRect(boss.x + W + 14 + float * 0.5, cy - sideH / 2 + 2, 2, sideH - 4);

  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

// ── Utilitário ────────────────────────────────────────────────
function lerpColor(colA, colB, t) {
  const a = hexToRgb(colA);
  const b = hexToRgb(colB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
