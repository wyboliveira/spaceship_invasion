/**
 * auth.js — Camada de I/O: Firebase Auth + Firestore
 *
 * Este arquivo é o equivalente migrado do antigo auth.js (Supabase).
 * Nenhuma lógica de navegação ou estado de jogo vive aqui —
 * apenas chamadas à API e retorno de dados.
 *
 * ─── Mapeamento Supabase → Firebase ──────────────────────────────────────────
 *  supabase.auth.signInWithOAuth({ provider: 'google' })
 *    → signInWithPopup(auth, new GoogleAuthProvider())
 *
 *  supabase.from('profiles').select('*').eq('id', userId)
 *    → getDoc(doc(db, 'profiles', userId))
 *
 *  supabase.from('profiles').upsert(payload, { onConflict: 'id' })
 *    → setDoc(doc(db, 'profiles', userId), payload, { merge: true })
 *      (merge:true = cria se não existir, atualiza se existir — equivale ao upsert)
 *
 *  supabase.auth.onAuthStateChange(callback)
 *    → onAuthStateChanged(auth, callback)   ← chamado em main.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { auth, db } from '../lib/firebase.js';

// ─── Imports de Firebase Auth ─────────────────────────────────────────────────
// O Firebase Auth usa "providers" — objetos que representam cada provedor OAuth.
// signInWithPopup  → abre uma janela popup para o login (sem sair da página).
// signInWithRedirect → alternativa que redireciona a página (usamos popup aqui).
// signOut          → encerra a sessão localmente E invalida o token no servidor.
import {
  GoogleAuthProvider,
  GithubAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';

// ─── Imports de Firestore ─────────────────────────────────────────────────────
// doc      → referência a UM documento específico (equivale a uma linha do Supabase)
// getDoc   → lê um documento (SELECT * WHERE id = userId)
// setDoc   → escreve/sobrescreve um documento (INSERT ou UPDATE)
// getDocs  → lê múltiplos documentos de uma query (SELECT ... WHERE ... ORDER BY)
// collection → referência a uma coleção (equivale a uma tabela do Supabase)
// query    → constrói uma consulta com filtros e ordenação
// where    → filtro de query (equivale ao .eq(), .gt() do Supabase)
// orderBy  → ordenação (equivale ao .order() do Supabase)
// limit    → limita o número de resultados (equivale ao .limit() do Supabase)
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';


// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Abre popup de login com o Google.
 * GoogleAuthProvider encapsula toda a configuração OAuth do Google.
 * signInWithPopup dispara o fluxo e retorna quando o usuário confirma.
 *
 * Diferença do Supabase: não há redirect — o popup resolve na mesma página.
 * O onAuthStateChanged em main.js é notificado automaticamente quando termina.
 */
