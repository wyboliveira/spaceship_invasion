import { state } from '../game/state.js';

/**
 * Atualiza os elementos da interface (Heads-Up Display) com base no estado global.
 * Gerencia a exibição de pontuação, onda atual, vidas e nome do usuário.
 * Identifica se o usuário está logado ou jogando como GUEST.
 */
export function updateHUD() {
    try {
        // 1. Atualiza elementos de pontuação e wave
        const scoreEl = document.getElementById('scoreDisplay');
        const waveEl  = document.getElementById('waveDisplay');
        
        if (scoreEl) scoreEl.textContent = String(state.score).padStart(6, '0');
        if (waveEl)  waveEl.textContent  = String(state.wave || 0).padStart(2, '0');
        
        // 2. Renderiza indicador visual de vidas (diamantes)
        const livesEl = document.getElementById('livesDisplay');
        if (livesEl) {
            const livesCount = Math.max(0, state.lives || 0);
            livesEl.textContent = Array(livesCount).fill('♦').join(' ') || '—';
        }

        // 3. Exibe o nome do usuário/GUEST de forma consistente
        const userEl = document.getElementById('userDisplay');
        if (userEl) {
            const username = state.session 
              ? (state.userProfile?.username || state.session.user.email.split('@')[0])
              : 'GUEST';
            userEl.textContent = username.toUpperCase();
        }
    } catch (err) {
        console.error('[HUD] Error updating UI elements:', err);
    }
}
