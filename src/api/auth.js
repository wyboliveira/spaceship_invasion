import { supabase } from '../lib/supabase.js';
import { state, updateState } from '../game/state.js';

/**
 * Inicia o fluxo de login com o Google OAuth.
 * Força a exibição da tela de seleção de conta para permitir troca de usuários.
 * @async
 * @returns {Promise<void>}
 */
export async function signInWithGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });
    if (error) throw error;
  } catch (err) {
    console.error("[Auth] Erro no login Google:", err.message);
    alert("Erro ao entrar com Google: " + err.message);
  }
}

/**
 * Inicia o fluxo de login com o GitHub OAuth.
 * Força a exibição da tela de seleção de conta para permitir troca de usuários.
 * @async
 * @returns {Promise<void>}
 */
export async function signInWithGithub() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({ 
      provider: 'github',
      options: {
        redirectTo: window.location.origin,
        queryParams: {
          prompt: 'select_account'
        }
      }
    });
    if (error) throw error;
  } catch (err) {
    console.error("[Auth] Erro no login GitHub:", err.message);
    alert("Erro ao entrar com GitHub: " + err.message);
  }
}


/**
 * Realiza o logout do usuário no Supabase e limpa o estado local.
 * Inclui um mecanismo de timeout para evitar travamentos da interface caso a conexão falhe.
 * @async
 * @returns {Promise<void>}
 */
export async function signOut() {
  console.log('[Auth] Iniciando processo de saída...');
  
  // Timeout de 5 segundos para garantir que o usuário não fique preso na tela "Saindo..."
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Tempo limite excedido ao sair')), 5000)
  );

  try {
    // Tenta deslogar no servidor
    await Promise.race([
      supabase.auth.signOut(),
      timeout
    ]);
    console.log('[Auth] Saída realizada com sucesso (ou tempo limite atingido)');
  } catch (err) {
    console.warn('[Auth] Aviso/Erro na saída:', err.message);
  } finally {
    // GARANTIA: Limpa o estado local independentemente do resultado do servidor
    updateState({ session: null, userProfile: null });
    // Dispara evento global para forçar a atualização imediata do Menu Principal (main.js)
    window.dispatchEvent(new Event('auth-status-changed')); 
  }
}

/**
 * Recupera o perfil público do usuário na tabela 'profiles'.
 * @async
 * @param {string} userId - UUID do usuário autenticado no Supabase.
 * @returns {Promise<Object|null>} Retorna o objeto do perfil ou null em caso de erro.
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle(); // Usar maybeSingle evita erro 406 se não houver registro

  if (error) {
    console.error('[Auth] Error fetching profile:', error.message);
    return null;
  }
  
  if (!data) {
    console.warn('[Auth] Profile not found for user:', userId);
  }
  
  return data;
}

/**
 * Sincroniza a pontuação máxima (max_score) e a onda máxima (max_wave) no Supabase.
 * Utiliza o padrão Optimistic UI e protege contra condições de corrida (Race Conditions).
 * @async
 * @param {string} userId - ID do usuário.
 * @param {number} score - Pontuação obtida na partida atual.
 * @param {number} wave - Onda alcançada na partida atual.
 * @returns {Promise<Object>} Resultado da operação (data e error).
 */
export async function updateMaxScore(userId, score, wave) {
  // 1. Snapshot do estado atual para consistência imutável durante o processo assíncrono
  const profileSnapshot = { ...(state.userProfile || {}) };

  // Validações básicas
  if (!userId || score < 0 || wave < 0) {
    console.warn('[Persistência] ⚠️ Dados inválidos ignorados:', { userId, score, wave });
    return { error: 'Dados inválidos' };
  }

  // Calcula novos recordes baseados no snapshot (não permite diminuir valores)
  const newMaxScore = Math.max(profileSnapshot.max_score || 0, score);
  const newMaxWave  = Math.max(profileSnapshot.max_wave   || 0, wave);
  
  // 2. Atualização Otimista: reflete na interface imediatamente
  const optimisticData = {
    ...profileSnapshot,
    last_score: score,
    last_wave:  wave,
    max_score:  newMaxScore,
    max_wave:   newMaxWave
  };
  updateState({ userProfile: optimisticData });

  console.log(`[Persistência] 🔄 Tentando salvar: Score ${score}, Wave ${wave} (User: ${userId})`);

  try {
    // 3. Persistência: Upsert garante que o registro exista ou seja atualizado
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ 
        id: userId,
        last_score: score,
        last_wave:  wave,
        max_score:  newMaxScore, 
        max_wave:   newMaxWave,
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) {
      console.error('[Persistência] ❌ Erro de Sincronização:', error.message);
      return { data: null, error };
    }

    if (data?.[0]) {
      // 4. Reconciliação: sincroniza o estado global com o retorno real do banco
      updateState({ userProfile: data[0] });
      console.log('[Persistência] ✅ Salvo com sucesso:', data[0]);
      return { data: data[0], error: null };
    }

    return { data: null, error: 'No data returned' };
  } catch (err) {
    console.error('[Persistência] 🛑 Falha crítica na API:', err.message);
    return { data: null, error: err };
  }
}

