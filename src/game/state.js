export let state = {
  cfg: null,
  wave: 0,
  lives: 0,
  player: { x: 0, y: 0, w: 0, h: 0 },
  weaponLevel: 1,
  bullets: [],
  eBullets: [],
  enemies: [],
  shields: [],
  drops: [],
  particles: [],
  enemyDir: 1,
  enemyMoveTimer: 0,
  enemyFireTimer: 0,
  frame: 0,
  flashTimer: 0,
  lastFire: 0,
  paused: false,
  over: false,
  _lastTs: 0,
  score: 0
};

export function updateState(newState) {
  state = { ...state, ...newState };
}

export function resetState(baseState) {
    state = { ...baseState };
}
