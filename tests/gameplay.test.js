import { describe, it, expect } from 'vitest';
import { getBulletPattern } from '../src/game/weapons.js';
import { getWaveConfig, WAVE_BANDS } from '../src/game/config.js';

describe('Weapon Systems', () => {
  it('should generate a single straight bullet for level 1', () => {
    const bullets = getBulletPattern(1, 100, 100, 10);
    expect(bullets.length).toBe(1);
    expect(bullets[0].vx).toBe(0);
    expect(bullets[0].vy).toBe(-10);
    expect(bullets[0].angled).toBe(false);
  });

  it('should generate 5 bullets for level 5 including 4 angled ones now', () => {
    const bullets = getBulletPattern(5, 100, 100, 10);
    expect(bullets.length).toBe(5);
    // Angles: -8, -4, 0, 4, 8. Only 0 is not angled.
    const straight = bullets.filter(b => !b.angled);
    const angled = bullets.filter(b => b.angled);
    expect(straight.length).toBe(1);
    expect(angled.length).toBe(4);
    
    // Verify velocities match the angles approx
    // -8 deg: vx should be negative
    expect(bullets[0].vx).toBeLessThan(0);
    // +8 deg: vx should be positive
    expect(bullets[4].vx).toBeGreaterThan(0);
  });

  it('should generate 4 bullets for level 4 including 2 angled ones', () => {
    const bullets = getBulletPattern(4, 100, 100, 10);
    expect(bullets.length).toBe(4);
    const straight = bullets.filter(b => !b.angled);
    const angled = bullets.filter(b => b.angled);
    expect(straight.length).toBe(2);
    expect(angled.length).toBe(2);
    expect(bullets[0].vx).toBeLessThan(0); // -4 deg
    expect(bullets[3].vx).toBeGreaterThan(0); // +4 deg
  });
});

describe('Collision Logic', () => {
  // We can't easily test the full update loop in a unit test without mocking the whole state,
  // but we can verify that the PHYSICS.SHIELD_BLOCK_SZ is correctly used conceptually.
  it('should use 13 as shield block size', () => {
    const { PHYSICS } = require('../src/game/config.js');
    expect(PHYSICS.SHIELD_BLOCK_SZ).toBe(13);
  });
});

describe('Wave Configuration', () => {
  it('should return correct config for wave 1', () => {
    const cfg = getWaveConfig(1);
    expect(cfg.wave).toBe(1);
    expect(cfg.enemyCols).toBe(WAVE_BANDS[0].enemyCols);
  });

  it('should interpolate fireRate for wave 3', () => {
    const cfg1 = getWaveConfig(1);
    const cfg3 = getWaveConfig(3);
    const cfg5 = getWaveConfig(5);
    expect(cfg3.enemyFireRate).toBeGreaterThan(cfg1.enemyFireRate);
    expect(cfg3.enemyFireRate).toBeLessThan(cfg5.enemyFireRate);
  });

  it('should scale beyond wave 100', () => {
    const cfg100 = getWaveConfig(100);
    const cfg105 = getWaveConfig(105);
    expect(cfg105.enemySpeed).toBeGreaterThan(cfg100.enemySpeed);
    expect(cfg105.enemyHP).toBeGreaterThan(cfg100.enemyHP);
  });
});
