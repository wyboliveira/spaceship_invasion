# Spaceship Invasion — Dev Edition
### Documentação Técnica — Arquitetura Cloud & Persistência

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Bundler | [Vite](https://vitejs.dev/) — módulos ES6, dev server na porta 5173 |
| Backend-as-a-Service | [Firebase](https://firebase.google.com/) — Auth OAuth + Firestore (NoSQL) |
| Frontend | Vanilla JavaScript (Canvas API) + CSS com variáveis |
| Áudio | [Howler.js](https://howlerjs.com/) v2.2.4 — Web Audio API com fallback HTML5 |
| Testes | [Vitest](https://vitest.dev/) — unitários e integração, ambiente jsdom |

---

## Autenticação

Login social via **Google** e **GitHub** usando OAuth **popup** (não redirect).

- `signInWithPopup(auth, provider)` — abre popup, resolve na mesma página sem alterar a URL
- `provider.setCustomParameters({ prompt: 'select_account' })` — força tela de seleção de conta
- `signOut()` do Firebase invalida sessão localmente e no servidor
- `onAuthStateChanged(auth, callback)` — observer em `main.js`; dispara apenas em login/logout real (refresh de token é silencioso)
- Primeiro login: `createProfile(userId, email)` cria o documento no Firestore automaticamente

---

## Persistência de Dados — Estratégia Local-First

O jogo utiliza a estratégia **local-first**: o progresso é salvo no `localStorage` do
navegador de forma imediata, sem depender de rede. O Firestore é atualizado somente
quando o usuário clica no botão **SYNC RECORDS**.

### Por que local-first?

O Firestore não tem cold start (responde em ~50ms). Mesmo assim, mantemos o local-first
porque garante que quedas de conexão ou qualquer erro de rede **não apagam o progresso**
do jogador, e a UX é instantânea independente da qualidade da conexão.

### Fluxo de dados

```
Partida encerrada (wave end / game over)
  └─ localStorage atualizado imediatamente
       max_score, max_wave, last_score, last_wave
       pendingSync = true

Botão SYNC RECORDS (menu, usuário logado)
  └─ Spinner de loading exibido
  └─ Dados do localStorage enviados ao Firestore via setDoc (merge: true)
  └─ lastSyncedAt atualizado, pendingSync = false
  └─ "LAST SYNC: dd/mm/yyyy hh:mm" exibido no menu

Primeiro login ou novo dispositivo
  └─ getUserProfile() → verifica se documento existe no Firestore
  └─ Não existe → createProfile() cria com username = prefixo do email, role = 'player'
  └─ Existe → seedFromDatabase() inicializa localStorage com dados do banco
```

### Indicadores visuais no menu

| Estado | Cor do botão SYNC | Mensagem |
|---|---|---|
| Dados pendentes | Amarelo `#FFD700` | "LAST SYNC: [data]" em amarelo |
| Tudo sincronizado | Verde `#00ff88` | "LAST SYNC: [data]" em cinza |
| Nunca sincronizado | Verde `#00ff88` | "NUNCA SINCRONIZADO" em vermelho |

---

## Banco de Dados — Cloud Firestore

Coleção: `profiles` (equivale a uma tabela SQL)
Documento por usuário (equivale a uma linha; ID = Firebase UID)

| Campo | Tipo | Descrição |
|---|---|---|
| `role` | string | `'player'` ou `'admin'` |
| `username` | string \| null | Nome exibido no jogo |
| `max_score` | number | Maior pontuação histórica |
| `max_wave` | number | Maior wave alcançada |
| `last_score` | number | Pontuação da última partida |
| `last_wave` | number | Wave da última partida |
| `created_at` | string ISO | Data do primeiro login |
| `updated_at` | string ISO | Última atualização |

**Por que `merge: true` em todos os `setDoc`?**
Sem `merge: true`, o `setDoc` **sobrescreve o documento inteiro**. Se `persistScore` não
incluir o campo `role`, o usuário admin perde o acesso ao painel de boss debug
silenciosamente. Com `merge: true`, apenas os campos enviados são atualizados.

**Security Rules** (Firebase Console → Firestore → Rules):
```
match /profiles/{userId} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.uid == userId;
}
```

---

## Editor de Username

O jogador pode editar o nome exibido no HUD passando o mouse sobre ele.
Um ícone de lápis `✎` amarelo aparece no hover. Ao clicar:

1. Um campo de texto inline substitui o nome (mesma fonte Orbitron do HUD)
2. **Enter** salva o nome — atualizado no localStorage imediatamente e no Firestore em background
3. **Escape** ou clicar fora cancela a edição
4. Após salvar, o foco vai para o botão START para o jogador iniciar o jogo com Enter

O username é preservado ao zerar o histórico e ao salvar novos scores.

---

## Testes

A suite usa Vitest com ambiente jsdom. Os testes ficam em `tests/` e são separados por módulo.

```
tests/
├── audio.test.js      ← audioConfig (schema), AudioManager (init, SFX, playlist, FSM)
├── auth.test.js       ← Firebase Auth + Firestore: signIn, signOut, getUserProfile,
│                         createProfile, persistScore, updateUsername, getLeaderboard, ping
├── history.test.js    ← lib/localStore.js: save, load, seed, clear, markSynced, role preservation
├── flows.test.js      ← Fluxos E2E: login popup, partida local, SYNC RECORDS, zerar histórico, leaderboard
├── sync.test.js       ← SyncQueue: enqueue, retry com backoff, SYNC_DONE/SYNC_FAILED
├── core.test.js       ← EventBus e GameFSM: transições válidas e inválidas
├── gameplay.test.js   ← Sistema de armas, configuração de waves, sistema de drops
├── boss.test.js       ← HP por wave, escudo (W50/W60), posicionamento
└── helpers.test.js    ← Criação de inimigos e escudos
```

Howler.js e Firebase são mockados integralmente nos testes — nenhuma chamada de rede real.
Os mocks de Firebase usam `vi.hoisted()` + `vi.mock('firebase/auth')` + `vi.mock('firebase/firestore')`.

Para rodar: `npm test`

---

## Sistema de Áudio

O áudio usa **Howler.js** com Web Audio API (fallback para HTML5 Audio).
Toda a configuração fica em `src/audio/audioConfig.js` — para trocar um som,
basta alterar o campo `src` nesse arquivo. Nenhum outro arquivo precisa ser tocado.

### Músicas

| Trilha | Comportamento |
|---|---|
| `menu` | Loop simples na tela inicial |
| `gameplay` | Playlist sequencial de 3 faixas; persiste entre waves normais |
| `boss` | Loop durante fase de boss; interrompe gameplay com crossfade |

Após derrota de boss, `_comingFromBoss = true` — a próxima faixa de gameplay é escolhida
aleatoriamente (`playMusicRandom`) em vez de continuar sequencialmente.

### Efeitos sonoros (SFX)

Todos os SFX são disparados via EventBus. O `AudioManager` escuta automaticamente
qualquer evento cujo nome aparece no array `audioConfig.sfx`.

| Evento | Momento |
|---|---|
| `SFX_PLAYER_SHOOT` | Ao atirar |
| `SFX_ENEMY_DIE` | Ao matar um inimigo |
| `SFX_PLAYER_HIT` | Ao levar dano |
| `SFX_DROP_COLLECT` | Ao coletar drop |
| `GAME_BOSS_SPAWN` | Ao entrar na fase de boss |
| `GAME_BOSS_DEFEATED` | Ao derrotar o boss |
| `GAME_WAVE_CLEAR` | Ao limpar a wave |
| `SFX_GAME_OVER` | Com 400ms de delay após game over |
| `SFX_NORMAL_BUTTON` | Clique em qualquer botão (exceto `data-sfx="none"`) |
| `SFX_CANCEL_BUTTON` | Clique em botões com `data-sfx="cancel"` |

### Comportamento especial

- **Pause / Game Over**: música reduzida a 15% (duck), sem parar
- **Retornar do pause**: música restaurada com fade (unduck)
- **Botão ♫ no HUD**: muta/desmuta somente as músicas; SFX não são afetados

---

## Aprendizados de Desenvolvimento

**Migração Supabase → Firebase**
O Supabase no plano gratuito pausa instâncias após inatividade (cold start ~10s). O Firebase
Firestore não tem esse problema — responde em ~50ms sempre. A migração também eliminou
a necessidade de trigger SQL para criar perfis (feito em código com `createProfile`).

**setDoc sem merge: true apaga campos silenciosamente**
Um `setDoc(ref, payload)` sem `{ merge: true }` sobrescreve o documento inteiro. Campos
como `role` que não fazem parte do payload de score seriam apagados. Todo `setDoc` do
projeto usa `merge: true` por essa razão.

**onAuthStateChanged vs onAuthStateChange**
O Firebase não expõe eventos nomeados (`SIGNED_IN`, `TOKEN_REFRESHED`). O callback recebe
apenas `user` — `null` para deslogado, objeto `User` para logado. Refreshes de token são
completamente silenciosos.

**Mocks de Firebase no Vitest**
Mesma técnica dos mocks de Supabase: `vi.hoisted()` para criar as funções mock antes dos
`vi.mock()`. Os providers (`GoogleAuthProvider`, `GithubAuthProvider`) precisam incluir
`setCustomParameters: vi.fn()` no mock — sem isso, o código de produção lança `is not a function`.

**Separação de responsabilidades no auth**
O `auth.js` não deve conhecer o estado do jogo. Toda lógica de "o que fazer com os dados
após receber do banco" fica no `main.js` ou no `localStore.js`.

**Atalhos de teclado conflitando com inputs**
O handler global de `keydown` em `input.js` precisa verificar `e.target.tagName` antes de
disparar atalhos do jogo — caso contrário, digitar "R" em um campo de texto reinicia o jogo.

**Double-emit de evento no mesmo frame**
Quando o boss morre dentro do loop `.filter()` de balas, `GAME_WAVE_CLEAR` é emitido
síncronamente e seta `state.over = true`. O `update()` continua no mesmo frame e pode
re-entrar no bloco de vitória. Solução: guard `if (state.over) return` antes do bloco.

---

## Roadmap

### Concluído
- [x] Integração Firebase Auth (Google/GitHub via popup)
- [x] Firestore como banco de dados (sem cold start)
- [x] Perfil criado automaticamente no primeiro login (`createProfile`)
- [x] Username padrão = prefixo do email
- [x] Persistência local-first com SYNC RECORDS manual
- [x] Editor de username inline no HUD
- [x] FSM de 6 estados para navegação do jogo
- [x] Suite de testes com 150 casos cobrindo todos os módulos principais
- [x] Sistema de áudio completo (Howler.js): músicas, SFX, playlist, crossfade, duck
- [x] 10 sprites únicos de boss com dispatcher `_BOSS_DRAW`
- [x] Escudo animado (3 painéis flutuantes com seno) para bosses W50/W60
- [x] Retry a partir da wave de morte (`_deathWave`)
- [x] Música pós-boss aleatória (`playMusicRandom`)
- [x] Leaderboard global com paginação
- [x] Favicon neon da nave
- [x] Firebase Hosting configurado para deploy

### Planejado
- [ ] Responsive/mobile resizer
- [ ] Deploy via `firebase deploy`
