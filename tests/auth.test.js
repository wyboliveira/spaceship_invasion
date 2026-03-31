/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks hoisted para estarem disponíveis antes de qualquer import/vi.mock
const mocks = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  return {
    mockSignInWithOAuth: vi.fn(() => Promise.resolve({ error: null })),
    mockSignOut: vi.fn(() => Promise.resolve({ error: null })),
    mockMaybeSingle: mockMaybeSingle,
    mockUpdate: vi.fn(() => ({ 
      eq: vi.fn(() => ({ 
        maybeSingle: mockMaybeSingle 
      })) 
    })),
    mockFrom: vi.fn()
  };
});

// Configura o mockFrom para retornar a estrutura fluente
mocks.mockFrom.mockReturnValue({
  select: vi.fn(() => ({
    eq: vi.fn(() => ({
      maybeSingle: mocks.mockMaybeSingle,
    })),
  })),
  upsert: vi.fn(() => ({
    select: vi.fn(() => Promise.resolve({ data: [], error: null }))
  })),
  update: mocks.mockUpdate,
});

vi.mock('../src/lib/supabase.js', () => ({
  supabase: {
    auth: {
      signInWithOAuth: mocks.mockSignInWithOAuth,
      signOut: mocks.mockSignOut,
    },
    from: mocks.mockFrom,
  },
}));

// Importações dos serviços após o mock ser configurado
import { signInWithGoogle, signInWithGithub, signOut, getUserProfile, persistScore, updateUsername, getLeaderboard } from '../src/api/auth.js';

describe('Auth API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve chamar signInWithOAuth para Google com prompt select_account', async () => {
    await signInWithGoogle();
    expect(mocks.mockSignInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'google',
      options: expect.objectContaining({
        queryParams: expect.objectContaining({ prompt: 'select_account' })
      })
    }));
  });

  it('deve chamar signInWithOAuth para GitHub com prompt select_account', async () => {
    await signInWithGithub();
    expect(mocks.mockSignInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'github',
      options: expect.objectContaining({
        queryParams: expect.objectContaining({ prompt: 'select_account' }),
      }),
    }));
  });

  it('deve chamar signOut', async () => {
    await signOut();
    expect(mocks.mockSignOut).toHaveBeenCalled();
  });

  it('deve recuperar o perfil do usuário', async () => {
    const mockProfile = { id: '123', username: 'TestUser', role: 'player' };
    mocks.mockMaybeSingle.mockResolvedValue({ data: mockProfile, error: null });

    const profile = await getUserProfile('123');
    expect(profile).toEqual(mockProfile);
  });

  it('deve persistir score via upsert com os campos calculados corretamente', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mocks.mockFrom.mockReturnValueOnce({ upsert: mockUpsert });

    const currentProfile = { max_score: 50, max_wave: 5 };
    const res = await persistScore('123', 100, 10, currentProfile);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id:         '123',
        last_score: 100,
        last_wave:  10,
        max_score:  100,
        max_wave:   10,
      }),
      { onConflict: 'id' },
    );
    expect(res.last_score).toBe(100);
    expect(res.max_score).toBe(100);
  });


  it('deve atualizar o username no banco via update', async () => {
    const mockEq     = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn(() => ({ eq: mockEq }));
    mocks.mockFrom.mockReturnValueOnce({ update: mockUpdate });

    await updateUsername('123', 'NovaEstrela');

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'NovaEstrela' }),
    );
    expect(mockEq).toHaveBeenCalledWith('id', '123');
  });

  describe('getLeaderboard', () => {
    /** Monta a cadeia fluente: .select().gt().order().limit() */
    function mockLeaderboardChain(resolvedValue) {
      const mockLimit = vi.fn().mockResolvedValue(resolvedValue);
      const mockOrder = vi.fn(() => ({ limit: mockLimit }));
      const mockGt    = vi.fn(() => ({ order: mockOrder }));
      const mockSel   = vi.fn(() => ({ gt: mockGt }));
      mocks.mockFrom.mockReturnValueOnce({ select: mockSel });
      return { mockSel, mockGt, mockOrder, mockLimit };
    }

    it('deve retornar lista de jogadores ordenada por max_score', async () => {
      const leaderboardData = [
        { username: 'Fulano',  max_score: 5000, max_wave: 10 },
        { username: 'Cicrano', max_score: 3000, max_wave: 7  },
      ];
      mockLeaderboardChain({ data: leaderboardData, error: null });

      const result = await getLeaderboard();
      expect(result).toEqual(leaderboardData);
      expect(result).toHaveLength(2);
    });

    it('deve filtrar score zero via .gt("max_score", 0)', async () => {
      const { mockGt } = mockLeaderboardChain({ data: [], error: null });

      await getLeaderboard();
      expect(mockGt).toHaveBeenCalledWith('max_score', 0);
    });

    it('deve limitar a 50 registros via .limit(50)', async () => {
      const { mockLimit } = mockLeaderboardChain({ data: [], error: null });

      await getLeaderboard();
      expect(mockLimit).toHaveBeenCalledWith(50);
    });

    it('deve ordenar por max_score descendente', async () => {
      const { mockOrder } = mockLeaderboardChain({ data: [], error: null });

      await getLeaderboard();
      expect(mockOrder).toHaveBeenCalledWith('max_score', { ascending: false });
    });

    it('deve lançar erro quando Supabase retorna error', async () => {
      const supabaseError = { message: 'Erro de conexão', code: '500' };
      mockLeaderboardChain({ data: null, error: supabaseError });

      await expect(getLeaderboard()).rejects.toEqual(supabaseError);
    });

    it('deve retornar array vazio quando não há dados', async () => {
      mockLeaderboardChain({ data: null, error: null });

      const result = await getLeaderboard();
      expect(result).toEqual([]);
    });
  });
});