export async function signInWithGoogle() {
  if (!auth) throw new Error('Auth indisponível: credenciais Firebase não configuradas.');
  const provider = new GoogleAuthProvider();
  // prompt: 'select_account' força a tela de escolha de conta mesmo se já logado
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

/**
 * Abre popup de login com o GitHub.
 * GithubAuthProvider funciona igual ao Google — só muda o provedor OAuth.
 */
export async function signInWithGithub() {
  if (!auth) throw new Error('Auth indisponível: credenciais Firebase não configuradas.');
  const provider = new GithubAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

/**
 * Encerra a sessão do usuário.
 * firebaseSignOut invalida o token localmente e no servidor Firebase.
 * Diferença do Supabase: não precisamos limpar manualmente as chaves 'sb-*'
 * do localStorage — o Firebase cuida da sua própria persistência.
 */
export async function signOut() {
  if (!auth) return;
  try {
    await firebaseSignOut(auth);
  } catch (err) {
    // signOut pode falhar se a sessão já expirou. Logamos e seguimos.
    console.warn('[Auth] Erro no signOut:', err.message);
  }
}


// ── Perfil ────────────────────────────────────────────────────────────────────

/**
 * Carrega o perfil do usuário do Firestore.
 *
 * doc(db, 'profiles', userId) → referência ao documento na coleção 'profiles'
 *   cujo ID é o userId. É como dizer: SELECT * FROM profiles WHERE id = userId.
 *
 * getDoc() → executa a leitura. Retorna um DocumentSnapshot.
 *   snapshot.exists() → true se o documento existir
 *   snapshot.data()   → os campos do documento como objeto JS
 *
 * Retorna null se o perfil ainda não existir (primeiro login antes do createProfile).
 */
export async function getUserProfile(userId) {
  if (!db) return null;

  // Cria a referência ao documento — ainda não faz nenhuma chamada de rede
  const profileRef = doc(db, 'profiles', userId);

  // getDoc executa a leitura de fato (uma chamada de rede)
  const snapshot = await getDoc(profileRef);

  if (!snapshot.exists()) return null;

  // Retorna os dados do documento + o id (id não vem em data() por padrão)
  return { id: snapshot.id, ...snapshot.data() };
}

/**
 * Cria o documento de perfil no Firestore no primeiro login do usuário.
 *
 * No Supabase, isso era feito por um trigger SQL (setup.sql):
 *   CREATE FUNCTION handle_new_user() ... INSERT INTO profiles (id) VALUES (NEW.id)
 *
 * No Firestore não existe trigger — criamos o documento aqui mesmo,
 * chamado uma única vez em main.js quando getUserProfile retorna null.
 *
 * Campos criados com valores padrão:
 *   role     → 'player' (admin é atribuído manualmente no Console do Firebase)
 *   username → prefixo do email (ex: "wybrendon@gmail.com" → "wybrendon")
 *              O jogador pode trocar depois pela edição no HUD.
 *   scores   → 0 (ainda não jogou nenhuma partida)
 *
 * Usa setDoc sem merge (documento novo — não há nada para mesclar).
 * Retorna o perfil criado para poder sedar o localStorage imediatamente.
 *
 * @param {string} userId
 * @param {string} email — email do usuário (ex: "wybrendon@gmail.com")
 */
export async function createProfile(userId, email) {
  if (!db) return null;

  // Extrai "wybrendon" de "wybrendon@gmail.com"
  // Se por algum motivo não houver email, cai para null
  const defaultUsername = email ? email.split('@')[0] : null;

  const newProfile = {
    role:        'player',
    username:    defaultUsername,
    max_score:   0,
    max_wave:    0,
    last_score:  0,
    last_wave:   0,
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  };

  const profileRef = doc(db, 'profiles', userId);

  // Sem { merge: true } aqui pois o documento é novo — merge seria redundante
  // e sem merge é mais explícito: "criar do zero"
  await setDoc(profileRef, newProfile);

  console.log('[Auth] Perfil criado no Firestore para:', userId);

  return { id: userId, ...newProfile };
}


// ── Username ──────────────────────────────────────────────────────────────────

/**
 * Atualiza o username do usuário no Firestore.
 *
 * setDoc com { merge: true } é o equivalente ao upsert do Supabase:
 *   - Se o documento não existe: cria com os campos fornecidos
 *   - Se já existe: atualiza APENAS os campos fornecidos (não apaga os outros)
 *
 * Sem merge: true, setDoc SOBRESCREVE o documento inteiro — perigo!
 */
export async function updateUsername(userId, username) {
  if (!db) return;
  const profileRef = doc(db, 'profiles', userId);
  await setDoc(
    profileRef,
    { username, updated_at: new Date().toISOString() },
    { merge: true }, // ← fundamental: só atualiza estes campos, mantém o resto
  );
}


// ── Ping / warm-up ────────────────────────────────────────────────────────────

/**
 * Verifica se o Firestore está respondendo com uma leitura leve.
 *
 * Diferença importante do Supabase: o Firestore NÃO tem cold start.
 * Esta função existe por compatibilidade com _lbWithRetry em main.js,
 * mas na prática o Firestore responde em ~50ms sempre.
 *
 * Nunca lança — é fire-and-forget seguro.
 */
export async function pingDatabase() {
  if (!db) return false;
  try {
    // Lê o documento 'ping' da coleção '__health__' — pode não existir,
    // mas a tentativa já valida que o Firestore está acessível.
    await getDoc(doc(db, '__health__', 'ping'));
    return true;
  } catch {
    return false;
  }
}


// ── Leaderboard ───────────────────────────────────────────────────────────────

/**
 * Busca o top 50 de jogadores ordenado por max_score.
 *
 * query() constrói a consulta — equivalente ao SELECT com filtros do Supabase:
 *   supabase.from('profiles')
 *     .select('username, max_score, max_wave')
 *     .gt('max_score', 0)
 *     .order('max_score', { ascending: false })
 *     .limit(50)
 *
 * where('max_score', '>', 0) → filtra apenas quem tem score registrado
 * orderBy('max_score', 'desc') → ordena do maior para o menor
 *
 * IMPORTANTE: no Firestore, um campo usado em where() E orderBy() juntos
 * exige um índice composto — o console Firebase avisa se faltar.
 */
export async function getLeaderboard() {
  if (!db) return [];

  const profilesRef = collection(db, 'profiles');
  const q = query(
    profilesRef,
    where('max_score', '>', 0),        // só quem jogou ao menos uma vez
    orderBy('max_score', 'desc'),       // ranking decrescente
    limit(50),                          // máximo 50 entradas
  );

  const snapshot = await getDocs(q);

  // snapshot.docs é um array de DocumentSnapshot
  // .map() extrai só os campos que o leaderboard precisa exibir
  return snapshot.docs.map(d => {
    const data = d.data();
    return {
      username:  data.username  || null,
      max_score: data.max_score || 0,
      max_wave:  data.max_wave  || 0,
    };
  });
}


// ── Score ─────────────────────────────────────────────────────────────────────

/**
 * Persiste score e wave no Firestore.
 *
 * setDoc com merge:true é o equivalente ao upsert do Supabase:
 *   supabase.from('profiles').upsert(payload, { onConflict: 'id' })
 *
 * Calcula max_score / max_wave localmente para evitar race condition
 * de leitura-escrita (ler o atual, comparar, escrever o maior).
 *
 * @param {string} userId
 * @param {number} score
 * @param {number} wave
 * @param {Object} currentProfile — perfil atual do localStore (para calcular max)
 * @returns {Object} payload salvo
 */
export async function persistScore(userId, score, wave, currentProfile = {}) {
  if (!db) return null;

  const safeProfile = currentProfile || {};
  const newMaxScore = Math.max(safeProfile.max_score || 0, score);
  const newMaxWave  = Math.max(safeProfile.max_wave  || 0, wave);

  const payload = {
    last_score: score,
    last_wave:  wave,
    max_score:  newMaxScore,
    max_wave:   newMaxWave,
    updated_at: new Date().toISOString(),
    // Inclui username se disponível — assim o leaderboard sempre fica atualizado
    ...(safeProfile.username ? { username: safeProfile.username } : {}),
  };

  // doc(db, 'profiles', userId) → referência ao documento do usuário
  // setDoc com merge:true → cria se não existe, mescla se existe
  const profileRef = doc(db, 'profiles', userId);
  await setDoc(profileRef, payload, { merge: true });

  console.log('[Auth] Score persistido com sucesso:', newMaxScore);

  // Retorna o payload + id para compatibilidade com o código do main.js
  return { id: userId, ...payload };
}
