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
import { signInWithGoogle, signInWithGithub, signOut, getUserProfile, updateMaxScore } from '../src/api/auth.js';

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
        queryParams: expect.objectContaining({ prompt: 'select_account' })
      })
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

  it('deve validar score e wave antes de pesquisar/atualizar', async () => {
    // Se passarmos valores inválidos, a função deve retornar erro ou ignorar
    const res1 = await updateMaxScore('123', -10, 5);
    expect(mocks.mockFrom).not.toHaveBeenCalled();

    const res2 = await updateMaxScore('123', 100, -1);
    expect(mocks.mockFrom).not.toHaveBeenCalled();
  });
});
