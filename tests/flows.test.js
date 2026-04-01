// @vitest-environment jsdom
/**
 * flows.test.js — Fluxos de integração simulados (E2E)
 *
 * Testa os fluxos principais do jogo com a abordagem local-first:
 * dados são salvos no localStorage durante o jogo e enviados ao
 * Firebase somente quando o usuário clica em SYNC RECORDS.
 *
 * ─── Diferença Supabase → Firebase nestes fluxos ────────────────────────────
 * Antes: supabase.from('profiles').upsert(payload, { onConflict: 'id' })
 * Agora: setDoc(doc(db, 'profiles', userId), payload, { merge: true })
 *
 * A lógica do leaderboard mudou de cadeia fluente (.select().gt().order())
 * para uma query construída com query(collection, where, orderBy, limit).
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockSignInWithPopup: vi.fn(),
  mockSetDoc:          vi.fn(),
  mockGetDocs:         vi.fn(),
}));

vi.mock('../src/lib/firebase.js', () => ({
  auth: { _isMockAuth: true },
  db:   { _isMockDb:   true },
}));

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(() => ({ _provider: 'google', setCustomParameters: vi.fn() })),
  GithubAuthProvider: vi.fn(() => ({ _provider: 'github', setCustomParameters: vi.fn() })),
  signInWithPopup:    mocks.mockSignInWithPopup,
  signOut:            vi.fn().mockResolvedValue(),
}));

vi.mock('firebase/firestore', () => ({
  doc:        vi.fn((_db, col, id) => ({ _col: col, _id: id })),
  getDoc:     vi.fn(),
  setDoc:     mocks.mockSetDoc,
  getDocs:    mocks.mockGetDocs,
  collection: vi.fn(),
  query:      vi.fn((...args) => ({ _query: args })),
  where:      vi.fn((f, op, v) => ({ _where: { f, op, v } })),
  orderBy:    vi.fn((f, d) => ({ _orderBy: { f, d } })),
  limit:      vi.fn(n => ({ _limit: n })),
}));

import { signInWithGoogle, getLeaderboard, persistScore } from '../src/api/auth.js';
import {
  saveLocalProgress,
  loadLocalProgress,
  markSynced,
  clearLocalProgress,
} from '../src/lib/localStore.js';

const USER_ID = 'user_123';

describe('Fluxos de Integração', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.mockSignInWithPopup.mockResolvedValue({ user: { uid: USER_ID } });
    mocks.mockSetDoc.mockResolvedValue();
  });

  it('Fluxo 1: Login deve abrir popup com GoogleAuthProvider', async () => {
    await signInWithGoogle();
    expect(mocks.mockSignInWithPopup).toHaveBeenCalledOnce();
    // Verifica que o provider passado ao popup é o Google
    const [, provider] = mocks.mockSignInWithPopup.mock.calls[0];
    expect(provider._provider).toBe('google');
  });

  it('Fluxo 2: Partida salva localmente com pendingSync = true (sem rede)', () => {
    // Simula o fim de uma partida — localStorage atualizado imediatamente.
    // O Firebase NÃO é chamado neste fluxo — só no SYNC RECORDS.
    saveLocalProgress(USER_ID, 3500, 7);

    const local = loadLocalProgress(USER_ID);
    expect(local).not.toBeNull();
    expect(local.last_score).toBe(3500);
    expect(local.last_wave).toBe(7);
    expect(local.pendingSync).toBe(true);

    // Firestore não foi tocado
    expect(mocks.mockSetDoc).not.toHaveBeenCalled();
  });

  it('Fluxo 3: SYNC RECORDS envia dados locais ao Firestore e marca como sincronizado', async () => {
    // Simula várias partidas acumuladas antes do sync
    saveLocalProgress(USER_ID, 1000, 3);
    saveLocalProgress(USER_ID, 5000, 8); // max_score = 5000

    const local = loadLocalProgress(USER_ID);
    await persistScore(USER_ID, local.last_score, local.last_wave, local);

    // setDoc foi chamado com os dados corretos
    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.last_score).toBe(5000);
    expect(payload.max_score).toBe(5000);

    // setDoc usou merge:true para não apagar campos como role
    const options = mocks.mockSetDoc.mock.calls[0][2];
    expect(options).toEqual({ merge: true });

    // Após sync bem-sucedido, marca localmente como sincronizado
    const updated = markSynced();
    expect(updated.pendingSync).toBe(false);
    expect(updated.lastSyncedAt).not.toBeNull();
  });

  it('Fluxo 4: Zerar histórico zeroa localStorage e marca pendingSync (Firestore fica para o SYNC)', () => {
    saveLocalProgress(USER_ID, 9000, 15);

    const cleared = clearLocalProgress(USER_ID);
    expect(cleared.max_score).toBe(0);
    expect(cleared.max_wave).toBe(0);
    expect(cleared.pendingSync).toBe(true);

    // Firebase NÃO foi chamado — será atualizado quando clicar em SYNC
    expect(mocks.mockSetDoc).not.toHaveBeenCalled();
  });

  it('Fluxo 5: Leaderboard retorna apenas jogadores com score maior que zero', async () => {
    const leaderboardData = [
      { username: 'Fulano',  max_score: 5000, max_wave: 10 },
      { username: 'Cicrano', max_score: 1200, max_wave: 4  },
    ];
    mocks.mockGetDocs.mockResolvedValueOnce({
      docs: leaderboardData.map(d => ({ data: () => d })),
    });

    const result = await getLeaderboard();
    expect(result).toHaveLength(2);
    expect(result[0].username).toBe('Fulano');
    expect(result[0].max_score).toBe(5000);
  });

  it('Fluxo 6: Leaderboard retorna array vazio quando banco não tem registros com score > 0', async () => {
    mocks.mockGetDocs.mockResolvedValueOnce({ docs: [] });

    const result = await getLeaderboard();
    expect(result).toEqual([]);
  });
});
