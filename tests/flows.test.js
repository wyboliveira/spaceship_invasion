// @vitest-environment jsdom
/**
 * flows.test.js — Fluxos de integração simulados (E2E)
 *
 * Testa os fluxos principais do jogo com a abordagem local-first:
 * dados são salvos no localStorage durante o jogo e enviados ao
 * Supabase somente quando o usuário clica em SYNC RECORDS.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithGoogle } from '../src/api/auth.js';
import { supabase } from '../src/lib/supabase.js';
import {
  saveLocalProgress,
  loadLocalProgress,
  markSynced,
  clearLocalProgress,
} from '../src/lib/localStore.js';

vi.mock('../src/lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signOut:         vi.fn().mockResolvedValue({ error: null }),
    },
    from: vi.fn(),
  },
}));

const USER_ID = 'user_123';

describe('Fluxos de Integração', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('Fluxo 1: Login deve forçar prompt select_account no Google', async () => {
    await signInWithGoogle();
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      options: expect.objectContaining({
        queryParams: expect.objectContaining({ prompt: 'select_account' }),
      }),
    }));
  });

  it('Fluxo 2: Partida salva localmente com pendingSync = true (sem rede)', () => {
    // Simula o fim de uma partida — localStorage atualizado imediatamente
    saveLocalProgress(USER_ID, 3500, 7);

    const local = loadLocalProgress(USER_ID);
    expect(local).not.toBeNull();
    expect(local.last_score).toBe(3500);
    expect(local.last_wave).toBe(7);
    expect(local.pendingSync).toBe(true);

    // Supabase NÃO foi chamado — nenhuma rede neste fluxo
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('Fluxo 3: SYNC RECORDS envia dados locais ao Supabase e marca como sincronizado', async () => {
    // Dados locais de várias partidas acumuladas
    saveLocalProgress(USER_ID, 1000, 3);
    saveLocalProgress(USER_ID, 5000, 8); // max_score = 5000, max_wave = 8

    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue({ upsert: mockUpsert });

    // Simula o clique no botão SYNC RECORDS
    const { persistScore } = await import('../src/api/auth.js');
    const local = loadLocalProgress(USER_ID);
    await persistScore(USER_ID, local.last_score, local.last_wave, local);

    // Supabase recebeu os dados corretos
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_ID, last_score: 5000, max_score: 5000 }),
      expect.objectContaining({ onConflict: 'id' }),
    );

    // Após sync bem-sucedido, marca como sincronizado
    const updated = markSynced();
    expect(updated.pendingSync).toBe(false);
    expect(updated.lastSyncedAt).not.toBeNull();
  });

  it('Fluxo 4: Zerar histórico zeroa localStorage e marca pendingSync (banco fica para o SYNC)', () => {
    saveLocalProgress(USER_ID, 9000, 15);

    const cleared = clearLocalProgress(USER_ID);
    expect(cleared.max_score).toBe(0);
    expect(cleared.max_wave).toBe(0);
    expect(cleared.pendingSync).toBe(true);

    // Supabase NÃO foi chamado — será atualizado quando o usuário clicar em SYNC
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
