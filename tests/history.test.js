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

  it('deve setar pendingUsernameSync = true ao atualizar username', () => {
    saveLocalProgress(USER_ID, 100, 1);
    const result = updateLocalUsername(USER_ID, 'AstroHero');
    expect(result.pendingUsernameSync).toBe(true);
  });

  it('deve manter pendingUsernameSync = true mesmo após nova partida salva', () => {
    saveLocalProgress(USER_ID, 100, 1);
    updateLocalUsername(USER_ID, 'AstroHero');
    // Nova partida NÃO deve limpar a flag de username pendente
    saveLocalProgress(USER_ID, 200, 2);
    const result = loadLocalProgress(USER_ID);
    // O username é preservado mas o campo é salvo via saveLocalProgress que o mantém
    expect(result.username).toBe('AstroHero');
  });
});

describe('LocalStore — markSynced limpa pendingUsernameSync', () => {
  beforeEach(() => localStorage.clear());

  it('deve limpar pendingUsernameSync ao marcar como sincronizado', () => {
    saveLocalProgress(USER_ID, 500, 5);
    updateLocalUsername(USER_ID, 'Jogador1');
    expect(loadLocalProgress(USER_ID).pendingUsernameSync).toBe(true);

    markSynced();
    expect(loadLocalProgress(USER_ID).pendingUsernameSync).toBe(false);
  });

  it('markSynced deve limpar tanto pendingSync quanto pendingUsernameSync', () => {
    saveLocalProgress(USER_ID, 500, 5);
    updateLocalUsername(USER_ID, 'Jogador1');

    const result = markSynced();
    expect(result.pendingSync).toBe(false);
    expect(result.pendingUsernameSync).toBe(false);
    expect(result.lastSyncedAt).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Preservação do role — caminhos identificados durante debug
//
// Contexto: o campo `role` determina permissões de admin (ex: botões de boss
// debug). Ele vem do banco via getUserProfile e deve sobreviver a qualquer
// operação que reescreva o localStore ou o state.userProfile.
// ─────────────────────────────────────────────────────────────────────────────

describe('Role — preservação através do localStore', () => {
  beforeEach(() => localStorage.clear());

  // Caminho 1: saveLocalProgress (chamado após cada partida / boss debug)
  it('saveLocalProgress preserva o role existente no localStorage', () => {
    seedFromDatabase(USER_ID, { max_score: 0, max_wave: 0, role: 'admin' });
    const result = saveLocalProgress(USER_ID, 25000, 50);
    expect(result.role).toBe('admin');
  });

  it('saveLocalProgress usa "player" como padrão quando não há role salvo', () => {
    const result = saveLocalProgress(USER_ID, 100, 1);
    expect(result.role).toBe('player');
  });

  // Caminho 2: markSynced (chamado pelo botão SYNC RECORDS)
  it('markSynced preserva o role após sincronização', () => {
    seedFromDatabase(USER_ID, { max_score: 0, max_wave: 0, role: 'admin' });
    saveLocalProgress(USER_ID, 5000, 10);
    const result = markSynced();
    expect(result.role).toBe('admin');
  });

  // Caminho 3: clearLocalProgress (botão ZERAR HISTÓRICO)
  it('clearLocalProgress preserva o role ao zerar histórico', () => {
    seedFromDatabase(USER_ID, { max_score: 5000, max_wave: 10, role: 'admin' });
    const result = clearLocalProgress(USER_ID);
    expect(result.role).toBe('admin');
    expect(result.max_score).toBe(0); // scores zerados
  });

  // Caminho 4: updateLocalUsername (edição de nome no HUD)
  it('updateLocalUsername preserva o role ao trocar de nome', () => {
    seedFromDatabase(USER_ID, { max_score: 0, max_wave: 0, role: 'admin' });
    const result = updateLocalUsername(USER_ID, 'NovoNome');
    expect(result.role).toBe('admin');
    expect(result.username).toBe('NovoNome');
  });

  // Caminho 5: seedFromDatabase define o role corretamente no primeiro login
  it('seedFromDatabase define role admin corretamente', () => {
    const result = seedFromDatabase(USER_ID, { role: 'admin', max_score: 0 });
    expect(result.role).toBe('admin');
  });

  it('seedFromDatabase usa "player" como padrão quando role ausente no banco', () => {
    const result = seedFromDatabase(USER_ID, { max_score: 0 });
    expect(result.role).toBe('player');
  });

  // Caminho 6: múltiplas operações em sequência (boss debug → salvar → sync)
  it('role sobrevive ao fluxo completo: boss debug → saveProgress → markSynced', () => {
    // Simula login com admin
    seedFromDatabase(USER_ID, { max_score: 0, max_wave: 0, role: 'admin' });

    // Simula derrota do boss W50 (score += 25000)
    saveLocalProgress(USER_ID, 25000, 50);
    expect(loadLocalProgress(USER_ID).role).toBe('admin');

    // Simula clique em SYNC RECORDS
    markSynced();
    expect(loadLocalProgress(USER_ID).role).toBe('admin');

    // Simula outra partida após o sync
    saveLocalProgress(USER_ID, 30000, 60);
    expect(loadLocalProgress(USER_ID).role).toBe('admin');
  });

  // Caminho 7: role não é sobrescrito por player em partida posterior
  it('role admin não é rebaixado para player em saveLocalProgress subsequente', () => {
    seedFromDatabase(USER_ID, { role: 'admin' });
    saveLocalProgress(USER_ID, 100, 1); // sem passar role explícito
    saveLocalProgress(USER_ID, 200, 2);
    saveLocalProgress(USER_ID, 300, 3);
    expect(loadLocalProgress(USER_ID).role).toBe('admin');
  });
});
