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

  // ── HP buff (valores com enemyHP=1, hpMult direto) ──────────

  it('wave 10 deve ter hpMult 20 (buff ×2.0)', () => {
    createBoss(10, BOSS_CONFIGS);
    expect(state.boss.active).toBe(true);
    expect(state.boss.introAnim).toBe(true);
    expect(state.boss.hp).toBe(20);
    expect(state.boss.maxHp).toBe(20);
    expect(state.boss.shield).toBe(0);
    expect(state.boss.neon).toBe(false);
  });

  it('wave 20 deve ter hpMult 23 (buff ×1.9)', () => {
    state.wave = 20;
    createBoss(20, BOSS_CONFIGS);
    expect(state.boss.hp).toBe(23);
  });

  it('wave 30 deve ter hpMult 27 (buff ×1.9)', () => {
    state.wave = 30;
    createBoss(30, BOSS_CONFIGS);
    expect(state.boss.hp).toBe(27);
  });

  it('wave 40 deve ter hpMult 27 (buff ×1.8)', () => {
    state.wave = 40;
    createBoss(40, BOSS_CONFIGS);
    expect(state.boss.hp).toBe(27);
  });

  it('wave 70 deve ter hpMult 34 (buff ×1.7)', () => {
    state.wave = 70;
    createBoss(70, BOSS_CONFIGS);
    expect(state.boss.hp).toBe(34);
  });

  it('wave 80 deve ter hpMult 32 (buff ×1.6)', () => {
    state.wave = 80;
    createBoss(80, BOSS_CONFIGS);
    expect(state.boss.hp).toBe(32);
  });

  it('wave 90 deve ter hpMult 32 (buff ×1.6)', () => {
    state.wave = 90;
    createBoss(90, BOSS_CONFIGS);
    expect(state.boss.hp).toBe(32);
  });

  it('wave 100 deve ter hpMult 31 (buff ×1.4) e neon ativo', () => {
    state.wave = 100;
    createBoss(100, BOSS_CONFIGS);
    expect(state.boss.hp).toBe(31);
    expect(state.boss.neon).toBe(true);
  });

  // ── Escudo com buff ×1.5 ────────────────────────────────────

  it('wave 50 deve ter 8 escudos (buff ×1.5)', () => {
    state.wave = 50;
    createBoss(50, BOSS_CONFIGS);
    expect(state.boss.shield).toBe(8);
  });

  it('wave 60 deve ter 8 escudos (buff ×1.5)', () => {
    state.wave = 60;
    createBoss(60, BOSS_CONFIGS);
    expect(state.boss.shield).toBe(8);
  });

  it('apenas waves 50 e 60 possuem escudo', () => {
    const shieldWaves    = [50, 60];
    const noShieldWaves  = [10, 20, 30, 40, 70, 80, 90, 100];

    for (const w of shieldWaves) {
      state.wave = w;
      createBoss(w, BOSS_CONFIGS);
      expect(state.boss.shield, `wave ${w}`).toBeGreaterThan(0);
    }
    for (const w of noShieldWaves) {
      state.wave = w;
      createBoss(w, BOSS_CONFIGS);
      expect(state.boss.shield, `wave ${w}`).toBe(0);
    }
  });

  // ── hpMult deve crescer progressivamente entre waves ────────

  it('hpMult deve ser maior em waves avançadas do que em waves iniciais', () => {
    expect(BOSS_CONFIGS[70].hpMult).toBeGreaterThan(BOSS_CONFIGS[10].hpMult);
    expect(BOSS_CONFIGS[80].hpMult).toBeGreaterThan(BOSS_CONFIGS[20].hpMult);
  });

  // ── HP escala proporcionalmente com enemyHP ─────────────────

  it('HP do boss escala com enemyHP do cfg', () => {
    state.cfg = { enemyHP: 2 };
    createBoss(10, BOSS_CONFIGS);
    expect(state.boss.hp).toBe(BOSS_CONFIGS[10].hpMult * 2);
  });

  // ── Posição de spawn ─────────────────────────────────────────

  it('boss deve aparecer fora da tela (esquerda ou direita)', () => {
    createBoss(10, BOSS_CONFIGS);
    if (state.boss.side === 'left') {
      expect(state.boss.x).toBe(-PHYSICS.BOSS_W);
    } else {
      expect(state.boss.x).toBe(PHYSICS.CANVAS_W);
    }
  });
});
