export const WAVE_BANDS = [
  // ── Banda 1 — Introdução ────────────────────────────── waves 1–5
  {
    waveStart: 1,  waveEnd: 5,
    enemyCols: 8,  enemyRows: 2,  enemyHP: 1,
    enemySpeed: 0.6,  enemyDropStep: 18,
    fireRateStart: 0.60,  fireRateEnd: 1.00,
    enemyBulletSpd: 2.25,
    playerLives: 5,  playerSpeed: 6.5,
    playerMaxBullets: 3,  playerBulletSpd: 11.7,
    playerFireCooldown: 280,
    shieldsEnabled: true,
    eliteChance: 0.08,    // probabilidade de um inimigo ser elite (0–1)
    bonusPointsPerWave: 0,
  },

  // ── Banda 2 — Mais inimigos ─────────────────────────── waves 6–10
  {
    waveStart: 6,  waveEnd: 10,
    enemyCols: 9,  enemyRows: 3,  enemyHP: 1,
    enemySpeed: 0.9,  enemyDropStep: 18,
    fireRateStart: 0.75,  fireRateEnd: 1.10,
    enemyBulletSpd: 2.60,
    playerLives: 5,  playerSpeed: 6.5,
    playerMaxBullets: 3,  playerBulletSpd: 11.7,
    playerFireCooldown: 260,
    shieldsEnabled: true,
    eliteChance: 0.10,
    bonusPointsPerWave: 500,
  },

  // ── Banda 3 — Grade cheia, 2 HP ─────────────────────── waves 11–20
  {
    waveStart: 11,  waveEnd: 20,
    enemyCols: 10,  enemyRows: 4,  enemyHP: 2,
    enemySpeed: 1.2,  enemyDropStep: 21,
    fireRateStart: 0.75,  fireRateEnd: 1.25,
    enemyBulletSpd: 3.00,
    playerLives: 5,  playerSpeed: 6.5,
    playerMaxBullets: 4,  playerBulletSpd: 13.0,
    playerFireCooldown: 240,
    shieldsEnabled: true,
    eliteChance: 0.12,
    bonusPointsPerWave: 1000,
  },

  // ── Banda 4 — Sem escudos, pressão alta ─────────────── waves 21–30
  {
    waveStart: 21,  waveEnd: 30,
    enemyCols: 11,  enemyRows: 4,  enemyHP: 2,
    enemySpeed: 1.6,  enemyDropStep: 23,
    fireRateStart: 1.00,  fireRateEnd: 1.50,
    enemyBulletSpd: 3.40,
    playerLives: 5,  playerSpeed: 7.8,
    playerMaxBullets: 4,  playerBulletSpd: 14.3,
    playerFireCooldown: 210,
    shieldsEnabled: false,
    eliteChance: 0.14,
    bonusPointsPerWave: 2000,
  },

  // ── Banda 5 — Grade máxima, 3 HP ────────────────────── waves 31–40
  {
    waveStart: 31,  waveEnd: 40,
    enemyCols: 11,  enemyRows: 5,  enemyHP: 3,
    enemySpeed: 2.0,  enemyDropStep: 23,
    fireRateStart: 1.25,  fireRateEnd: 1.75,
    enemyBulletSpd: 3.75,
    playerLives: 5,  playerSpeed: 7.8,
    playerMaxBullets: 5,  playerBulletSpd: 15.6,
    playerFireCooldown: 190,
    shieldsEnabled: true,
    eliteChance: 0.16,
    bonusPointsPerWave: 3500,
  },

  // ── Banda 6 — Cadência crescente, escudos voltam ────── waves 41–50
  {
    waveStart: 41,  waveEnd: 50,
    enemyCols: 12,  enemyRows: 5,  enemyHP: 3,
    enemySpeed: 2.4,  enemyDropStep: 25,
    fireRateStart: 1.50,  fireRateEnd: 2.00,
    enemyBulletSpd: 4.10,
    playerLives: 5,  playerSpeed: 8.5,
    playerMaxBullets: 5,  playerBulletSpd: 16.9,
    playerFireCooldown: 175,
    shieldsEnabled: true,
    eliteChance: 0.18,
    bonusPointsPerWave: 5000,
  },

  // ── Banda 7 — 4 HP, caos crescente ──────────────────── waves 51–60
  {
    waveStart: 51,  waveEnd: 60,
    enemyCols: 12,  enemyRows: 5,  enemyHP: 4,
    enemySpeed: 2.8,  enemyDropStep: 25,
    fireRateStart: 1.75,  fireRateEnd: 2.50,
    enemyBulletSpd: 4.50,
    playerLives: 5,  playerSpeed: 9.0,
    playerMaxBullets: 5,  playerBulletSpd: 18.0,
    playerFireCooldown: 160,
    shieldsEnabled: false,
    eliteChance: 0.20,
    bonusPointsPerWave: 7000,
  },

  // ── Banda 8 — Velocidade extrema ────────────────────── waves 61–70
  {
    waveStart: 61,  waveEnd: 70,
    enemyCols: 12,  enemyRows: 5,  enemyHP: 4,
    enemySpeed: 2.72,  // -15% (era 3.2)
    enemyDropStep: 27,
    fireRateStart: 1.91,  // -15% (era 2.25)
    fireRateEnd: 2.55,    // -15% (era 3.00)
    enemyBulletSpd: 4.25, // -15% (era 5.0)
    playerLives: 5,  playerSpeed: 9.5,
    playerMaxBullets: 5,  playerBulletSpd: 19.5,
    playerFireCooldown: 150,
    shieldsEnabled: true,
    eliteChance: 0.22,
    bonusPointsPerWave: 10000,
  },

  // ── Banda 9 — 5 HP, inferno ──────────────────────────── waves 71–85
  {
    waveStart: 71,  waveEnd: 85,
    enemyCols: 12,  enemyRows: 5,  enemyHP: 5,
    enemySpeed: 3.06,  // -15% (era 3.6)
    enemyDropStep: 28,
    fireRateStart: 2.34,  // -15% (era 2.75)
    fireRateEnd: 3.19,    // -15% (era 3.75)
    enemyBulletSpd: 4.68, // -15% (era 5.5)
    playerLives: 5,  playerSpeed: 10.0,
    playerMaxBullets: 5,  playerBulletSpd: 21.0,
    playerFireCooldown: 140,
    shieldsEnabled: false,
    eliteChance: 0.25,
    bonusPointsPerWave: 15000,
  },

  // ── Banda 10 — Endgame ───────────────────────────────── waves 86–100
  {
    waveStart: 86,  waveEnd: 100,
    enemyCols: 12,  enemyRows: 5,  enemyHP: 6,
    enemySpeed: 3.57,  // -15% (era 4.2)
    enemyDropStep: 30,
    fireRateStart: 2.98,  // -15% (era 3.50)
    fireRateEnd: 4.25,    // -15% (era 5.00)
    enemyBulletSpd: 5.53, // -15% (era 6.5)
    playerLives: 5,  playerSpeed: 10.5,
    playerMaxBullets: 5,  playerBulletSpd: 22.0,
    playerFireCooldown: 130,
    shieldsEnabled: true,
    eliteChance: 0.28,
    bonusPointsPerWave: 25000,
  },

  // ── Adicione bandas aqui para estender além da wave 100 ──
];

