import { PHYSICS } from './config.js';
import { state } from './state.js';

export function createEnemies(cfg) {
  const out = [];
  for (let r = 0; r < cfg.enemyRows; r++) {
    for (let c = 0; c < cfg.enemyCols; c++) {
      const isElite = Math.random() < (cfg.eliteChance ?? 0);
      out.push({
        x:      PHYSICS.ENEMY_START_X + c * PHYSICS.ENEMY_SPACING_X,
        y:      PHYSICS.ENEMY_START_Y + r * PHYSICS.ENEMY_SPACING_Y,
        row:    r,
        col:    c,
        hp:     isElite ? cfg.enemyHP * 2 : cfg.enemyHP,
        maxHp:  isElite ? cfg.enemyHP * 2 : cfg.enemyHP,
        alive:  true,
        elite:  isElite,
      });
    }
  }
  return out;
}

export function createShields(cfg) {
  if (!cfg.shieldsEnabled) return [];

  const shields = [];
  const bSz = PHYSICS.SHIELD_BLOCK_SZ;
  const BW = 5, BH = 3;
  const W = PHYSICS.CANVAS_W, H = PHYSICS.CANVAS_H;

  for (let s = 0; s < PHYSICS.SHIELD_COUNT; s++) {
    const sw = BW * bSz;
    const sx = 55 + s * ((W - 110) / (PHYSICS.SHIELD_COUNT - 1)) - sw / 2;
    const sy = H - PHYSICS.SHIELD_Y_OFFSET;
    const blocks = [];

    for (let r = 0; r < BH; r++) {
      for (let c = 0; c < BW; c++) {
        if (r === BH - 1 && c >= 1 && c <= BW - 2) continue;
        blocks.push({ c, r, hp: PHYSICS.SHIELD_BLOCK_HP });
      }
    }
    shields.push({ x: sx, y: sy, blocks });
  }
  return shields;
}

export function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const a   = (Math.PI * 2 / count) * i + Math.random() * 0.4;
    const spd = Math.random() * 3 + 1;
    state.particles.push({
      x, y,
      vx:    Math.cos(a) * spd,
      vy:    Math.sin(a) * spd,
      life:  1,
      color,
      r:     Math.random() * 2.5 + 1,
    });
  }
}

export function spawnDrop(x, y, type) {
  state.drops.push({
    x,
    y,
    type,
    vy:    1.8,
    frame: 0,
  });
}
