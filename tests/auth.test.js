/**
 * @vitest-environment jsdom
 *
 * auth.test.js — Testa src/api/auth.js com Firebase Auth + Firestore
 *
 * ─── Estratégia de mock ───────────────────────────────────────────────────────
 * Não queremos conectar ao Firebase real nos testes — isso seria lento, exigiria
 * credenciais e dependeria de rede. Em vez disso, substituímos os módulos do
 * Firebase por objetos falsos (mocks) que simulam o comportamento esperado.
 *
 * vi.mock('módulo', factory) → substitui TODAS as exportações do módulo pela
 *   factory antes mesmo de qualquer import ser processado. É como dizer:
 *   "quando o código importar 'firebase/firestore', devolva isso aqui no lugar".
 *
 * vi.hoisted(() => { ... }) → garante que as variáveis de mock sejam criadas
 *   ANTES dos vi.mock() serem executados (o Vite processa os vi.mock no topo).
 *
 * ─── Casos cobertos ───────────────────────────────────────────────────────────
 *   Login    → signInWithGoogle, signInWithGithub (popup + provider correto)
 *   Logout   → signOut (sucesso e erro silencioso)
 *   Perfil   → getUserProfile (existe / não existe)
 *   Criação  → createProfile (username do email / email nulo)
 *   Score    → persistScore (cálculo de max, username no payload, merge:true)
 *   Username → updateUsername (merge:true obrigatório)
 *   Ranking  → getLeaderboard (mapeamento, array vazio, filtro, limite)
 *   Ping     → pingDatabase (sucesso / falha silenciosa)
 *   Offline  → funções com auth/db null retornam sem lançar exceção
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks hoisted ────────────────────────────────────────────────────────────
// vi.hoisted garante que estas variáveis existam antes que os vi.mock() abaixo
// sejam processados pelo Vite. Sem isso, as referências seriam undefined.
const mocks = vi.hoisted(() => {
  // DocumentSnapshot falso — simula o retorno de getDoc()
  const makeSnapshot = (exists, data = {}) => ({
    exists: () => exists,
    id: 'mock-user-id',
    data: () => data,
  });

  // QuerySnapshot falso — simula o retorno de getDocs()
  const makeQuerySnapshot = (docs = []) => ({
    docs: docs.map(d => ({
      id: d.id || 'doc-id',
      data: () => d,
    })),
  });

  return {
    // Firebase Auth
    mockSignInWithPopup:    vi.fn(),
    mockFirebaseSignOut:    vi.fn(),

    // Firestore
    mockGetDoc:    vi.fn(),
    mockSetDoc:    vi.fn(),
    mockGetDocs:   vi.fn(),

    // Helpers para construir snapshots nos testes
    makeSnapshot,
    makeQuerySnapshot,
  };
});

// ─── Mock: src/lib/firebase.js ────────────────────────────────────────────────
// Substitui as instâncias reais por objetos simbólicos.
// O auth e db não são usados diretamente nos testes — são passados como
// argumento para as funções do Firebase (getDoc(db, ...), signInWithPopup(auth, ...))
// então basta que sejam objetos não-nulos para as funções não fazerem early return.
vi.mock('../src/lib/firebase.js', () => ({
  auth: { _isMockAuth: true },
  db:   { _isMockDb:   true },
}));

// ─── Mock: firebase/auth ──────────────────────────────────────────────────────
// Substitui as funções reais de autenticação pelos mocks.
// GoogleAuthProvider e GithubAuthProvider são classes — mockamos como construtores
// simples que retornam um objeto identificável para verificar qual foi usado.
vi.mock('firebase/auth', () => ({
  // Os providers precisam do método setCustomParameters — o código de produção
  // chama provider.setCustomParameters({ prompt: 'select_account' }) antes do popup.
  // O mock precisa incluir este método (vi.fn()) para não lançar "is not a function".
  GoogleAuthProvider: vi.fn(() => ({ _provider: 'google', setCustomParameters: vi.fn() })),
  GithubAuthProvider: vi.fn(() => ({ _provider: 'github', setCustomParameters: vi.fn() })),
  signInWithPopup:    mocks.mockSignInWithPopup,
  signOut:            mocks.mockFirebaseSignOut,
}));

// ─── Mock: firebase/firestore ─────────────────────────────────────────────────
// doc() normalmente recebe (db, 'collection', 'id') e retorna uma referência.
// Mockamos para retornar um objeto simples que identifica qual doc foi pedido.
vi.mock('firebase/firestore', () => ({
  doc:        vi.fn((_db, collection, id) => ({ _collection: collection, _id: id })),
  getDoc:     mocks.mockGetDoc,
  setDoc:     mocks.mockSetDoc,
  getDocs:    mocks.mockGetDocs,
  collection: vi.fn((_db, name) => ({ _collection: name })),
  query:      vi.fn((...args) => ({ _query: args })),
  where:      vi.fn((field, op, val) => ({ _where: { field, op, val } })),
  orderBy:    vi.fn((field, dir) => ({ _orderBy: { field, dir } })),
  limit:      vi.fn((n) => ({ _limit: n })),
}));

// ─── Importações após os mocks ────────────────────────────────────────────────
// IMPORTANTE: os imports devem vir DEPOIS dos vi.mock() para receber as versões mockadas.
import {
  signInWithGoogle,
  signInWithGithub,
  signOut,
  getUserProfile,
  createProfile,
  persistScore,
  updateUsername,
  getLeaderboard,
  pingDatabase,
} from '../src/api/auth.js';

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Padrão seguro: mocks resolvem com sucesso a menos que o teste sobrescreva
  mocks.mockSignInWithPopup.mockResolvedValue({ user: { uid: 'mock-uid' } });
  mocks.mockFirebaseSignOut.mockResolvedValue();
  mocks.mockSetDoc.mockResolvedValue();
});

// ── Login ─────────────────────────────────────────────────────────────────────

describe('signInWithGoogle', () => {
  it('deve chamar signInWithPopup com GoogleAuthProvider', async () => {
    await signInWithGoogle();
    expect(mocks.mockSignInWithPopup).toHaveBeenCalledOnce();
    // Verifica que o provider passado é uma instância de GoogleAuthProvider
    // (identificado pelo campo _provider que nosso mock insere)
    const [, provider] = mocks.mockSignInWithPopup.mock.calls[0];
    expect(provider._provider).toBe('google');
  });

  it('deve propagar erro se signInWithPopup falhar', async () => {
    mocks.mockSignInWithPopup.mockRejectedValueOnce(new Error('popup bloqueado'));
    await expect(signInWithGoogle()).rejects.toThrow('popup bloqueado');
  });
});

describe('signInWithGithub', () => {
  it('deve chamar signInWithPopup com GithubAuthProvider', async () => {
    await signInWithGithub();
    const [, provider] = mocks.mockSignInWithPopup.mock.calls[0];
    expect(provider._provider).toBe('github');
  });

  it('deve propagar erro se signInWithPopup falhar', async () => {
    mocks.mockSignInWithPopup.mockRejectedValueOnce(new Error('oauth error'));
    await expect(signInWithGithub()).rejects.toThrow('oauth error');
  });
});

// ── Logout ────────────────────────────────────────────────────────────────────

describe('signOut', () => {
  it('deve chamar firebaseSignOut', async () => {
    await signOut();
    expect(mocks.mockFirebaseSignOut).toHaveBeenCalledOnce();
  });

  it('não deve lançar exceção se signOut falhar — erro é silencioso', async () => {
    // signOut com erro deve apenas logar um warn, nunca quebrar o fluxo do jogo
    mocks.mockFirebaseSignOut.mockRejectedValueOnce(new Error('sessão expirada'));
    await expect(signOut()).resolves.toBeUndefined();
  });
});

// ── getUserProfile ────────────────────────────────────────────────────────────

describe('getUserProfile', () => {
  it('deve retornar os dados do perfil quando o documento existe', async () => {
    const profileData = { username: 'Oracle D', role: 'player', max_score: 190 };
    mocks.mockGetDoc.mockResolvedValueOnce(
      mocks.makeSnapshot(true, profileData)
    );

    const result = await getUserProfile('user-123');
    expect(result).toMatchObject(profileData);
    // O id deve ser incluído (não vem em data() no Firestore real)
    expect(result.id).toBe('mock-user-id');
  });

  it('deve retornar null quando o documento não existe (primeiro login)', async () => {
    // Caso crítico: Firebase retorna snapshot.exists() === false, não um erro.
    // Se o código fizer snapshot.data() sem verificar exists(), vai crashar.
    mocks.mockGetDoc.mockResolvedValueOnce(
      mocks.makeSnapshot(false)
    );

    const result = await getUserProfile('user-novo');
    expect(result).toBeNull();
  });

  it('deve propagar erro de rede', async () => {
    mocks.mockGetDoc.mockRejectedValueOnce(new Error('Network error'));
    await expect(getUserProfile('user-123')).rejects.toThrow('Network error');
  });
});

// ── createProfile ─────────────────────────────────────────────────────────────

describe('createProfile', () => {
  it('deve extrair o prefixo do email como username padrão', async () => {
    await createProfile('user-123', 'wybrendon@gmail.com');

    // Verifica o payload passado para setDoc
    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.username).toBe('wybrendon');
  });

  it('deve funcionar com email de domínio corporativo', async () => {
    await createProfile('user-456', 'joao.silva@empresa.com.br');
    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.username).toBe('joao.silva');
  });

  it('deve usar username null quando email não é fornecido', async () => {
    // Usuário pode logar via GitHub sem email público configurado
    await createProfile('user-789', null);
    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.username).toBeNull();
  });

  it('deve criar perfil com role "player" por padrão', async () => {
    await createProfile('user-123', 'test@test.com');
    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.role).toBe('player');
  });

  it('deve criar perfil com scores zerados', async () => {
    await createProfile('user-123', 'test@test.com');
    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.max_score).toBe(0);
    expect(payload.max_wave).toBe(0);
    expect(payload.last_score).toBe(0);
    expect(payload.last_wave).toBe(0);
  });

  it('NÃO deve usar merge:true — documento novo é sobrescrito limpo', async () => {
    // merge:true num documento novo não causa bug, mas sem merge é mais correto
    // e explícito. Se alguém adicionar merge:true por engano num refactor, este
    // teste detecta a mudança de intenção.
    await createProfile('user-123', 'test@test.com');
    // O terceiro argumento de setDoc seria as opções { merge: true }
    const options = mocks.mockSetDoc.mock.calls[0][2];
    expect(options).toBeUndefined();
  });

  it('deve retornar o perfil criado com o id do usuário', async () => {
    const result = await createProfile('user-123', 'jogador@gmail.com');
    expect(result.id).toBe('user-123');
    expect(result.username).toBe('jogador');
    expect(result.role).toBe('player');
  });
});

// ── persistScore ──────────────────────────────────────────────────────────────

describe('persistScore', () => {
  it('deve calcular max_score e max_wave corretamente', async () => {
    const currentProfile = { max_score: 500, max_wave: 5 };
    await persistScore('user-123', 200, 8, currentProfile);

    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.max_score).toBe(500); // 500 > 200 → mantém o maior
    expect(payload.max_wave).toBe(8);    // 8 > 5 → atualiza
    expect(payload.last_score).toBe(200);
    expect(payload.last_wave).toBe(8);
  });

  it('deve incluir username no payload quando disponível', async () => {
    // Bug crítico do Supabase antigo: username não ia para o banco.
    // Garantimos que o Firestore sempre recebe o username atualizado.
    const currentProfile = { max_score: 0, max_wave: 0, username: 'AstroHero' };
    await persistScore('user-123', 100, 1, currentProfile);

    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.username).toBe('AstroHero');
  });

  it('não deve incluir username quando currentProfile não tem username', async () => {
    await persistScore('user-123', 100, 1, { max_score: 0, max_wave: 0 });

    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload).not.toHaveProperty('username');
  });

  it('deve usar merge:true para não apagar campos existentes (como role)', async () => {
    // Bug potencial grave: setDoc SEM merge:true apagaria o campo role do documento.
    // O jogador admin perderia o acesso ao bossDebug silenciosamente.
    await persistScore('user-123', 100, 1, {});

    const options = mocks.mockSetDoc.mock.calls[0][2];
    expect(options).toEqual({ merge: true });
  });

  it('deve funcionar sem currentProfile (padrão {})', async () => {
    // persistScore é chamado em contextos onde o perfil pode não estar carregado
    await persistScore('user-123', 300, 3);

    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.max_score).toBe(300);
    expect(payload.max_wave).toBe(3);
  });

  it('deve retornar o payload com o id do usuário', async () => {
    const result = await persistScore('user-123', 100, 1, {});
    expect(result.id).toBe('user-123');
    expect(result.last_score).toBe(100);
  });
});

// ── updateUsername ────────────────────────────────────────────────────────────

describe('updateUsername', () => {
  it('deve chamar setDoc com o novo username', async () => {
    await updateUsername('user-123', 'NovaEstrela');

    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.username).toBe('NovaEstrela');
  });

  it('deve usar merge:true para não apagar max_score, role e outros campos', async () => {
    // Sem merge:true, setDoc sobrescreveria o documento inteiro.
    // O jogador perderia todos os seus scores e o role ao trocar o username.
    await updateUsername('user-123', 'NovaEstrela');

    const options = mocks.mockSetDoc.mock.calls[0][2];
    expect(options).toEqual({ merge: true });
  });

  it('deve incluir updated_at no payload', async () => {
    await updateUsername('user-123', 'NovaEstrela');

    const payload = mocks.mockSetDoc.mock.calls[0][1];
    expect(payload.updated_at).toBeDefined();
  });
});

// ── getLeaderboard ────────────────────────────────────────────────────────────

describe('getLeaderboard', () => {
  it('deve retornar lista mapeada de jogadores', async () => {
    mocks.mockGetDocs.mockResolvedValueOnce(
      mocks.makeQuerySnapshot([
        { username: 'Fulano',  max_score: 5000, max_wave: 10 },
        { username: 'Cicrano', max_score: 3000, max_wave: 7  },
      ])
    );

    const result = await getLeaderboard();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ username: 'Fulano', max_score: 5000, max_wave: 10 });
  });

  it('deve retornar array vazio quando não há jogadores', async () => {
    mocks.mockGetDocs.mockResolvedValueOnce(mocks.makeQuerySnapshot([]));

    const result = await getLeaderboard();
    expect(result).toEqual([]);
  });

  it('deve tratar username ausente como null', async () => {
    // Jogadores que nunca definiram username aparecem no leaderboard com null,
    // e o renderizador exibe 'ANÔNIMO' — não pode quebrar aqui.
    mocks.mockGetDocs.mockResolvedValueOnce(
      mocks.makeQuerySnapshot([{ max_score: 100, max_wave: 1 }])
    );

    const result = await getLeaderboard();
    expect(result[0].username).toBeNull();
  });

  it('deve propagar erro de rede', async () => {
    mocks.mockGetDocs.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(getLeaderboard()).rejects.toThrow('Permission denied');
  });
});

// ── pingDatabase ──────────────────────────────────────────────────────────────

describe('pingDatabase', () => {
  it('deve retornar true quando Firestore responde', async () => {
    mocks.mockGetDoc.mockResolvedValueOnce(mocks.makeSnapshot(false)); // doc pode não existir
    const result = await pingDatabase();
    expect(result).toBe(true);
  });

  it('deve retornar false quando Firestore falha — nunca lança', async () => {
    // pingDatabase é fire-and-forget: uma falha não pode quebrar o fluxo do jogo
    mocks.mockGetDoc.mockRejectedValueOnce(new Error('offline'));
    const result = await pingDatabase();
    expect(result).toBe(false);
  });
});

// ── Modo offline / sem configuração ──────────────────────────────────────────

describe('Funções com Firebase não configurado (auth/db = null)', () => {
  // Para testar o caminho "if (!auth) return" e "if (!db) return",
  // precisamos reimportar o módulo com firebase.js retornando null.
  // Fazemos isso com vi.doMock e importação dinâmica dentro do teste.

  it('getUserProfile retorna null sem lançar quando db é null', async () => {
    vi.doMock('../src/lib/firebase.js', () => ({ auth: null, db: null }));
    const { getUserProfile: fn } = await import('../src/api/auth.js?offline-get');
    const result = await fn('user-123');
    expect(result).toBeNull();
  });

  it('persistScore retorna null sem lançar quando db é null', async () => {
    vi.doMock('../src/lib/firebase.js', () => ({ auth: null, db: null }));
    const { persistScore: fn } = await import('../src/api/auth.js?offline-persist');
    const result = await fn('user-123', 100, 1, {});
    expect(result).toBeNull();
  });

  it('getLeaderboard retorna array vazio sem lançar quando db é null', async () => {
    vi.doMock('../src/lib/firebase.js', () => ({ auth: null, db: null }));
    const { getLeaderboard: fn } = await import('../src/api/auth.js?offline-lb');
    const result = await fn();
    expect(result).toEqual([]);
  });
});
