import { state, updateState } from './state.js';

export const keys = {};

export function initInput(GameCallbacks) {
    document.addEventListener('keydown', e => {
        keys[e.code] = true;
        if (e.code === 'Space') e.preventDefault();
        if (e.code === 'KeyP' && state.cfg) GameCallbacks.togglePause();
        if (e.code === 'KeyR') GameCallbacks.reset();
        if ((e.code === 'Enter' || e.code === 'NumpadEnter') && state.over && !state.paused) {
          // Check which button is visible in the overlay and click it
          const btn = document.getElementById('nextWaveBtn') || document.getElementById('restartBtn') || document.getElementById('startBtn');
          if (btn) btn.click();
        }
    });
    document.addEventListener('keyup', e => { keys[e.code] = false; });
}
