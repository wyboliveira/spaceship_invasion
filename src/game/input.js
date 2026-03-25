import { state } from './state.js';
import { EventBus } from '../core/EventBus.js';

// ── Objeto de Teclas (State) ──────────────────────────────────
// Mantém o estado atual (pressionado ou não) de cada tecla.
// Usado diretamente pelo `update.js` para ditar o movimento a cada frame.
export const keys = {};

/**
 * Inicializa os event listeners do teclado.
 */
export function initInput() {
    document.addEventListener('keydown', e => {
        // Se o foco está em um campo de texto, ignora todos os atalhos do jogo.
        // O input cuida do seu próprio comportamento (Enter salva, Escape cancela).
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Marca a tecla como "segurada"
        keys[e.code] = true;

        // Evita que a página role para baixo ao atirar
        if (e.code === 'Space') e.preventDefault();

        // Atalhos de jogo globais
        if (e.code === 'KeyP' && state.cfg) {
            EventBus.emit('INPUT_TOGGLE_PAUSE');
        }

        if (e.code === 'KeyR') {
            EventBus.emit('INPUT_REQUEST_RESTART');
        }

        // Enter / NumpadEnter navega menus com base no estado da FSM
        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            if (window.GameFSM) {
                const st = window.GameFSM.state;
                if (st === 'WAVE_END') document.getElementById('nextWaveBtn')?.click();
                else if (st === 'GAME_OVER') document.getElementById('restartBtn')?.click();
                else if (st === 'MENU') document.getElementById('startBtn')?.click();
            }
        }
    });
    
    // Libera a tecla do objeto `keys` quando o jogador soltar o botão
    document.addEventListener('keyup', e => { keys[e.code] = false; });
}
