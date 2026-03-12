import { state } from '../game/state.js';

export function updateHUD() {
    document.getElementById('scoreDisplay').textContent = String(state.score).padStart(6, '0');
    document.getElementById('waveDisplay').textContent = String(state.wave || 0).padStart(2, '0');
    document.getElementById('livesDisplay').textContent = Array(Math.max(0, state.lives || 0)).fill('♦').join(' ') || '—';
}
