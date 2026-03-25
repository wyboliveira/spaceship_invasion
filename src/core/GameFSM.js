/**
 * GameFSM — Camada 1
 * Máquina de estados finita que governa toda a navegação do jogo.
 * É a única fonte de verdade sobre "onde o jogo está agora".
 *
 * Estados possíveis:
 *   MENU      → tela inicial, aguardando input do usuário
 *   PLAYING   → game loop ativo, jogo em andamento
 *   PAUSED    → game loop suspenso, overlay de pausa visível
 *   SYNCING   → aguardando confirmação do banco (spinner visível)
 *   WAVE_END  → overlay de wave clear, aguardando ação do jogador
 *   GAME_OVER → overlay de game over, aguardando ação do jogador
 *
 * Regras:
 *   - Transições inválidas são silenciosamente ignoradas com log de aviso.
 *   - Nenhuma lógica de I/O ou renderização vive aqui.
 *   - A FSM emite eventos no EventBus para que outras camadas reajam.
 */

import { EventBus } from './EventBus.js';

// Mapa de transições válidas: estado atual → estados permitidos
const TRANSITIONS = {
  MENU:      ['PLAYING'],
  PLAYING:   ['PAUSED', 'GAME_OVER', 'WAVE_END', 'MENU'],
  PAUSED:    ['PLAYING', 'MENU'],
  SYNCING:   ['WAVE_END', 'GAME_OVER', 'MENU'], // mantido mas não usado no fluxo do jogo
  WAVE_END:  ['PLAYING', 'MENU'],
  GAME_OVER: ['PLAYING', 'MENU'],
};

let _currentState = 'MENU';

export const GameFSM = {
  /**
   * Retorna o estado atual.
   * @returns {string}
   */
  get state() {
    return _currentState;
  },

  /**
   * Verifica se uma transição é válida sem executá-la.
   * @param {string} nextState
   * @returns {boolean}
   */
  canTransition(nextState) {
    return (TRANSITIONS[_currentState] || []).includes(nextState);
  },

  /**
   * Executa uma transição de estado.
   * Emite 'FSM_TRANSITION' no EventBus com { from, to, payload }.
   * Emite também um evento específico do estado destino (ex: 'FSM_PLAYING').
   *
   * @param {string} nextState
   * @param {*} payload — dados opcionais passados aos handlers
   * @returns {boolean} true se a transição ocorreu
   */
  transition(nextState, payload = {}) {
    if (!this.canTransition(nextState)) {
      console.warn(
        `[FSM] Transição inválida: ${_currentState} → ${nextState}. Ignorada.`
      );
      return false;
    }

    const from = _currentState;
    _currentState = nextState;

    console.log(`[FSM] ${from} → ${nextState}`, payload);

    EventBus.emit('FSM_TRANSITION', { from, to: nextState, payload });
    EventBus.emit(`FSM_${nextState}`, { from, payload });

    return true;
  },

  /**
   * Força o estado sem validação. Usar apenas na inicialização.
   * @param {string} state
   */
  forceState(state) {
    _currentState = state;
  },
};
