/**
 * SyncQueue — Camada 3
 * Fila de persistência assíncrona que isola completamente o I/O do Supabase
 * do game loop e da FSM. Nenhum arquivo do jogo chama o Supabase diretamente
 * — eles enfileiram uma tarefa aqui.
 *
 * Comportamento:
 *   - Processa uma tarefa por vez (serial), em ordem FIFO.
 *   - Retry automático com backoff exponencial (até MAX_ATTEMPTS tentativas).
 *   - Ao confirmar, emite 'SYNC_DONE' no EventBus.
 *   - Ao esgotar tentativas, emite 'SYNC_FAILED' e descarta a tarefa.
 *   - Timeout por tarefa configurável (TASK_TIMEOUT_MS).
 *   - Tarefas de partidas antigas são descartadas via sessionId.
 */

import { EventBus } from './EventBus.js';

const MAX_ATTEMPTS    = 3;
const TASK_TIMEOUT_MS = 12000; // 12s — cobre cold start do free tier (~10s) sem segurar UI por demais
const BACKOFF_BASE_MS = 2000;  // 2s, 4s, 8s — espera maior entre retries para o DB acordar

let _queue      = [];
let _processing = false;
let _currentSessionId = 0; // invalidado a cada nova partida

export const SyncQueue = {
  /**
   * Avança para uma nova sessão de jogo, descartando syncs anteriores em voo.
   */
  newSession() {
    _currentSessionId++;
  },

  /** Retorna o ID da sessão atual (lido por main.js ao enfileirar). */
  get currentSessionId() {
    return _currentSessionId;
  },

  /**
   * Enfileira uma tarefa de persistência.
   *
   * @param {string}   type      — identificador legível (ex: 'WaveClear', 'GameOver')
   * @param {Function} taskFn    — função async que executa o I/O; deve lançar em caso de erro
   * @param {number}   sessionId — ID da sessão que gerou esta tarefa
   */
  enqueue(type, taskFn, sessionId) {
    _queue.push({ type, taskFn, sessionId, attempts: 0 });
    console.log(`[SyncQueue] Enfileirado: ${type} (sessão ${sessionId})`);
    _processNext();
  },

  /**
   * Esvazia a fila (usado no logout para não gravar dados de sessão encerrada).
   */
  clear() {
    _queue = [];
    console.log('[SyncQueue] Fila limpa.');
  },

  /** Retorna true se há tarefas pendentes ou em processamento. */
  get busy() {
    return _processing || _queue.length > 0;
  },

  /** Retorna o número de tarefas na fila. */
  get length() {
    return _queue.length;
  },

  /** 
   * Reseta completamente a fila e o estado interno. 
   * Útil para testes automatizados.
   */
  reset() {
    _queue = [];
    _processing = false;
    _currentSessionId = 0;
    console.log('[SyncQueue] Reset completo.');
  }
};

// ── Interno ──────────────────────────────────────────────────

async function _processNext() {
  if (_processing || _queue.length === 0) return;
  _processing = true;

  const task = _queue[0];

  // As tarefas da SyncQueue atuais (Score, History) são persistentes e não devem
  // ser descartadas apenas porque uma nova partida começou.
  /*
  if (task.sessionId < _currentSessionId) {
    console.log(`[SyncQueue] Descartado (sessão antiga): ${task.type}`);
    _queue.shift();
    _processing = false;
    _processNext();
    return;
  }
  */

  task.attempts++;
  console.log(
    `[SyncQueue] Processando: ${task.type} — tentativa ${task.attempts}/${MAX_ATTEMPTS}`
  );

  try {
    console.log(`[SyncQueue] Executando taskFn para ${task.type}...`);
    await _withTimeout(task.taskFn(), TASK_TIMEOUT_MS);

    console.log(`[SyncQueue] ✅ Concluído: ${task.type}`);
    _queue.shift();
    EventBus.emit('SYNC_DONE', { type: task.type });
  } catch (err) {
    console.warn(`[SyncQueue] ⚠️ Falha em ${task.type}:`, err.message);

    if (task.attempts >= MAX_ATTEMPTS) {
      console.error(`[SyncQueue] ❌ Esgotado: ${task.type} após ${MAX_ATTEMPTS} tentativas.`);
      _queue.shift();
      EventBus.emit('SYNC_FAILED', { type: task.type, error: err.message });
    } else {
      // Reagenda com backoff exponencial
      const delay = BACKOFF_BASE_MS * Math.pow(2, task.attempts - 1);
      console.log(`[SyncQueue] Retry em ${delay}ms...`);
      await _sleep(delay);
    }
  }

  _processing = false;
  _processNext();
}

function _withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout após ${ms}ms`)), ms)
    ),
  ]);
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
