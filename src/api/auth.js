/**
 * auth.js — Camada 3 (I/O puro)
 * Funções de acesso ao Supabase. Nenhuma lógica de navegação ou estado de jogo
 * vive aqui — apenas chamadas à API e retorno de dados.
 *
 * Quem chama estas funções: o listener de auth em main.js e o botão SYNC RECORDS.
 */

import { supabase } from '../lib/supabase.js';

// ── Login ─────────────────────────────────────────────────────

export async function signInWithGoogle() {
  if (!supabase) throw new Error('Auth indisponível: credenciais Supabase não configuradas.');
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
  if (!supabase) throw new Error('Auth indisponível: credenciais Supabase não configuradas.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  // scope: 'global' invalida a sessão no servidor também,
  // garantindo que o token não permaneça ativo em nenhum dispositivo.
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) {
    // signOut pode falhar se a sessão já expirou no servidor.
    // Remove as chaves do Supabase do localStorage manualmente como fallback.
    console.warn('[Auth] signOut retornou erro, forçando limpeza local:', error.message);
    Object.keys(localStorage)
      .filter(k => k.startsWith('sb-'))
      .forEach(k => localStorage.removeItem(k));
  }
}

// ── Perfil ────────────────────────────────────────────────────

/**
 * Carrega o perfil do usuário. Lança em caso de erro de rede.
 * Retorna null se o perfil ainda não existe (primeiro login).
 */
export async function getUserProfile(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ── Username ──────────────────────────────────────────────────

/**
 * Atualiza o username do usuário no banco.
 */
export async function updateUsername(userId, username) {
  if (!supabase) return;
  const { error } = await supabase
    .from('profiles')
    .update({ username, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) throw error;
}

// ── Leaderboard ───────────────────────────────────────────────

/**
 * Busca o top 50 de jogadores ordenado por max_score.
 * Retorna array vazio se Supabase indisponível.
 */
export async function getLeaderboard() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('username, max_score, max_wave')
    .gt('max_score', 0)
    .order('max_score', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
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
  if (!supabase) return null;
  const safeProfile = currentProfile || {};
  const newMaxScore = Math.max(safeProfile.max_score || 0, score);
  const newMaxWave  = Math.max(safeProfile.max_wave  || 0, wave);

  const payload = {
    id:         userId,
    last_score: score,
    last_wave:  wave,
    max_score:  newMaxScore,
    max_wave:   newMaxWave,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' });

  if (error) {
    console.error('[Auth] Erro em persistScore:', error.message);
    throw error;
  }

  console.log('[Auth] Score persistido com sucesso:', newMaxScore);
  return payload;
}

