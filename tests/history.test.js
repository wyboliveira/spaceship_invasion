// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { clearUserHistory } from '../src/api/auth.js';
import { state, updateState } from '../src/game/state.js';
import { supabase } from '../src/lib/supabase.js';

vi.mock('../src/lib/supabase.js', () => {
  const mockEq = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const mockUpdate = vi.fn(() => ({ eq: mockEq }));
  const mockFrom = vi.fn(() => ({ update: mockUpdate }));
  
  return {
    supabase: {
      from: mockFrom
    },
    // Exportamos os mocks para o teste acessar (opcional, ou podemos usar vi.mocked(supabase.from))
    mockFrom, mockUpdate, mockEq
  };
});
import { mockFrom, mockUpdate, mockEq } from '../src/lib/supabase.js';
import { processPendingResets } from '../src/api/auth.js';

describe('History Reset Logic', () => {
  beforeEach(() => {
    updateState({
      session: { user: { id: '123' } },
      userProfile: { id: '123', max_score: 1000, max_wave: 5, last_score: 500, last_wave: 2 }
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should set localStorage flag at start and remove it on success', async () => {
    const promise = clearUserHistory('123');
    expect(localStorage.getItem('spaceship_invasion_pending_reset')).toBe('123');
    
    await promise;
    expect(localStorage.getItem('spaceship_invasion_pending_reset')).toBeNull();
  });

  it('should call supabase update with reset values', async () => {
    const promise = clearUserHistory('123');
    await promise;
    
    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      max_score: 0,
      max_wave: 0,
      last_score: 0,
      last_wave: 0
    }));
    expect(mockEq).toHaveBeenCalledWith('id', '123');
  });

  it('should keep localStorage flag on timeout and retry via processPendingResets', async () => {
    vi.useFakeTimers();
    // Simula mock que nunca resolve
    mockEq.mockReturnValueOnce(new Promise(() => {})); 
    
    const promise = clearUserHistory('123');
    
    // Avança tempo para disparar o timeout do Promise.race (5000ms)
    vi.advanceTimersByTime(5100); 
    
    try {
      await promise;
    } catch (err) {
      expect(err.message).toBe('Timeout ao zerar histórico');
    }
    
    // Flag deve continuar lá pois falhou
    expect(localStorage.getItem('spaceship_invasion_pending_reset')).toBe('123');
    
    // Agora simula recuperação e processPendingResets
    mockEq.mockReturnValue(Promise.resolve({ error: null }));
    await processPendingResets();
    
    expect(localStorage.getItem('spaceship_invasion_pending_reset')).toBeNull();
  });
});
