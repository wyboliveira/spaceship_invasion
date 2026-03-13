import { PHYSICS } from './config.js';
import { state } from './state.js';

/**
 * Cria a grade inicial de inimigos para a wave, definindo posições,
 * HP baseado na wave atual e se o inimigo é uma variante "Elite".
 * 
 * @param {Object} cfg Configurações da wave (colunas, linhas, HP base, chance de elite)
 * @returns {Array<Object>} Lista de inimigos inicializados
 */
export function createEnemies(cfg) {
  const out = [];
  for (let r = 0; r < cfg.enemyRows; r++) {
    for (let c = 0; c < cfg.enemyCols; c++) {
      // Chance de surgir como Elite (mais HP, dropa item, vale mais pontos)
      const isElite = Math.random() < (cfg.eliteChance ?? 0);
      out.push({
        x:      PHYSICS.ENEMY_START_X + c * PHYSICS.ENEMY_SPACING_X, // Posição horizontal na grade
        y:      PHYSICS.ENEMY_START_Y + r * PHYSICS.ENEMY_SPACING_Y, // Posição vertical na grade
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

/**
 * Cria os blocos destrutíveis de escudo de defesa do jogador (se ativados para a wave).
 * Cada escudo é formado por uma matriz de pequenos blocos retangulares.
 * 
 * @param {Object} cfg Configurações da wave
 * @returns {Array<Object>} Lista de escudos, cada um contendo seus sub-blocos
 */
export function createShields(cfg) {
  if (!cfg.shieldsEnabled) return [];

  const shields = [];
  const bSz = PHYSICS.SHIELD_BLOCK_SZ;
  const BW = 5, BH = 3;  // Escudo tem 5 blocos de largura e 3 de altura
  const W = PHYSICS.CANVAS_W, H = PHYSICS.CANVAS_H;

  for (let s = 0; s < PHYSICS.SHIELD_COUNT; s++) {
    const sw = BW * bSz;
    // Distribui os escudos de forma igual pela extensão da tela
    const sx = 55 + s * ((W - 110) / (PHYSICS.SHIELD_COUNT - 1)) - sw / 2;
    const sy = H - PHYSICS.SHIELD_Y_OFFSET;
    const blocks = [];

    for (let r = 0; r < BH; r++) {
      for (let c = 0; c < BW; c++) {
        // Cava um buraco no meio da linha inferior do escudo para formar o formato clássico de "arco"
        if (r === BH - 1 && c >= 1 && c <= BW - 2) continue;
        blocks.push({ c, r, hp: PHYSICS.SHIELD_BLOCK_HP });
      }
    }
    shields.push({ x: sx, y: sy, blocks });
  }
  return shields;
}

/**
 * Gera múltiplas partículas de explosão (Efeito visual).
 * Usado quando inimigos ou boss sofrem dano/morrem.
 * 
 * @param {number} x Coordenada X da explosão
 * @param {number} y Coordenada Y da explosão
 * @param {string} color Cor hexadecimal ou rgb() das partículas
 * @param {number} count Número de partículas geradas (padrão: 12)
 */
export function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const a   = (Math.PI * 2 / count) * i + Math.random() * 0.4;
    const spd = Math.random() * 3 + 1;
    state.particles.push({
      x, y,
      vx:    Math.cos(a) * spd, // Velocidade no eixo X dispersando em círculo
      vy:    Math.sin(a) * spd, // Velocidade no eixo Y
      life:  1,                 // Ciclo de vida (vai decaindo até sumir)
      color,
      r:     Math.random() * 2.5 + 1, // Raio da partícula
    });
  }
}

/**
 * Cria um item (drop) que cai da posição de um inimigo abatido.
 * Pode ser um power-up de arma ('weapon') ou cura ('heart').
 * 
 * @param {number} x Coordenada X onde o item surge
 * @param {number} y Coordenada Y onde o item surge
 * @param {string} type Tipo do drop ('weapon' ou 'heart')
 */
export function spawnDrop(x, y, type) {
  state.drops.push({
    x,
    y,
    type,
    vy:    1.8,  // Velocidade de descida
    frame: 0,    // Contador de animação (pulsação)
  });
}

/**
 * Instancia o objeto Boss especial se a Wave tiver uma configuração de Boss associada.
 * Configura atributos únicos como vida muito alta, escudos e direção de spawn.
 * 
 * @param {number} wave O número da wave atual (ex: 10, 20... 100)
 * @param {Object} BOSS_CONFIGS O dicionário de configs importado de config.js
 */
export function createBoss(wave, BOSS_CONFIGS) {
  const cfg = BOSS_CONFIGS[wave];
  if (!cfg) return;

  const W = PHYSICS.CANVAS_W;
  const side = Math.random() < 0.5 ? 'left' : 'right';
  const startX = side === 'left' ? -PHYSICS.BOSS_W : W; // Surge de fora da tela
  
  state.boss = {
    active:     true,
    introAnim:  true, // Para iniciar deslizando até o centro antes de habilitar dano/movimento
    introStep:  0,
    side:       side,
    x:          startX,
    y:          PHYSICS.ENEMY_START_Y,
    hp:         cfg.hpMult * (state.cfg?.enemyHP ?? 1),
    maxHp:      cfg.hpMult * (state.cfg?.enemyHP ?? 1),
    shield:     cfg.shield || 0,
    flashTimer: 0,
    dir:        1,
    fireTimer:  0,
    speedMult:  cfg.speedMult || 1.0,  // Multiplicador extra de velocidade da tabela de bosses
    weapons:    cfg.weapons || false,  // O boss atira?
    neon:       cfg.neon || false      // Efeito visual neon (usado na wave 100)
  };
}
