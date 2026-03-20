// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { state, updateState } from '../src/game/state.js';
import { clearUserHistory, signOut, signInWithGoogle } from '../src/api/auth.js';
import { supabase } from '../src/lib/supabase.js';

// Mocks do Supabase para evitar chamadas de rede reais e dependências de arquivos dist
vi.mock('../src/lib/supabase.js', () => {
  const mockFrom = vi.fn();
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();

  return {
    supabase: {
      from: mockFrom,
      auth: {
        signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      }
    },
    mockFrom, mockUpdate, mockEq
  };
});
import { mockFrom } from '../src/lib/supabase.js';

describe('Integration Flows (E2E Simulado)', () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
    updateState({
      over: true,
      wave: 0,
      score: 0,
      session: { user: { id: 'user_123', email: 'test@example.com' } },
      userProfile: { id: 'user_123', max_score: 5000, max_wave: 10 }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Fluxo 1: Login deve forçar prompt select_account', async () => {
     await signInWithGoogle();
     expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
       options: expect.objectContaining({
         queryParams: expect.objectContaining({ prompt: 'select_account' })
       })
     }));
  });

  it('Fluxo 2: Zerar Histórico destrava a UI no caso de falha de conexão (Timeout)', async () => {
    vi.useFakeTimers();
    // Simula mock infinito
    vi.mocked(supabase.from).mockReturnValue({
      update: () => ({
        eq: () => new Promise(() => {}) // Promise que nunca resolve
      })
    });

    const resetPromise = clearUserHistory('user_123');
    expect(state.userProfile.max_score).toBe(0); // Optimistic
    
    // Avançamos o timer para acionar a rejeição do Promise.race do arquivo original
    vi.runAllTimers();
    await resetPromise;
    expect(state.userProfile.max_score).toBe(0); // Deve manter o estado zerado
  });

  it('Fluxo 3: Callbacks de Logout garantem reset de sessão instantâneo', async () => {
    // Como o mock retorna Promise resolvido instantaneamente, não precisamos de fake timers
    await signOut();
    expect(state.session).toBeNull();
    expect(state.userProfile).toBeNull();
  });
});
