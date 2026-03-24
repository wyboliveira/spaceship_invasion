# Estrutura de Arquivos — Spaceship Invasion (Arquitetura FSM)

```
spaceship_invasion/
├── index.html                        ← sem alterações
├── package.json                      ← sem alterações
│
└── src/
    │
    ├── main.js                       ← REESCRITO — orquestrador FSM
    ├── style.css                     ← sem alterações
    │
    ├── core/                         ← NOVA PASTA — as 3 peças centrais
    │   ├── EventBus.js               ← NOVO — pub/sub desacoplado
    │   ├── GameFSM.js                ← NOVO — máquina de estados
    │   └── SyncQueue.js              ← NOVO — fila de persistência com retry
    │
    ├── game/                         ← sem alterações de pasta
    │   ├── config.js                 ← sem alterações
    │   ├── helpers.js                ← sem alterações
    │   ├── input.js                  ← sem alterações
    │   ├── sprites.js                ← sem alterações
    │   ├── state.js                  ← REESCRITO (limpeza, sem alteração de interface)
    │   ├── update.js                 ← sem alterações
    │   └── weapons.js                ← sem alterações
    │
    ├── api/
    │   └── auth.js                   ← REESCRITO — I/O puro, sem navegação
    │
    ├── lib/
    │   └── supabase.js               ← sem alterações
    │
    └── ui/
        ├── hud.js                    ← sem alterações
        └── overlay.js                ← sem alterações
```

---

## O que mudou e por quê

### Arquivos NOVOS (pasta `core/`)

| Arquivo | Camada | Responsabilidade |
|---|---|---|
| `EventBus.js` | 2 | Pub/sub. Desacopla todos os módulos. Nenhum chama o outro diretamente. |
| `GameFSM.js` | 1 | Máquina de estados. Governa toda navegação. Transições inválidas são ignoradas. |
| `SyncQueue.js` | 3 | Fila serial de I/O. Retry automático. Emite `SYNC_DONE` / `SYNC_FAILED`. |

### `main.js` — reescrito

- **Removido:** `_resetLock`, `_lastSyncedScore`, `_syncSessionId`, `_isAuthInitializing`, `_pendingAuthEvent`
- **Removido:** `reset()` como função central — substituído por `Game.backToMenu()` + FSM
- **Removido:** `syncScore()` inline — substituído por `enqueueSyncScore()` que delega à SyncQueue
- **Removido:** `await syncScore(...)` bloqueando a UI — o SYNCING state mostra spinner enquanto a fila processa
- **Adicionado:** handlers `EventBus.on('FSM_*')` que montam overlays em resposta a transições
- **Adicionado:** `onAuthStateChange` não chama mais `reset()` — emite via FSM ou re-renderiza o menu

### `api/auth.js` — reescrito

- **Removido:** `withTimeout()`, `executeWithAutoRetry()` — responsabilidade movida para `SyncQueue`
- **Removido:** `updateMaxScore()` — substituído por `persistScore()` (nome mais claro)
- **Removido:** `updateState()` chamado de dentro de auth.js — auth.js não conhece o estado do jogo
- **Mantido:** `clearUserHistory()`, `processPendingResets()`, `getUserProfile()`, providers OAuth

### `game/state.js` — limpeza

- Sem alterações de interface (`state`, `updateState`, `resetState`)
- Comentários reorganizados, estrutura do objeto `boss` consolidada

### Arquivos SEM alterações

`config.js`, `helpers.js`, `input.js`, `sprites.js`, `update.js`, `weapons.js`, `supabase.js`, `hud.js`, `overlay.js`, `style.css`

---

## Fluxo dos bugs corrigidos

### Perda de dados (sync async sem garantia)
**Antes:** `syncScore()` era `await`ed inline, mas podia ser interrompida por `reset()`.
**Agora:** `SyncQueue` processa em background de forma serial. O estado `SYNCING` bloqueia
a navegação até `SYNC_DONE`. Mesmo que o usuário clique "pular", a fila continua processando.

### Tela congelando
**Antes:** `await syncScore(...)` bloqueava a thread antes de mostrar o overlay.
**Agora:** `SYNCING` é um estado da FSM — o overlay aparece imediatamente, o I/O roda em background.

### Menu não retorna após banco confirmar
**Antes:** `reset()` navegava antes de `syncScore()` terminar.
**Agora:** a transição `SYNCING → WAVE_END/GAME_OVER/MENU` só ocorre ao receber `SYNC_DONE`.

### Bug #6 — cancelar no confirm chama reset()
**Antes:** `cancelBtn.onclick` chamava `reset()` para "redesenhar o menu".
**Agora:** `cancelBtn.onclick` apenas fecha o overlay. Se estava jogando, retoma.
O menu já está renderizado embaixo do overlay — não precisa ser reconstruído.

### TOKEN_REFRESH matando estado de jogo
**Antes:** `onAuthStateChange` chamava `reset()` para qualquer evento, incluindo `TOKEN_REFRESHED`.
**Agora:** `TOKEN_REFRESHED` retorna silenciosamente na primeira linha do listener.
