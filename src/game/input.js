import { state } from './state.js';

// ── Objeto de Teclas (State) ──────────────────────────────────
// Mantém o estado atual (pressionado ou não) de cada tecla.
// Usado diretamente pelo `update.js` para ditar o movimento a cada frame.
export const keys = {};

/**
 * Inicializa os event listeners do teclado.
 * @param {Object} GameCallbacks Objeto contendo funções de controle (pausa, reiniciar)
 */
export function initInput(GameCallbacks) {
    document.addEventListener('keydown', e => {
        // Marca a tecla como "segurada"
        keys[e.code] = true;
        
        // Evita que a página role para baixo ao atirar
        if (e.code === 'Space') e.preventDefault();
        
        // Atalhos de jogo globais
        if (e.code === 'KeyP' && state.cfg) GameCallbacks.togglePause();
        if (e.code === 'KeyR') {
            GameCallbacks.showConfirm('DESEJA REINICIAR A PARTIDA? (O PROGRESSO ATUAL SERÁ SALVO)', () => {
                GameCallbacks.reset();
            });
        }
        
        // Se a partida tiver acabado, Enter ou NumpadEnter avança o menu
        if ((e.code === 'Enter' || e.code === 'NumpadEnter') && state.over && !state.paused) {
          // Checa qual overlay principal está ativo e clica nele
          const btn = document.getElementById('nextWaveBtn') || document.getElementById('restartBtn') || document.getElementById('startBtn');
          if (btn) btn.click();
        }
    });
    
    // Libera a tecla do objeto `keys` quando o jogador soltar o botão
    document.addEventListener('keyup', e => { keys[e.code] = false; });
}
