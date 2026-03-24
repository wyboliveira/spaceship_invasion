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

  it('Fluxo 2: Zerar Histórico define flag de resiliência no localStorage', async () => {
    // Simula sucesso
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    });

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

    await clearUserHistory('user_123');
    
    // Verificamos se a flag de segurança foi definida antes e removida depois
    expect(setItemSpy).toHaveBeenCalledWith('spaceship_invasion_pending_reset', 'user_123');
    expect(removeItemSpy).toHaveBeenCalledWith('spaceship_invasion_pending_reset');
  });

  it('Fluxo 3: Se o reset falhar, a flag deve permanecer no localStorage', async () => {
    // Simula erro de rede
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.reject(new Error('Network Error')))
      }))
    });

    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');

    await expect(clearUserHistory('user_123')).rejects.toThrow('Network Error');
    
    // A flag não deve ter sido removida se o I/O falhou
    expect(removeItemSpy).not.toHaveBeenCalledWith('spaceship_invasion_pending_reset');
  });
});
