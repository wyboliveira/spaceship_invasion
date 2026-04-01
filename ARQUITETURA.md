# Arquitetura — Spaceship Invasion

## Estrutura de Arquivos

```
spaceship_invasion/
├── index.html
├── package.json
├── vite.config.js
│
├── public/
│   ├── favicon.svg                   ← Ícone neon da nave
│   ├── music/                        ← Trilhas de fundo (.ogg / .mp3)
│   └── sfx/                          ← Efeitos sonoros (.ogg / .wav)
│
└── src/
    │
    ├── main.js                       ← Orquestrador central
    ├── style.css
    │
    ├── audio/                        ← Sistema de áudio (Howler.js)
    │   ├── audioConfig.js            ← Fonte única de verdade para todos os áudios
    │   └── AudioManager.js           ← Singleton: reprodução, crossfade, duck, playlist
    │
    ├── core/                         ← Peças centrais de infraestrutura
    │   ├── EventBus.js               ← Pub/sub: desacopla todos os módulos
    │   ├── GameFSM.js                ← Máquina de estados: governa toda navegação
    │   └── SyncQueue.js              ← Fila serial de I/O com retry (reserva)
    │
    ├── game/
    │   ├── config.js
    │   ├── helpers.js
    │   ├── input.js                  ← Ignora atalhos quando foco está em <input>
    │   ├── sprites.js
    │   ├── state.js
    │   ├── update.js                 ← Emite eventos SFX_* e GAME_BOSS_* via EventBus
    │   └── weapons.js
    │
    ├── api/
    │   └── auth.js                   ← I/O puro: Firebase Auth + Firestore (signIn, getUserProfile, persistScore...)
    │
    ├── lib/
    │   ├── firebase.js               ← Inicializa Firebase e exporta auth + db
    │   └── localStore.js             ← Cache local de progresso (local-first)
    │
    └── ui/
        ├── hud.js                    ← Editor inline de username (lápis no HUD)
        └── overlay.js
```

---

## Camadas da Arquitetura

| Camada | Arquivo(s) | Responsabilidade |
|---|---|---|
| 1 — FSM | `core/GameFSM.js` | Única fonte de verdade sobre "onde o jogo está agora" |
| 2 — Event Bus | `core/EventBus.js` | Pub/sub. Nenhum módulo chama outro diretamente |
| 3 — Cache Local | `lib/localStore.js` | Progresso do jogador no localStorage (sem rede) |
| 3 — I/O Remoto | `api/auth.js` | Todas as chamadas ao Firebase Auth e Firestore |
| 3 — Áudio | `audio/AudioManager.js` | Música, SFX, crossfade; reage ao EventBus |
| 4 — Orquestração | `main.js` | Liga tudo; game loop; listeners de auth e FSM |

---

## Transições da FSM

```
MENU      → [PLAYING]
PLAYING   → [PAUSED, GAME_OVER, WAVE_END, MENU]
PAUSED    → [PLAYING, MENU]
SYNCING   → [WAVE_END, GAME_OVER, MENU]   ← mantido, não usado no fluxo do jogo
WAVE_END  → [PLAYING, MENU]
GAME_OVER → [PLAYING, MENU]
```

> **SYNCING** foi removido do fluxo de jogo. O estado existe para uso futuro mas não
> é mais atingível a partir de PLAYING ou PAUSED. Wave end e game over transitam diretamente
> para seus estados finais — o progresso é salvo localmente sem espera de rede.

---

## Estratégia de Persistência: Local-First

### Como funciona

O jogo adota a estratégia **local-first**: o localStorage é sempre atualizado imediatamente,
sem dependência de rede. O Firestore é atualizado somente quando o usuário decide sincronizar.

```
Fim de wave / game over
  └─ _saveLocalScore()
       └─ localStore.saveLocalProgress()   → localStorage (imediato, sem rede)
            → pendingSync = true

Botão SYNC RECORDS no menu
  └─ persistScore()                        → Firestore setDoc (merge: true)
       └─ markSynced()                     → lastSyncedAt = agora, pendingSync = false
```

### O que fica onde

| Dado | Onde fica | Quando atualiza |
|---|---|---|
| Scores e waves | localStorage | A cada fim de partida |
| Username | localStorage + Firestore | Ao salvar no editor inline |
| Histórico de sync | localStorage (`lastSyncedAt`) | Ao clicar SYNC RECORDS |
| Auth token | Gerenciado pelo Firebase SDK | Login/logout |

### Comportamento do botão SYNC RECORDS

