import { VISUAL, PHYSICS } from './config.js';

// ── Helpers de cor ───────────────────────────────────────────
export function enemyColor(row) {
  if (row < 1) return VISUAL.COLOR_ENEMY_A;
  if (row < 3) return VISUAL.COLOR_ENEMY_B;
  return VISUAL.COLOR_ENEMY_C;
}

// ── Player ───────────────────────────────────────────────────
export function drawPlayer(ctx, x, y) {
  ctx.shadowColor = VISUAL.COLOR_PLAYER_GLOW;
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = VISUAL.COLOR_PLAYER;

  ctx.fillRect(x + 10, y + 8,  6, 18);   // fuselagem
  ctx.fillRect(x + 2,  y + 16, 8,  6);   // asa esquerda
  ctx.fillRect(x + 16, y + 16, 8,  6);   // asa direita
  ctx.fillRect(x + 11, y + 2,  4,  8);   // nariz
  ctx.fillRect(x + 12, y,      2,  4);   // ponta

  // Thruster animado
  ctx.fillStyle = `rgba(255,200,50,0.85)`;
  ctx.fillRect(x + 11, y + 26, 4, Math.floor(Math.random() * 7) + 2);

  ctx.shadowBlur = 0;
}

// ── Enemy (normal e elite) ───────────────────────────────────
export function drawEnemy(ctx, x, y, row, hp, maxHp, frame, isElite = false) {
  const baseCol = enemyColor(row);
  const t       = Math.floor(frame * 0.05) % 2;

  // Elite: pulsa entre a cor base e dourado
  let col = baseCol;
  if (isElite) {
    const pulse = (Math.sin(frame * 0.12) + 1) / 2;  // 0–1
    col = lerpColor(baseCol, VISUAL.COLOR_ELITE_PULSE, 0.4 + pulse * 0.6);
  }

  ctx.shadowColor = col;
  ctx.shadowBlur  = isElite ? 14 : 7;
  ctx.fillStyle   = col;

  // ── Sprites pixel art por row ────────────────────────────
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
