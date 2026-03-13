import { describe, it, expect, beforeEach } from 'vitest';
import { createBoss } from '../src/game/helpers.js';
import { state } from '../src/game/state.js';
import { BOSS_CONFIGS, PHYSICS } from '../src/game/config.js';

describe('Boss System', () => {
  beforeEach(() => {
    state.enemies = [];
    state.wave = 10;
    state.cfg = { enemyHP: 1 };
  });

  it('should initialize boss correctly for wave 10', () => {
    createBoss(10, BOSS_CONFIGS);
    expect(state.boss.active).toBe(true);
    expect(state.boss.introAnim).toBe(true);
    expect(state.boss.hp).toBe(10); // 10 * 1
    expect(state.boss.maxHp).toBe(10);
    expect(state.boss.shield).toBe(0);
    expect(state.boss.neon).toBe(false);
  });

  it('should initialize boss correctly for wave 100 with neon and high HP', () => {
    state.wave = 100;
    createBoss(100, BOSS_CONFIGS);
    expect(state.boss.hp).toBe(22);
    expect(state.boss.neon).toBe(true);
  });

  it('should spawn boss at correct side position', () => {
    createBoss(10, BOSS_CONFIGS);
    if (state.boss.side === 'left') {
      expect(state.boss.x).toBe(-PHYSICS.BOSS_W);
    } else {
      expect(state.boss.x).toBe(PHYSICS.CANVAS_W);
    }
  });

  it('should have 5 shields for wave 50', () => {
    state.wave = 50;
    createBoss(50, BOSS_CONFIGS);
    expect(state.boss.shield).toBe(5);
  });
});
