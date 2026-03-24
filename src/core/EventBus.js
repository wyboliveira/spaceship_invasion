/**
 * EventBus — Camada 2
 * Barramento de eventos pub/sub que desacopla completamente a FSM,
 * o game loop e a camada de persistência. Nenhum módulo chama outro
 * diretamente — todos emitem e escutam eventos.
 *
 * Uso:
 *   EventBus.on('GAME_OVER', handler)
 *   EventBus.emit('GAME_OVER', { score: 1200, wave: 5 })
 *   EventBus.off('GAME_OVER', handler)
 */

const _listeners = {};

export const EventBus = {
  /**
   * Registra um handler para um evento.
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(handler);
  },

  /**
   * Remove um handler previamente registrado.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(h => h !== handler);
  },

  /**
   * Emite um evento para todos os handlers registrados.
   * Erros em handlers individuais são capturados e logados
   * sem interromper os demais handlers.
   * @param {string} event
   * @param {*} payload
   */
  emit(event, payload) {
    if (!_listeners[event]) return;
    for (const handler of _listeners[event]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Erro no handler de '${event}':`, err);
      }
    }
  },
};
