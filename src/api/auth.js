/**
 * auth.js — Camada 3 (I/O puro)
 * Funções de acesso ao Supabase. Nenhuma lógica de navegação ou estado de jogo
 * vive aqui — apenas chamadas à API e retorno de dados.
 *
 * Quem chama estas funções: SyncQueue (via taskFn) e o listener de auth em main.js.
 */

import { supabase } from '../lib/supabase.js';

const PENDING_RESET_KEY = 'spaceship_invasion_pending_reset';

// ── Login ─────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

export async function signInWithGithub() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  // Erros de signOut são ignorados intencionalmente — o estado local
  // já é limpo pelo listener onAuthStateChange.
  if (error) console.warn('[Auth] signOut retornou erro (ignorado):', error.message);
}

// ── Perfil ────────────────────────────────────────────────────

/**
 * Carrega o perfil do usuário. Lança em caso de erro de rede.
 * Retorna null se o perfil ainda não existe (primeiro login).
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ── Score ─────────────────────────────────────────────────────

/**
 * Persiste score e wave no banco.
 * Calcula max_score / max_wave localmente para evitar race condition de leitura-escrita.
 * Retorna o perfil atualizado.
 *
 * @param {string} userId
 * @param {number} score
 * @param {number} wave
 * @param {Object} currentProfile — perfil atual (para calcular max sem ler o banco)
 * @returns {Object} perfil salvo
 */
export async function persistScore(userId, score, wave, currentProfile = {}) {
  const safeProfile = currentProfile || {};
  const newMaxScore = Math.max(safeProfile.max_score || 0, score);
  const newMaxWave  = Math.max(safeProfile.max_wave  || 0, wave);

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id:         userId,
      last_score: score,
      last_wave:  wave,
      max_score:  newMaxScore,
      max_wave:   newMaxWave,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[Auth] Erro em persistScore:', error.message);
    throw error;
  }
  
  console.log('[Auth] Score persistido com sucesso:', data?.max_score);
  return data;
}

// ── Histórico ─────────────────────────────────────────────────

/**
 * Zera o histórico do usuário no banco.
 * Usa localStorage como flag de resiliência: se falhar, será reprocessado no boot.
 */
export async function clearUserHistory(userId) {
  localStorage.setItem(PENDING_RESET_KEY, userId);

  const performUpdate = () => supabase
    .from('profiles')
    .update({
      max_score: 0, max_wave: 0,
      last_score: 0, last_wave: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  const { error } = await performUpdate();

  if (error) {
    console.error('[Auth] Erro ao zerar histórico:', error.message);
    throw error;
  }

  localStorage.removeItem(PENDING_RESET_KEY);
}

/**
 * Reprocessa resets pendentes que não foram concluídos na sessão anterior.
 * Chamado no boot, após login confirmado.
 */
export async function processPendingResets() {
  const pendingId = localStorage.getItem(PENDING_RESET_KEY);
  if (!pendingId) return;

  console.log(`[Auth] Reset pendente detectado para ${pendingId}, reprocessando...`);

  try {
    await clearUserHistory(pendingId);
    console.log('[Auth] ✅ Reset pendente concluído.');
  } catch (err) {
    console.warn('[Auth] ⏳ Falha no reset pendente, será tentado novamente no próximo boot:', err.message);
  }
}