/** 
 * Chave utilizada no localStorage para persistir resets de histórico pendentes.
 * Garante que o banco seja atualizado mesmo após timeouts ou F5.
 */
const PENDING_RESET_KEY = 'spaceship_invasion_pending_reset';

/**
 * Processa qualquer reset de histórico que tenha ficado pendente devido a timeouts.
 * Deve ser chamada na inicialização do jogo ou após o login.
 * @async
 */
export async function processPendingResets() {
  const pendingId = localStorage.getItem(PENDING_RESET_KEY);
  if (!pendingId) return;

  console.log(`[Persistência] Detectado reset pendente (User: ${pendingId}). Tentando sincronizar...`);
  
  try {
    const { error } = await supabase.from('profiles').update({
      max_score: 0,
      max_wave: 0,
      last_score: 0,
      last_wave: 0,
      updated_at: new Date().toISOString()
    }).eq('id', pendingId);

    if (!error) {
      console.log(`[Persistência] ✅ Reset pendente concluído com sucesso para ${pendingId}.`);
      localStorage.removeItem(PENDING_RESET_KEY);
    } else {
      console.warn(`[Persistência] ⏳ Falha ao processar reset pendente (tentará novamente):`, error.message);
      // Agenda nova tentativa em 60 segundos se o erro for de rede/timeout
      setTimeout(processPendingResets, 60000);
    }
  } catch (err) {
    console.warn(`[Persistência] ❌ Erro inesperado no processamento do reset:`, err.message);
  }
}

/**
 * Reseta todo o histórico do usuário no banco e localmente.
 * Possui mecanismo de segurança contra travamentos de interface e persistência local de tarefa.
 * @async
 * @param {string} userId - ID do usuário autenticado.
 * @returns {Promise<void>}
 */
export async function clearUserHistory(userId) {
  console.log(`[Persistência] Iniciando zeramento de histórico para ${userId}...`);
  
  const resetData = {
    max_score:  0,
    max_wave:   0,
    last_score: 0,
    last_wave:  0,
    updated_at: new Date().toISOString()
  };

  // 1. Marca como pendente no localStorage (Resiliência)
  localStorage.setItem(PENDING_RESET_KEY, userId);

  // 2. Atualização Otimista local Imediata para destravar a UI visualmente
  if (state.userProfile) {
    updateState({ 
      userProfile: { ...state.userProfile, ...resetData } 
    });
  }

  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout na sincronização do banco')), 5000)
  );

  try {
    // 3. Tentativa de atualização no Supabase com limite de tempo para a UI
    await Promise.race([
      supabase.from('profiles').update(resetData).eq('id', userId),
      timeout
    ]);
    
    // Sucesso! Remove a flag de pendência
    localStorage.removeItem(PENDING_RESET_KEY);
    console.log('[Persistência] ✅ Histórico zerado com sucesso no servidor.');
  } catch (err) {
    console.warn('[Persistência] ⏳ Timeout/Erro no zeramento imediato. O processo continuará em background:', err.message);
    // Agenda retentativa em background
    setTimeout(processPendingResets, 30000);
  } finally {
    // GARANTIA: Sempre forçamos o estado local para zero e redesenhamos o menu
    if (state.userProfile) {
      updateState({ 
        userProfile: { ...state.userProfile, ...resetData } 
      });
    }
    window.dispatchEvent(new Event('auth-status-changed'));
  }
}
