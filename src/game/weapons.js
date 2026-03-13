import { WEAPON, PHYSICS } from './config.js';

const { ANGLED_RAD, ANGLED_DAMAGE_MULT } = WEAPON;

// Offsets horizontais para balas retas (níveis 1 a 5)
const STRAIGHT_OFFSETS = {
  1: [0],
  2: [-5, 5],
  3: [-10, 0, 10],
  4: [-5, 5],
  5: [-10, 0, 10],
};

// Offsets horizontais para onde as balas anguladas (diagonais) saem da nave
const ANGLED_OFFSETS = {
  4: [-16, 16],
  5: [-16, 16],
};

// Modificadores de sinal (esquerda = -1, direita = 1) para o cálculo de seno/cosseno
const ANGLED_SIGNS = [-1, 1];

/**
 * Retorna o array de novos projéteis a serem disparados pelo jogador
 * com base no nível atual da arma.
 * 
 * @param {number} level Nível atual da arma do jogador (1 a 5)
 * @param {number} px Coordenada X da nave do jogador
 * @param {number} py Coordenada Y da nave do jogador
 * @param {number} spd Velocidade base dos projéteis
 * @returns {Array<Object>} Lista de projéteis recém-craidos
 */
export function getBulletPattern(level, px, py, spd) {
  const bullets = [];
  const centerX = px + PHYSICS.PLAYER_W / 2; // Centro da nave
  const tipY    = py - 2;                    // Ponta da nave (bico) onde a bala sai

  // Limita o nível de forma segura
  const lvl = Math.max(1, Math.min(level, WEAPON.MAX_LEVEL));

  // ── Padrão de Nível 5 (Máximo: 5 Balas em Leque tipo "Shotgun") ──
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

  // ── Padrão de Nível 4 (4 Balas: 2 retas paralelas centrais + 2 diagonais) ──
  if (lvl === 4) {
    const angles = [-4, 0, 0, 4]; // O ângulo 0 cria voo reto.
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

  // ── Padrões de Nível 1 a 3 (Balas unicamente retas) ──
  const straightOff = STRAIGHT_OFFSETS[lvl] ?? [0];
  for (const dx of straightOff) {
    bullets.push({
      x:      centerX + dx,
      y:      tipY,
      vx:     0,     // Movimento em X é nulo (reta vertical)
      vy:     -spd,  // Sobe em direção ao H = 0 (topo)
      damage: 1,
      angled: false,
    });
  }

  // Fallback genérico caso exista nível angulado > 3 sem tratamento especial a cima
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

/**
 * Calcula a perda de nível de arma ao receber dano do inimigo.
 * @param {number} currentLevel 
 * @returns {number} O novo nível (mínimo 1)
 */
export function applyWeaponPenalty(currentLevel) {
  return Math.max(1, currentLevel - WEAPON.DAMAGE_PENALTY);
}

/**
 * Define o tipo de drop com base no nível atual da arma do jogador.
 * Se a arma já está no máximo, o drop cai como cura (heart); senão, como upgrade (weapon).
 * @param {number} weaponLevel 
 * @returns {'heart'|'weapon'}
 */
export function resolveDropType(weaponLevel) {
  return weaponLevel >= WEAPON.MAX_LEVEL ? 'heart' : 'weapon';
}
