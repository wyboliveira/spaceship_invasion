import { state, updateState } from './state.js';
import { PHYSICS, SCORING, VISUAL, WEAPON } from './config.js';
import { keys } from './input.js';
import { enemyColor } from './sprites.js';
import { spawnParticles, spawnDrop } from './helpers.js';
import { getBulletPattern, applyWeaponPenalty, resolveDropType } from './weapons.js';

export function update(dt, ts, GameCallbacks) {
  const cfg = state.cfg;
  if (!cfg) return;

  const W = PHYSICS.CANVAS_W;
  const H = PHYSICS.CANVAS_H;

  // ── Movimento do jogador ──────────────────────────────────
  if (keys['ArrowLeft']  || keys['KeyA']) state.player.x -= cfg.playerSpeed;
  if (keys['ArrowRight'] || keys['KeyD']) state.player.x += cfg.playerSpeed;
  state.player.x = Math.max(0, Math.min(W - state.player.w, state.player.x));

  // ── Tiro do jogador ───────────────────────────────────────
  const canFire =
    state.bullets.length < cfg.playerMaxBullets &&
    ts - state.lastFire > cfg.playerFireCooldown;

  if ((keys['Space'] || keys['ArrowUp']) && canFire) {
    state.lastFire = ts;
    const pattern = getBulletPattern(
      state.weaponLevel,
      state.player.x,
      state.player.y,
      cfg.playerBulletSpd,
    );
    state.bullets.push(...pattern);
  }

  // ── Balas do jogador — movimento e colisões ───────────────
  state.bullets = state.bullets.filter(b => {
    b.x += b.vx || 0;
    b.y += b.vy;
    if (b.y < 0 || b.x < 0 || b.x > W) return false;

    // Colisão com inimigos
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (
        b.x > e.x && b.x < e.x + PHYSICS.ENEMY_W &&
        b.y > e.y && b.y < e.y + PHYSICS.ENEMY_H
      ) {
        e.hp -= b.damage || 1;
        const col = enemyColor(e.row);

        if (e.hp <= 0) {
          e.alive = false;
          const pts = (SCORING.POINTS_BY_ROW[e.row] ?? 10) * state.wave;
          state.score += e.elite ? pts * SCORING.ELITE_MULTIPLIER : pts;

          spawnParticles(e.x + 13, e.y + 11, col, 16);

          // Drop de elite
          if (e.elite) {
            const dropType = resolveDropType(state.weaponLevel);
            spawnDrop(e.x + PHYSICS.ENEMY_W / 2, e.y + PHYSICS.ENEMY_H, dropType);
          }
        } else {
          spawnParticles(e.x + 13, e.y + 11, col, 5);
        }

        GameCallbacks.updateHUD();
        return false;
      }
    }

    // Colisão com escudos
    for (const sh of state.shields) {
      for (const bl of sh.blocks) {
        if (bl.hp <= 0) continue;
        const bx = sh.x + bl.c * PHYSICS.SHIELD_BLOCK_SZ;
        const by = sh.y + bl.r * PHYSICS.SHIELD_BLOCK_SZ;
        if (
          b.x >= bx && b.x <= bx + PHYSICS.SHIELD_BLOCK_SZ &&
          b.y >= by && b.y <= by + PHYSICS.SHIELD_BLOCK_SZ
        ) {
          bl.hp--;
          return false;
        }
      }
    }

    return true;
  });

  // ── Movimento lateral dos inimigos ────────────────────────
  const alive      = state.enemies.filter(e => e.alive);
  const speedMul   = 1 + (1 - alive.length / (state.enemies.length || 1)) * 2.2;
  state.enemyMoveTimer += dt;

  if (state.enemyMoveTimer >= PHYSICS.ENEMY_MOVE_BASE / (cfg.enemySpeed * speedMul)) {
    state.enemyMoveTimer = 0;
    const step = 10 * state.enemyDir;
    let hit = false;
    for (const e of alive) {
      if (e.x + step < 4 || e.x + step + PHYSICS.ENEMY_W > W - 4) {
        hit = true; break;
      }
    }
    if (hit) {
      state.enemyDir *= -1;
      for (const e of alive) e.y += cfg.enemyDropStep;
    } else {
      for (const e of alive) e.x += step;
    }
  }

  // ── Tiro dos inimigos ─────────────────────────────────────
  state.enemyFireTimer += dt;
  if (state.enemyFireTimer >= 1000 / cfg.enemyFireRate && alive.length > 0) {
    state.enemyFireTimer = 0;
    const shooter = alive[Math.floor(Math.random() * alive.length)];
    state.eBullets.push({
      x:  shooter.x + PHYSICS.ENEMY_W / 2,
      y:  shooter.y + PHYSICS.ENEMY_H,
      vy: cfg.enemyBulletSpd,
    });
  }

  // ── Balas inimigas — movimento e colisões ─────────────────
  state.eBullets = state.eBullets.filter(b => {
    b.y += b.vy;
    if (b.y > H) return false;

    // Colisão com jogador
    if (
      b.x > state.player.x + 4 && b.x < state.player.x + state.player.w - 4 &&
      b.y > state.player.y     && b.y < state.player.y + state.player.h
    ) {
      onPlayerHit(GameCallbacks);
      return false;
    }

    // Colisão com escudos
    for (const sh of state.shields) {
      for (const bl of sh.blocks) {
        if (bl.hp <= 0) continue;
        const bx = sh.x + bl.c * PHYSICS.SHIELD_BLOCK_SZ;
        const by = sh.y + bl.r * PHYSICS.SHIELD_BLOCK_SZ;
        if (
          b.x >= bx && b.x <= bx + PHYSICS.SHIELD_BLOCK_SZ &&
          b.y >= by && b.y <= by + PHYSICS.SHIELD_BLOCK_SZ
        ) {
          bl.hp--;
          return false;
        }
      }
    }

    return true;
  });

  // ── Drops — queda e coleta ────────────────────────────────
  state.drops = state.drops.filter(drop => {
    drop.y    += drop.vy;
    drop.frame++;

    if (drop.y > H) return false;

    if (
      drop.x > state.player.x - 16 && drop.x < state.player.x + state.player.w + 16 &&
      drop.y > state.player.y       && drop.y < state.player.y + state.player.h
    ) {
      collectDrop(drop, GameCallbacks);
      return false;
    }

    return true;
  });

  // ── Derrota por invasão ───────────────────────────────────
  for (const e of alive) {
    if (e.y + PHYSICS.ENEMY_H >= state.player.y) {
      GameCallbacks.triggerGameOver();
      return;
    }
  }

  // ── Vitória ───────────────────────────────────────────────
  if (alive.length === 0) {
    state.score += cfg.bonusPoints || 0;
    GameCallbacks.updateHUD();
    GameCallbacks.showWaveClear();
    return;
  }

  // ── Partículas ────────────────────────────────────────────
  state.particles = state.particles.filter(p => {
    p.x   += p.vx;
    p.y   += p.vy;
    p.vy  += PHYSICS.PARTICLE_GRAVITY;
    p.life -= PHYSICS.PARTICLE_DECAY;
    return p.life > 0;
  });

  if (state.flashTimer > 0) state.flashTimer -= dt;
}

