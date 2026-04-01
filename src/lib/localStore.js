/**
 * localStore.js — Cache local de progresso do jogador
 *
 * Armazena score, wave e timestamp de sincronização no localStorage.
 * O banco de dados (Firestore) só é atualizado quando o usuário clica
 * em SYNC RECORDS — nunca de forma automática durante o jogo.
 *
 * Campos armazenados:
 *   userId        — identifica de quem são os dados (evita cruzar dados entre contas)
 *   max_score     — maior pontuação já atingida (calculada localmente)
 *   max_wave      — maior wave já atingida
 *   last_score    — score da partida mais recente
 *   last_wave     — wave da partida mais recente
 *   pendingSync   — true se há dados não enviados ao banco
 *   localUpdatedAt — quando o dado local foi atualizado pela última vez
 *   lastSyncedAt  — quando o banco foi atualizado pela última vez (null = nunca)
 */

const STORE_KEY = 'spaceship_invasion_progress';

/**
 * Salva o resultado de uma partida no localStorage.
 * Calcula max_score e max_wave comparando com o valor anterior.
 * Retorna o objeto salvo.
 */
export function saveLocalProgress(userId, score, wave) {
  const existing = loadLocalProgress(userId) || {};
  const data = {
    userId,
    username:       existing.username      || null,
    role:           existing.role          || 'player',
    max_score:      Math.max(existing.max_score  || 0, score),
    max_wave:       Math.max(existing.max_wave   || 0, wave),
    last_score:     score,
    last_wave:      wave,
    pendingSync:    true,
    localUpdatedAt: new Date().toISOString(),
    lastSyncedAt:   existing.lastSyncedAt  || null,
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  return data;
}

/**
 * Carrega o progresso local do userId informado.
 * Retorna null se não houver dados ou se os dados forem de outro usuário.
 */
export function loadLocalProgress(userId) {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.userId !== userId) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * Inicializa o localStorage com dados vindos do banco.
 * Usado no primeiro login ou quando não há dados locais.
 * Retorna o objeto salvo.
 */
export function seedFromDatabase(userId, dbProfile) {
  const data = {
    userId,
    username:       dbProfile.username   || null,
    role:           dbProfile.role       || 'player',
    max_score:      dbProfile.max_score  || 0,
    max_wave:       dbProfile.max_wave   || 0,
    last_score:     dbProfile.last_score || 0,
    last_wave:      dbProfile.last_wave  || 0,
    pendingSync:    false,
    localUpdatedAt: new Date().toISOString(),
    lastSyncedAt:   new Date().toISOString(),
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  return data;
}

/**
 * Marca os dados locais como sincronizados com o banco.
 * Atualiza lastSyncedAt e pendingSync = false.
 * Retorna o objeto atualizado.
 */
export function markSynced() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    data.lastSyncedAt        = new Date().toISOString();
    data.pendingSync         = false;
    data.pendingUsernameSync = false;
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}

/**
 * Zera o histórico local. Mantém userId e lastSyncedAt como null.
 * pendingSync = true para que o próximo SYNC envie os zeros ao banco.
 * Retorna o objeto zerado.
 */
export function clearLocalProgress(userId) {
  const existing = loadLocalProgress(userId) || {};
  const data = {
    userId,
    username:       existing.username || null,
    role:           existing.role     || 'player',
    max_score:      0,
    max_wave:       0,
    last_score:     0,
    last_wave:      0,
    pendingSync:    true,
    localUpdatedAt: new Date().toISOString(),
    lastSyncedAt:   null,
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  return data;
}

/**
 * Atualiza somente o username no localStorage.
 * Retorna o objeto atualizado ou null em caso de falha.
 */
export function updateLocalUsername(userId, username) {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const data = raw ? JSON.parse(raw) : { userId };
    if (data.userId !== userId) return null;
    data.username            = username;
    data.pendingUsernameSync = true;
    data.localUpdatedAt      = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    return data;
  } catch {
    return null;
  }
}