// O fator de avanço progressivo infinito para waves acima de 100
export const DIFFICULTY_SCALING = {
  enemySpeedPerWave:      0.0425, // -15% (era 0.05)
  enemyFireRatePerWave:   0.068,  // -15% (era 0.08)
  enemyBulletSpdPerWave:  0.051,  // -15% (era 0.06)
  enemyHPEveryNWaves:     5,      // Adiciona +1 de HP a inimigos normais a cada X ondas extras
  maxEnemyCols:           12,
  maxEnemyRows:           5,
  maxEnemyFireRate:       5.53,   // -15% do teto global (era 6.5)
  maxEnemyBulletSpd:      7.65,   // -15% do teto global (era 9.0)
};

export function getWaveConfig(n) {
  // Encontra a banda que cobre esta wave
  const band = WAVE_BANDS.find(b => n >= b.waveStart && n <= b.waveEnd);

  if (band) {
    // Interpolação linear de fireRate dentro da banda
    const span   = band.waveEnd - band.waveStart;
    const offset = n - band.waveStart;
    const t      = span > 0 ? offset / span : 0;
    const fireRate = band.fireRateStart + (band.fireRateEnd - band.fireRateStart) * t;

    return {
      wave:               n,
      enemyCols:          band.enemyCols,
      enemyRows:          band.enemyRows,
      enemyHP:            band.enemyHP,
      enemySpeed:         band.enemySpeed,
      enemyDropStep:      band.enemyDropStep,
      enemyFireRate:      parseFloat(fireRate.toFixed(3)),
      enemyBulletSpd:     band.enemyBulletSpd,
      playerLives:        band.playerLives,
      playerSpeed:        band.playerSpeed,
      playerMaxBullets:   band.playerMaxBullets,
      playerBulletSpd:    band.playerBulletSpd,
      playerFireCooldown: band.playerFireCooldown,
      shieldsEnabled:     band.shieldsEnabled,
      eliteChance:        band.eliteChance,
      bonusPoints:        band.bonusPointsPerWave,
    };
  }

  // Wave além de todas as bandas: escalonamento a partir da última
  const lastBand = WAVE_BANDS[WAVE_BANDS.length - 1];
  const extra    = n - lastBand.waveEnd;
  const base     = getWaveConfig(lastBand.waveEnd);  // resolve a última wave da última banda

  return {
    ...base,
    wave:           n,
    enemySpeed:     Math.min(base.enemySpeed     + DIFFICULTY_SCALING.enemySpeedPerWave    * extra, 5.1), // teto 5.1 (era 6)
    enemyFireRate:  Math.min(base.enemyFireRate  + DIFFICULTY_SCALING.enemyFireRatePerWave * extra, DIFFICULTY_SCALING.maxEnemyFireRate),
    enemyBulletSpd: Math.min(base.enemyBulletSpd + DIFFICULTY_SCALING.enemyBulletSpdPerWave * extra, DIFFICULTY_SCALING.maxEnemyBulletSpd),
    enemyHP:        base.enemyHP + Math.floor(extra / DIFFICULTY_SCALING.enemyHPEveryNWaves),
    bonusPoints:    base.bonusPoints + extra * 2000,
    eliteChance:    Math.min((base.eliteChance || 0.28) + 0.005 * extra, 0.45), // Máx 45% de elites no inferno
  };
}

