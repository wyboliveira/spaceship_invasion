# Arquitetura — Spaceship Invasion

## Estrutura de Arquivos

```
spaceship_invasion/
├── index.html
├── package.json
├── vite.config.js
│
└── src/
    │
    ├── main.js                       ← Orquestrador central
    ├── style.css
    │
    ├── core/                         ← Peças centrais de infraestrutura
    │   ├── EventBus.js               ← Pub/sub: desacopla todos os módulos
    │   ├── GameFSM.js                ← Máquina de estados: governa toda navegação
    │   └── SyncQueue.js              ← Fila serial de I/O com retry (reserva)
    │
    ├── game/
    │   ├── config.js
    │   ├── helpers.js
    │   ├── input.js                  ← Atualizado: ignora atalhos quando foco está em <input>
    │   ├── sprites.js
    │   ├── state.js
    │   ├── update.js
    │   └── weapons.js
    │
    ├── api/
    │   └── auth.js                   ← I/O puro: OAuth, getUserProfile, persistScore, updateUsername
    │
    ├── lib/
    │   ├── supabase.js               ← Cliente Supabase (exporta null em modo guest)
    │   └── localStore.js             ← NOVO: cache local de progresso (local-first)
    │
    └── ui/
        ├── hud.js                    ← Atualizado: editor inline de username (lápis no HUD)
        └── overlay.js
```

---

## Camadas da Arquitetura

| Camada | Arquivo(s) | Responsabilidade |
|---|---|---|
| 1 — FSM | `core/GameFSM.js` | Única fonte de verdade sobre "onde o jogo está agora" |
| 2 — Event Bus | `core/EventBus.js` | Pub/sub. Nenhum módulo chama outro diretamente |
| 3 — Cache Local | `lib/localStore.js` | Progresso do jogador no localStorage (sem rede) |
| 3 — I/O Remoto | `api/auth.js` | Todas as chamadas ao Supabase |
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
sem dependência de rede. O Supabase é atualizado somente quando o usuário decide sincronizar.

```
Fim de wave / game over
  └─ _saveLocalScore()
       └─ localStore.saveLocalProgress()   → localStorage (imediato, sem rede)
            → pendingSync = true

Botão SYNC RECORDS no menu
  └─ persistScore()                        → Supabase (com spinner de loading)
       └─ markSynced()                     → lastSyncedAt = agora, pendingSync = false
```

### O que fica onde

| Dado | Onde fica | Quando atualiza |
|---|---|---|
| Scores e waves | localStorage | A cada fim de partida |
| Username | localStorage + Supabase | Ao salvar no editor inline |
| Histórico de sync | localStorage (`lastSyncedAt`) | Ao clicar SYNC RECORDS |
| Auth token | localStorage gerenciado pelo Supabase SDK | Login/logout |

### Comportamento do botão SYNC RECORDS

- Fica **amarelo** quando há dados pendentes (`pendingSync = true`)
- Fica **verde** quando tudo está sincronizado
- Mostra "LAST SYNC: dd/mm/yyyy hh:mm" abaixo do botão
- Mostra "NUNCA SINCRONIZADO" em vermelho se nunca foi sincronizado

### Primeiro login (novo dispositivo)

Se não há dados locais para o userId, o jogo busca o perfil no Supabase uma única vez
(`getUserProfile`) e inicializa o localStorage (`seedFromDatabase`). Nas sessões seguintes,
os dados locais são usados diretamente — sem chamada de rede.

---

## Editor de Username (HUD)

Um ícone de lápis `✎` (amarelo, `var(--accent3)`) aparece ao passar o mouse sobre o nome
do jogador no HUD. Só é visível quando há sessão ativa.

**Fluxo de edição:**
1. Clique no lápis → input inline aparece com a fonte Orbitron
2. `Enter` → salva no localStorage + Supabase (background), foco vai para `#startBtn`
3. `Escape` ou clicar fora → cancela sem salvar

**Proteção de input:** `input.js` ignora todos os atalhos do jogo (R, P, Enter, Espaço)
quando o foco está em um `<input>` ou `<textarea>`.

---

## Logout

`signOut({ scope: 'global' })` — invalida a sessão no servidor Supabase além de limpar
o localStorage local. Se falhar por rede, o fallback remove manualmente todas as chaves
`sb-*` do localStorage.

---

## O que mudou em relação à arquitetura anterior

### Removido

| O que | Por quê |
|---|---|
| Estado `SYNCING` no fluxo do jogo | Substituído por `_saveLocalScore` (localStorage imediato) |
| `enqueueSyncScore()` + SyncQueue no fluxo | Desnecessário com local-first |
| `clearUserHistory()` em `auth.js` | Substituído por `clearLocalProgress()` em localStore |
| `processPendingResets()` | Desnecessário: localStorage nunca fica sem dados do usuário |
| `_waitSyncOrTimeout()` | Desnecessário: sem fila de rede no fluxo principal |
| `modal-sync` (spinner pós-wave) | UI não bloqueia mais esperando rede |
| `scope: 'local'` no signOut | Substituído por `scope: 'global'` |

### Adicionado

| O que | Onde |
|---|---|
| `lib/localStore.js` | Cache local completo com pendingSync e lastSyncedAt |
| `updateUsername()` | `api/auth.js` — atualiza username no Supabase |
| `updateLocalUsername()` | `lib/localStore.js` — atualiza username no cache |
| `initUsernameEdit()` | `ui/hud.js` — editor inline de username |
| `include/exclude` no vite.config.js | Evita que worktrees do .claude/ sejam incluídas nos testes |