- Fica **amarelo** quando há dados pendentes (`pendingSync = true`)
- Fica **verde** quando tudo está sincronizado
- Mostra "LAST SYNC: dd/mm/yyyy hh:mm" abaixo do botão
- Mostra "NUNCA SINCRONIZADO" em vermelho se nunca foi sincronizado

### Primeiro login (novo dispositivo)

Se não há dados locais para o userId, o jogo verifica se já existe um documento no Firestore
(`getUserProfile`). Se sim, inicializa o localStorage com os dados do banco (`seedFromDatabase`).
Se não (primeiro login), cria o documento no Firestore com `createProfile` — usando o prefixo
do email como username padrão — e depois popula o localStorage. Nas sessões seguintes,
os dados locais são usados diretamente sem chamada de rede.

---

## Auth: Firebase Authentication

O login usa **popup** (não redirect) com Google e GitHub OAuth.

```
Usuário clica Login Google/GitHub
  └─ signInWithPopup(auth, provider)
       └─ popup abre → usuário escolhe conta → popup fecha
            └─ onAuthStateChanged(auth, user) dispara em main.js
                 └─ user !== null → busca/cria perfil no Firestore
                 └─ user === null → limpa estado (logout)
```

**Diferenças em relação ao Supabase:**
- Popup em vez de redirect (sem necessidade de limpar hash/query da URL)
- `onAuthStateChanged` recebe `user` (não `{ event, session }`)
- Refresh de token é silencioso — não dispara o callback
- Perfil criado em código (`createProfile`) — não há trigger SQL
- `user.uid` é o identificador (não `session.user.id`) — normalizado em `state.session`

---

## Banco de Dados: Cloud Firestore

Coleção: `profiles`

| Campo | Tipo | Descrição |
|---|---|---|
| `role` | string | `'player'` ou `'admin'` — define permissões |
| `username` | string \| null | Nome exibido no jogo (editável pelo jogador) |
| `max_score` | number | Maior pontuação histórica |
| `max_wave` | number | Maior wave alcançada |
| `last_score` | number | Pontuação da última partida |
| `last_wave` | number | Wave da última partida |
| `created_at` | string ISO | Data do primeiro login |
| `updated_at` | string ISO | Última sincronização com o banco |

**Security Rules** (equivalente ao RLS do Supabase):
```
match /profiles/{userId} {
  allow read: if true;                          // leaderboard público
  allow write: if request.auth.uid == userId;   // só o próprio usuário
}
```

**Operações principais:**
- `getDoc` → ler perfil de um usuário
- `setDoc(..., { merge: true })` → criar/atualizar sem apagar campos existentes (upsert)
- `getDocs(query(..., where, orderBy, limit))` → leaderboard

---

## Editor de Username (HUD)

Um ícone de lápis `✎` (amarelo, `var(--accent3)`) aparece ao passar o mouse sobre o nome
do jogador no HUD. Só é visível quando há sessão ativa.

**Fluxo de edição:**
1. Clique no lápis → input inline aparece com a fonte Orbitron
2. `Enter` → salva no localStorage + Firestore (background), foco vai para `#startBtn`
3. `Escape` ou clicar fora → cancela sem salvar

**Proteção de input:** `input.js` ignora todos os atalhos do jogo (R, P, Enter, Espaço)
quando o foco está em um `<input>` ou `<textarea>`.

---

## Logout

`signOut()` do Firebase invalida a sessão localmente e no servidor. Se falhar, apenas
logamos o aviso — o Firebase cuida da sua própria persistência no localStorage, sem
necessidade de limpar chaves manualmente.

---

## Sistema de Áudio

### Princípio de design

Todo áudio é configurado em **`audioConfig.js`** — o único arquivo que precisa ser
editado para trocar um som ou ajustar volume. O `AudioManager.js` lê essa config e
nunca precisa ser modificado.

### Fluxo de música

```
FSM_MENU           → playMusic('menu')     — loop simples
FSM_PLAYING        → playMusic('gameplay') — playlist sequencial (3 faixas)
GAME_BOSS_SPAWN    → playMusic('boss')     — loop simples, interrompe gameplay
FSM_WAVE_END       → stopMusic()           (somente se boss estava tocando)
FSM_PAUSED         → duck 15%             — música continua, volume reduzido
FSM_GAME_OVER      → duck 15%             — música continua; SFX_GAME_OVER com delay
FSM_PLAYING(PAUSED)→ unduck               — restaura volume ao retomar
FSM_PLAYING(BOSS)  → playMusicRandom()    — faixa aleatória da playlist de gameplay
```