// Dimensões e posicionamentos (Hardcoded physics params)
export const PHYSICS = {
  CANVAS_W:         858,
  CANVAS_H:         676,
  ENEMY_W:          34,
  ENEMY_H:          29,
  ENEMY_SPACING_X:  57,  // Espaçamento horizontal na grade alienígena
  ENEMY_SPACING_Y:  49,  // Espaçamento vertical na grade
  ENEMY_START_X:    65,  // Posição X inicial da grade no canvas
  ENEMY_START_Y:    62,  // Posição Y inicial
  ENEMY_MOVE_BASE:  900, // Intervalo base em ms para step lateral dos inimigos (modificado pelo cfg)
  PLAYER_W:         34,
  PLAYER_H:         36,
  PLAYER_Y_OFFSET:  68,  // Distância que o jogador fica da base da tela
  SHIELD_BLOCK_SZ:  13,  // Tamanho em pixels dos mini-blocos do escudo
  SHIELD_Y_OFFSET:  169, // Altura que os 4 pilares de escudo são renderizados a partir do bottom
  SHIELD_COUNT:     4,   // Número de escudos de defesa
  SHIELD_BLOCK_HP:  3,   // Vida individual de cada bloco
  PARTICLE_GRAVITY: 0.1, // Gravidade padrão
  PARTICLE_DECAY:   0.028, // Fator que dita quão rápido a partícula some

  BOSS_W:           119, // Tamanho do chefão ~3.5x do inimigo comum (34 * 3.5 = 119)
  BOSS_H:           102, // Altura chefão
};

