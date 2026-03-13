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
export function drawBoss(ctx, boss, frame, wave) {
  const { x, y } = boss;
  const W = boss.w || 119;
  const H = boss.h || 102;
  const pulse = (Math.sin(frame * 0.05) + 1) / 2;

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

  // Glow pulsante externo
  const glowColor = boss.neon ? '#00ffcc' : '#ff4400';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur  = 20 + pulse * 20;

  // Corpo principal do boss (pixel-art escalado ~3.5x)
  ctx.fillStyle = boss.neon ? '#00ccaa' : '#cc2200';
  ctx.fillRect(x + 10, y,        W - 20, H - 20);
  ctx.fillRect(x,      y + 15,   W,      H - 40);
  ctx.fillRect(x + 20, y + H - 25, W - 40, 25);

  ctx.fillStyle = boss.neon ? '#00ffee' : '#ff5500';
  ctx.fillRect(x + 20, y + 10,   W - 40, H - 30);
  ctx.fillRect(x + 40, y,        W - 80, 20);

  // Olhos do boss
  ctx.fillStyle   = '#ffffff';
  ctx.shadowBlur  = 15;
  ctx.shadowColor = '#ffffff';
  ctx.fillRect(x + 22, y + 25, 16, 14);
  ctx.fillRect(x + W - 38, y + 25, 16, 14);
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 25, y + 28, 10, 8);
  ctx.fillRect(x + W - 35, y + 28, 10, 8);

  // Detalhe central (boca/núcleo)
  ctx.fillStyle   = boss.neon ? '#00ffcc' : '#ffaa00';
  ctx.shadowColor = boss.neon ? '#00ffcc' : '#ffaa00';
  ctx.shadowBlur  = 10 + pulse * 10;
  ctx.fillRect(x + W/2 - 15, y + H - 30, 30, 8);
  ctx.fillRect(x + W/2 - 8,  y + H - 22, 16, 5);

  // Efeito neon especial para wave 100
  if (boss.neon) {
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth   = 2;
    ctx.shadowColor = '#00ffcc';
    ctx.shadowBlur  = 25 + pulse * 15;
    ctx.strokeRect(x + 4, y + 4, W - 8, H - 8);
    ctx.strokeRect(x + 12, y + 12, W - 24, H - 24);
  }

  ctx.shadowBlur = 0;

  // Escudo
  if (boss.shield > 0) drawBossShield(ctx, boss, frame);

  // Barra de HP
  const barW = W;
  const barH = 6;
  const barY = y - 14;
  const hpRatio = Math.max(0, boss.hp / boss.maxHp);
  ctx.fillStyle = '#333';
  ctx.fillRect(x, barY, barW, barH);
  const hpCol = hpRatio > 0.5 ? '#00ff88' : hpRatio > 0.25 ? '#ffaa00' : '#ff3355';
  ctx.fillStyle   = hpCol;
  ctx.shadowColor = hpCol;
  ctx.shadowBlur  = 6;
  ctx.fillRect(x, barY, barW * hpRatio, barH);
  ctx.shadowBlur = 0;
}

function drawBossShield(ctx, boss, frame) {
  const pulse = (Math.sin(frame * 0.08) + 1) / 2;
  const shieldAlpha = 0.4 + pulse * 0.4;
  ctx.globalAlpha = shieldAlpha;
  ctx.strokeStyle = '#00ffff';
  ctx.shadowColor = '#00ffff';
  ctx.shadowBlur  = 15 + pulse * 10;
  ctx.lineWidth   = 3;
  const sx = boss.x - 8;
  const sy = boss.y - 8;
  const sw = (boss.w || 119) + 16;
  const sh = (boss.h || 102) + 16;
  ctx.strokeRect(sx, sy, sw, sh);
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
