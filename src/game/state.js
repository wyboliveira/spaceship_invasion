/**
 * state.js — Estado global do jogo
 * Objeto mutável lido pelo game loop (update, render).
 * Modificado exclusivamente via updateState() ou resetState().
 *
 * Não contém lógica de navegação nem de I/O — apenas dados.
 */

export const state = {
  // ── Wave atual ──────────────────────────────────────────────
  cfg:          null,    // Configuração da wave (getWaveConfig)
  wave:         0,
  lives:        0,
  score:        0,
  weaponLevel:  1,

  // ── Entidades ────────────────────────────────────────────────
  player:    { x: 0, y: 0, w: 0, h: 0 },
  bullets:   [],
  eBullets:  [],
  enemies:   [],
  shields:   [],
  drops:     [],
  particles: [],

  // ── Timers e flags do loop ───────────────────────────────────
  enemyDir:        1,
  enemyMoveTimer:  0,
  enemyFireTimer:  0,
  frame:           0,
  flashTimer:      0,
  lastFire:        0,
  _lastTs:         0,
  paused:          false,
  over:            true,
  postWaveMagnet:  false,
  isBossDebugRun:  false,

  // ── Boss ─────────────────────────────────────────────────────
  boss: {
    active: false, introAnim: false, introStep: 0,
    x: 0, y: 0, side: 'left',
    hp: 0, maxHp: 0, shield: 0,
    flashTimer: 0, dir: 1, fireTimer: 0,
    speedMult: 1, weapons: false, neon: false,
  },

  // ── Auth / Perfil ────────────────────────────────────────────
  session:     null,
  userProfile: null,
  syncError:   null,
};

/**
 * Atualiza propriedades específicas mantendo a referência do objeto.
 * @param {Object} patch
 */
export function updateState(patch) {
  Object.assign(state, patch);
}

/**
 * Substitui todo o estado por um novo objeto base.
 * Mantém a referência do objeto (não quebra imports).
 * @param {Object} baseState
 */
export function resetState(baseState) {
  for (const key in state) delete state[key];
  Object.assign(state, baseState);
}