export const BOSS_CONFIGS = {
  10:  { hpMult: 10, speedMult: 1.0, shield: 0, weapons: false },
  20:  { hpMult: 12, speedMult: 1.0, shield: 0, weapons: false },
  30:  { hpMult: 14, speedMult: 1.0, shield: 0, weapons: false },
  40:  { hpMult: 15, speedMult: 1.0, shield: 0, weapons: false },
  50:  { hpMult: 16, speedMult: 1.0, shield: 5, weapons: false },
  60:  { hpMult: 16, speedMult: 1.0, shield: 5, weapons: false },
  70:  { hpMult: 20, speedMult: 1.2, shield: 0, weapons: true },
  80:  { hpMult: 20, speedMult: 1.2, shield: 0, weapons: true },
  90:  { hpMult: 20, speedMult: 1.2, shield: 0, weapons: true },
  100: { hpMult: 22, speedMult: 1.2, shield: 0, weapons: true, neon: true },
};

export const VISUAL = {
  COLOR_PLAYER:        '#00f0ff',
  COLOR_PLAYER_GLOW:   '#00f0ff',
  COLOR_BULLET:        '#ffe600',
  COLOR_BULLET_ANGLED: '#ffaa00',   // balas anguladas (tiros diagonais)
  COLOR_ENEMY_A:       '#ff3d6b',
  COLOR_ENEMY_B:       '#ff8040',
  COLOR_ENEMY_C:       '#cc44ff',
  COLOR_ENEMY_BULLET:  '#ff3355',
  COLOR_SHIELD:        '#00ff88',
  COLOR_PARTICLE_HIT:  '#ff3d6b',
  COLOR_PARTICLE_PLR:  '#00f0ff',
  COLOR_STAR_BASE:     '200,220,255',

  // Elite enemy
  COLOR_ELITE_BASE:    '#ffffff',   // cor base do sprite elite
  COLOR_ELITE_PULSE:   '#ffe066',   // cor do pulso/glow

  // Drops
  COLOR_DROP_WEAPON:   '#00ff88',   // cor do drop de arma
  COLOR_DROP_HEART:    '#ff3d6b',   // cor do drop de coração

  STAR_COUNT:          130,
  HIT_FLASH_DURATION:  280,
};

export const SCORING = {
  POINTS_BY_ROW:    [30, 20, 20, 10, 10],  // row 0 = frente (mais pontos)
  ELITE_MULTIPLIER: 3,                      // pontos do elite = normal × 3
  DROP_HEART_BONUS: 500,                    // pontos ao coletar coração com vida cheia
};

export const WEAPON = {
  MAX_LEVEL:          5,    // nível máximo de upgrade (1 = padrão)
  DROP_CHANCE:        1.0,  // chance de um elite dropar item (0–1); 1 = sempre
  //
  // Ângulo (em radianos) das balas laterais nos níveis 4 e 5.
  // 0 = linha reta; Math.PI/12 ≈ 15° de inclinação.
  ANGLED_RAD:         Math.PI / 12,
  //
  // Dano relativo das balas anguladas (1.0 = dano normal)
  ANGLED_DAMAGE_MULT: 0.75,
  //
  // Penalidade de nível ao tomar 1 dano
  DAMAGE_PENALTY:     2,    // perde 2 níveis de arma ao ser atingido
};