### Playlist de gameplay

- Três faixas (`gameplay_1/2/3.ogg`) tocam em sequência, sem parar entre waves.
- `onend` de cada Howl avança o índice com wrap-around.
- Após fase de boss, `_comingFromBoss = true` → próxima faixa é escolhida aleatoriamente.

### SFX via EventBus

Todos os eventos `SFX_*` e os eventos de jogo reaproveitados (`GAME_BOSS_SPAWN`,
`GAME_BOSS_DEFEATED`, `GAME_WAVE_CLEAR`) são escutados automaticamente pelo
`AudioManager` com base no array `audioConfig.sfx`.

### Botão ♫ (mute de música)

O botão no HUD muta/desmuta somente as músicas (SFX não são afetados).
Chama `AudioManager.setMusicMuted()` que faz fade instantâneo do Howl ativo.

---

## Sprites e Bosses

Todos os sprites são desenhados programaticamente via Canvas API — sem imagens externas.

Cada boss tem sprite único, decidido pelo `_BOSS_DRAW` dispatcher em `sprites.js`:

| Wave | Boss | Cor |
|---|---|---|
| 10 | Alien laranja | `#ff6600` |
| 20 | Alien com chifre | `#ff4400` |
| 30 | Alien com garras | `#cc2200` |
| 40 | Caranguejo azul | `#0088ff` |
| 50 | Caranguejo amarelo + escudo | `#ffcc00` |
| 60 | Caranguejo verde + escudo | `#00cc44` |
| 70 | Caranguejo verde com espinhos | `#00aa33` |
| 80 | Polvo laranja | `#ff8800` |
| 90 | Lula cinza | `#888899` |
| 100 | Morcego neon | `#cc00ff` |

O escudo das waves 50 e 60 é composto por **3 painéis flutuantes** animados com seno.

---

## O que mudou em relação à versão anterior (v1.0.0 Supabase → v2.0.0 Firebase)

### Removido

| O que | Por quê |
|---|---|
| `src/lib/supabase.js` | Substituído por `src/lib/firebase.js` |
| `supabase/setup.sql` | Firestore é schema-less; Security Rules substituem RLS |
| `supabase/migration_add_role.sql` | Não há SQL no Firestore |
| `tests/connection.test.js` | Era diagnóstico de cold start do Supabase — não se aplica ao Firebase |
| `tests/supa_diag_node.js` | Script de diagnóstico Supabase obsoleto |
| Dependência `@supabase/supabase-js` | Removida do package.json |
| `prompt: 'select_account'` via `queryParams` | Agora via `provider.setCustomParameters()` |
| Limpeza manual de chaves `sb-*` no logout | Firebase gerencia sua própria persistência |
| `supabase?.auth.onAuthStateChange` | Substituído por `onAuthStateChanged(auth, user)` |
| Limpeza de hash/query da URL após login | Popup não altera a URL |

### Adicionado / Modificado

| O que | Onde | Descrição |
|---|---|---|
| `src/lib/firebase.js` | lib/ | Inicializa Firebase e exporta `auth` e `db` |
| `createProfile(userId, email)` | `api/auth.js` | Cria documento no Firestore no primeiro login; usa prefixo do email como username padrão |
| Migração para `signInWithPopup` | `api/auth.js` | Popup em vez de redirect OAuth |
| `getDoc / setDoc / getDocs` | `api/auth.js` | Substituem chamadas Supabase `.from().select()`, `.upsert()`, `.eq()` |
| `merge: true` em todos os `setDoc` | `api/auth.js` | Equivalente ao `onConflict: 'id'` do Supabase — previne apagar campos como `role` |
| `onAuthStateChanged` em `main.js` | main.js | Observer Firebase; `user.uid` normalizado para `state.session.user.id` |
| Testes em `auth.test.js` | tests/ | 34 testes cobrindo Firebase Auth + Firestore com mocks |
| Testes em `flows.test.js` | tests/ | Fluxos E2E migrados para Firebase |
| Versão `2.0.0` | package.json / README | Bump de versão pela migração de BaaS |

### Comportamento preservado (sem quebra)

- `state.session.user.id` e `state.session.user.email` — mesmo shape para o restante do app
- `localStore.js` — inalterado; persiste local-first independente do backend
- SYNC RECORDS, Leaderboard, editor de username — mesma UX, API diferente por baixo
- `role` preservation em todos os fluxos — testado em `history.test.js`
