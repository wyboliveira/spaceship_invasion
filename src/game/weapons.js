import { WEAPON, PHYSICS } from './config.js';

const { ANGLED_RAD, ANGLED_DAMAGE_MULT } = WEAPON;

const STRAIGHT_OFFSETS = {
  1: [0],
  2: [-5, 5],
  3: [-10, 0, 10],
  4: [-5, 5],
  5: [-10, 0, 10],
};

const ANGLED_OFFSETS = {
  4: [-16, 16],
  5: [-16, 16],
};

const ANGLED_SIGNS = [-1, 1];

export function getBulletPattern(level, px, py, spd) {
  const bullets = [];
  const centerX = px + PHYSICS.PLAYER_W / 2;
  const tipY    = py - 2;

  const lvl = Math.max(1, Math.min(level, WEAPON.MAX_LEVEL));

  if (lvl === 5) {
    const angles = [-8, -4, 0, 4, 8];
    return angles.map(deg => {
      const rad = (deg * Math.PI) / 180;
      return {
        x:       px + PHYSICS.PLAYER_W / 2 + deg * 0.8,
        y:       py,
        vx:      spd * Math.sin(rad),
        vy:      -spd * Math.cos(rad),
        damage:  1,
        angled:  deg !== 0,
      };
    });
  }

  if (lvl === 4) {
    const angles = [-4, 0, 0, 4]; // Relative to vertical (90 deg)
    const offsets = [-6, -2, 2, 6];
    return angles.map((deg, i) => {
      const rad = (deg * Math.PI) / 180;
      return {
        x:       px + PHYSICS.PLAYER_W / 2 + offsets[i],
        y:       py,
        vx:      spd * Math.sin(rad),
        vy:      -spd * Math.cos(rad),
        damage:  1,
        angled:  deg !== 0,
      };
    });
  }

  const straightOff = STRAIGHT_OFFSETS[lvl] ?? [0];
  for (const dx of straightOff) {
    bullets.push({
      x:      centerX + dx,
      y:      tipY,
      vx:     0,
      vy:     -spd,
      damage: 1,
      angled: false,
    });
  }

  if (lvl >= 4) {
    const angledOff = ANGLED_OFFSETS[lvl] ?? ANGLED_OFFSETS[4];
    for (let i = 0; i < angledOff.length; i++) {
      const sign = ANGLED_SIGNS[i];
      bullets.push({
        x:      centerX + angledOff[i],
        y:      tipY,
        vx:     Math.sin(ANGLED_RAD) * spd * sign,
        vy:     -Math.cos(ANGLED_RAD) * spd,
        damage: ANGLED_DAMAGE_MULT,
        angled: true,
      });
    }
  }

  return bullets;
}

export function applyWeaponPenalty(currentLevel) {
  return Math.max(1, currentLevel - WEAPON.DAMAGE_PENALTY);
}

export function resolveDropType(weaponLevel) {
  return weaponLevel >= WEAPON.MAX_LEVEL ? 'heart' : 'weapon';
}