function onPlayerHit(GameCallbacks) {
  state.lives--;
  state.flashTimer = VISUAL.HIT_FLASH_DURATION;
  state.weaponLevel = applyWeaponPenalty(state.weaponLevel);

  spawnParticles(state.player.x + 13, state.player.y + 14, VISUAL.COLOR_PARTICLE_PLR, 20);
  GameCallbacks.updateHUD();

  if (state.lives <= 0) {
    GameCallbacks.triggerGameOver();
  } else {
    state.player.x = PHYSICS.CANVAS_W / 2 - PHYSICS.PLAYER_W / 2;
  }
}

function collectDrop(drop, GameCallbacks) {
  if (drop.type === 'weapon') {
    if (state.weaponLevel < WEAPON.MAX_LEVEL) {
      state.weaponLevel++;
      spawnParticles(drop.x, drop.y, VISUAL.COLOR_DROP_WEAPON, 10);
    }
  } else if (drop.type === 'heart') {
    const maxLives = state.cfg?.playerLives ?? 5;
    if (state.lives < maxLives) {
      state.lives++;
      spawnParticles(drop.x, drop.y, VISUAL.COLOR_DROP_HEART, 10);
    } else {
      state.score += SCORING.DROP_HEART_BONUS;
    }
  }
  GameCallbacks.updateHUD();
}
