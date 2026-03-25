// @vitest-environment jsdom
/**
 * localStore.test.js (antigo history.test.js)
 *
 * Testa o módulo lib/localStore.js — cache local de progresso do jogador.
 * Com a abordagem local-first, o localStorage é a fonte de verdade durante
 * o jogo. O Supabase só é atualizado quando o usuário clica em SYNC RECORDS.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveLocalProgress,
  loadLocalProgress,
  seedFromDatabase,
  markSynced,
  clearLocalProgress,
  updateLocalUsername,
} from '../src/lib/localStore.js';

const USER_ID = 'user-abc-123';

describe('LocalStore — saveLocalProgress', () => {
  beforeEach(() => localStorage.clear());

  it('deve salvar score e wave no localStorage', () => {
    const result = saveLocalProgress(USER_ID, 500, 3);
    expect(result.last_score).toBe(500);
    expect(result.last_wave).toBe(3);
    expect(result.userId).toBe(USER_ID);
  });

  it('deve calcular max_score e max_wave corretamente', () => {
    saveLocalProgress(USER_ID, 500, 3);
    const result = saveLocalProgress(USER_ID, 200, 5); // score menor, wave maior
    expect(result.max_score).toBe(500); // mantém o maior
    expect(result.max_wave).toBe(5);    // atualiza para o maior
    expect(result.last_score).toBe(200);
    expect(result.last_wave).toBe(5);
  });

  it('deve marcar pendingSync = true após salvar', () => {
    const result = saveLocalProgress(USER_ID, 100, 1);
    expect(result.pendingSync).toBe(true);
  });

  it('deve preservar o username existente ao salvar nova partida', () => {
    saveLocalProgress(USER_ID, 100, 1);
    updateLocalUsername(USER_ID, 'CoolPlayer');
    const result = saveLocalProgress(USER_ID, 200, 2);
    expect(result.username).toBe('CoolPlayer');
  });
});

describe('LocalStore — loadLocalProgress', () => {
  beforeEach(() => localStorage.clear());

  it('deve retornar null se não há dados salvos', () => {
    expect(loadLocalProgress(USER_ID)).toBeNull();
  });

  it('deve retornar null se os dados são de outro userId', () => {
    saveLocalProgress(USER_ID, 500, 3);
    expect(loadLocalProgress('outro-user-id')).toBeNull();
  });

  it('deve retornar os dados corretos para o userId correspondente', () => {
    saveLocalProgress(USER_ID, 999, 7);
    const result = loadLocalProgress(USER_ID);
    expect(result).not.toBeNull();
    expect(result.last_score).toBe(999);
    expect(result.last_wave).toBe(7);
  });
});

describe('LocalStore — seedFromDatabase', () => {
  beforeEach(() => localStorage.clear());

  it('deve inicializar o cache com dados vindos do banco', () => {
    const dbProfile = { max_score: 10000, max_wave: 12, last_score: 3000, last_wave: 8, username: 'StarPlayer' };
    const result = seedFromDatabase(USER_ID, dbProfile);
    expect(result.max_score).toBe(10000);
    expect(result.max_wave).toBe(12);
    expect(result.username).toBe('StarPlayer');
    expect(result.pendingSync).toBe(false);
    expect(result.lastSyncedAt).not.toBeNull();
  });

  it('deve tratar campos ausentes no perfil do banco com valor 0', () => {
    const result = seedFromDatabase(USER_ID, {});
    expect(result.max_score).toBe(0);
    expect(result.max_wave).toBe(0);
    expect(result.username).toBeNull();
  });
});

describe('LocalStore — markSynced', () => {
  beforeEach(() => localStorage.clear());

  it('deve atualizar lastSyncedAt e definir pendingSync = false', () => {
    saveLocalProgress(USER_ID, 500, 3);
    const before = loadLocalProgress(USER_ID);
    expect(before.pendingSync).toBe(true);
    expect(before.lastSyncedAt).toBeNull();

    const result = markSynced();
    expect(result.pendingSync).toBe(false);
    expect(result.lastSyncedAt).not.toBeNull();
  });
});

describe('LocalStore — clearLocalProgress', () => {
  beforeEach(() => localStorage.clear());

  it('deve zerar scores e waves mas preservar o username', () => {
    saveLocalProgress(USER_ID, 5000, 10);
    updateLocalUsername(USER_ID, 'TestUser');

    const result = clearLocalProgress(USER_ID);
    expect(result.max_score).toBe(0);
    expect(result.max_wave).toBe(0);
    expect(result.last_score).toBe(0);
    expect(result.last_wave).toBe(0);
    expect(result.username).toBe('TestUser'); // username preservado
    expect(result.pendingSync).toBe(true);    // marcado para sync
  });

  it('deve zerar lastSyncedAt após limpar histórico', () => {
    seedFromDatabase(USER_ID, { max_score: 1000 });
    const result = clearLocalProgress(USER_ID);
    expect(result.lastSyncedAt).toBeNull();
  });
});

describe('LocalStore — updateLocalUsername', () => {
  beforeEach(() => localStorage.clear());

  it('deve atualizar somente o username sem alterar os scores', () => {
    saveLocalProgress(USER_ID, 800, 4);
    updateLocalUsername(USER_ID, 'NovaEstrela');

    const result = loadLocalProgress(USER_ID);
    expect(result.username).toBe('NovaEstrela');
    expect(result.last_score).toBe(800); // score não mudou
    expect(result.last_wave).toBe(4);
  });

  it('deve retornar null se o userId não corresponder', () => {
    saveLocalProgress(USER_ID, 800, 4);
    const result = updateLocalUsername('outro-id', 'Hacker');
    expect(result).toBeNull();
  });
});
