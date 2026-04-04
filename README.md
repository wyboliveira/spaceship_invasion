# SPACESHIP INVASION

> **Projeto de estudo.** Jogo arcade de nave espacial inspirado no clássico Space Invaders, construído do zero com Vanilla JS + Canvas API. Desenvolvido para praticar arquitetura de software em camadas, autenticação OAuth, persistência de dados com estratégia local-first e cobertura de testes automatizados.

## Destaques do projeto

- 100 waves com dificuldade progressiva e 10 bosses únicos (sprites programáticos via Canvas API)
- Autenticação com Google e GitHub via Firebase Auth (popup OAuth, sem redirect)
- Persistência local-first: progresso salvo no localStorage imediatamente, sincronizado com Firestore sob demanda
- Leaderboard global via Firestore com paginação
- Sistema de áudio completo (Howler.js): músicas, SFX, crossfade, duck e playlist
- Arquitetura em 4 camadas: FSM → EventBus → I/O (Firebase) → Orquestrador
- Suite de testes com 150 casos (Vitest + jsdom), cobrindo todos os módulos principais

---

## Como rodar localmente

### Pré-requisitos
- Node.js 18+
- Uma conta no [Firebase](https://firebase.google.com) (opcional — o jogo funciona sem auth no modo guest)

### Instalação

```bash
git clone https://github.com/wyboliveira/spaceship_invasion.git
cd spaceship_invasion
npm install
```

### Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto com as chaves do seu projeto Firebase
(Console Firebase → Project Settings → Your apps → Config):

```env
VITE_FIREBASE_API_KEY=sua_api_key
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:xxxxxxxx
```

Sem esse arquivo, o jogo inicia normalmente em **modo guest** (sem login, sem sync).

### Rodando

```bash
npm run dev      # servidor de desenvolvimento
npm run build    # build de produção
npm run preview  # preview do build
npm test         # testes com Vitest
```

---

## Stack

| Camada        | Tecnologia              |
|---------------|-------------------------|
| Frontend      | Vanilla JS (ES Modules) |
| Renderização  | Canvas API 2D           |
| Build tool    | Vite 5                  |
| Auth & DB     | Firebase (Auth + Firestore) |
| Áudio         | Howler.js               |
| Testes        | Vitest + jsdom          |

---

## Arquitetura — 4 Camadas

O projeto usa uma arquitetura em 4 camadas onde cada arquivo tem uma responsabilidade única. Nenhuma camada chama outra fora de sua ordem.

```
┌─────────────────────────────────────────────────────┐
│  Camada 1 — GameFSM                                 │
│  Máquina de estados. Única fonte de verdade sobre   │
│  "onde o jogo está agora". Não renderiza, não faz   │
│  I/O. Só valida e emite transições.                 │
├─────────────────────────────────────────────────────┤
│  Camada 2 — EventBus                                │
│  Barramento pub/sub. Desacopla FSM, game loop e UI. │
│  Módulos não se chamam diretamente — emitem eventos.│
├─────────────────────────────────────────────────────┤
│  Camada 3 — SyncQueue / api/auth.js                 │
│  I/O puro. Chamadas ao Firebase Auth e Firestore.   │
│  O jogo nunca espera rede — tudo é fire-and-forget  │
│  ou local-first.                                    │
├─────────────────────────────────────────────────────┤
│  Camada 4 — main.js                                 │
│  Orquestrador. Liga as camadas, monta a UI,         │
│  escuta onAuthStateChanged e executa o game loop.   │
└─────────────────────────────────────────────────────┘
```

### Diagrama de estados — GameFSM

```
                    ┌────────────┐
          ┌────────▶│    MENU    │◀───────────────┐
          │         └─────┬──────┘                 │
          │               │ start()                │
          │               ▼                        │
          │         ┌────────────┐  game over      │
          │  back   │  PLAYING   │────────────────▶│
     RESET GAME ◀──│            │                  │
          │         │            │  wave clear     │
          │         └─────┬──────┴──────────────┐  │
          │               │ P / pause           │  │
          │               ▼                     ▼  │
          │         ┌────────────┐        ┌──────────────┐
          │         │   PAUSED   │        │  WAVE_END /  │
          │         │            │        │  GAME_OVER   │
          │         └─────┬──────┘        └──────┬───────┘
          │               │ P / resume           │
          │               ▼                      │ next wave /
          │         ┌────────────┐               │ restart
          └─────────│  PLAYING   │◀──────────────┘
                    └────────────┘
```

Transições inválidas são silenciosamente ignoradas com log de aviso — nunca causam crash.

---

## Persistência — Local-first sync

O score **nunca espera a rede** para ser salvo. O fluxo é:

```
Fim de partida
     │
     ▼
localStorage  ←── salvo imediatamente (sem rede)
     │               pendingSync = true
     │
     │   usuário clica SYNC RECORDS
     ▼
Firestore     ←── setDoc com merge:true (max_score / max_wave)
     │               pendingSync = false
     ▼
lastSyncedAt atualizado na UI
```

Isso garante que quedas de conexão ou erros de rede **não apagam o progresso** do jogador.
O Firestore não tem cold start — responde em ~50ms sempre.

---

## Sprites

Todos os sprites são desenhados programaticamente via `fillRect` — sem imagens externas.

```
JOGADOR              INIMIGO A (Lula)     INIMIGO B (Caranguejo)  INIMIGO C (Zumbi)
  (ciano)              (rosa)               (laranja)               (roxo)

   ██                  ██  ██               ██████████             ████████
  ████                ██████████           ██████████████         ██████████████
  ████                ████████████         ██  ██  ████           ██  ████  ██
 ██████               ████████████████     ██████████████         ██████████████
  ████                ██ ████ ████ ██                               ████████████
  ████                                                              ████████████
  ▓▓▓▓  ← thruster
```

```
BOSS (vermelho / neon wave 100)       DROP ARMA   DROP CORAÇÃO
                                        (verde)      (rosa)
   ████████████████████
  ██████████████████████                 ███          ████ ████
 ████████████████████████                ████████    ██████████
  ████████████████████████               ███         ████████
 ██  ████  ████  ████  ██                            ██████
  ██ ████ ██ ██ ████ ██                               ████
      ██████████████                                   ██
      ████████████
```

---

## Sistema de waves

O jogo tem **100 waves** mapeadas em 10 bandas de dificuldade + escalonamento infinito após a wave 100.

| Banda | Waves   | Grade        | HP inimigo | Escudos | Destaque                    |
|-------|---------|--------------|------------|---------|-----------------------------|
| 1     | 1–5     | 8×2          | 1          | ✅      | Introdução                  |
| 2     | 6–10    | 9×3          | 1          | ✅      | Grade maior                 |
| 3     | 11–20   | 10×4         | 2          | ✅      | 2 HP, grade quase cheia     |
| 4     | 21–30   | 11×4         | 2          | ❌      | Sem escudos, pressão alta   |
| 5     | 31–40   | 11×5         | 3          | ✅      | Grade máxima                |
| 6     | 41–50   | 12×5         | 3          | ✅      | Boss W50 com escudo         |
| 7     | 51–60   | 12×5         | 4          | ❌      | 4 HP, ritmo de fogo alto    |
| 8     | 61–70   | 12×5         | 4          | ✅      | Velocidade extrema          |
| 9     | 71–85   | 12×5         | 5          | ❌      | Inferno                     |
| 10    | 86–100  | 12×5         | 6          | ✅      | Endgame / Boss neon W100    |

Bosses aparecem nas waves **10, 20, 30, 40, 50, 60, 70, 80, 90 e 100**.

---

## Auth & Roles

| Role     | Acesso                                        |
|----------|-----------------------------------------------|
| `guest`  | Jogo completo, sem sync de records            |
| `player` | Jogo completo + sync de records no Firestore  |
| `admin`  | Tudo acima + painel de debug de bosses        |

Para promover um usuário a admin, edite o documento diretamente no Console do Firebase
(Firestore → profiles → [documento do usuário] → campo `role` → `admin`).

---

## Estrutura de pastas

```
src/
├── core/
│   ├── GameFSM.js       # Camada 1 — máquina de estados
│   ├── EventBus.js      # Camada 2 — barramento pub/sub
│   └── SyncQueue.js     # Camada 3 — fila de I/O com retry
├── api/
│   └── auth.js          # Camada 3 — Firebase Auth + Firestore
├── lib/
│   ├── firebase.js      # inicialização do Firebase (auth + db)
│   └── localStore.js    # cache localStorage (local-first)
├── game/
│   ├── config.js        # constantes, bandas de dificuldade, BOSS_CONFIGS
│   ├── state.js         # estado global do jogo (objeto mutável centralizado)
│   ├── update.js        # lógica de tick: colisões, física, drops
│   ├── sprites.js       # todos os drawX() com Canvas API
│   ├── helpers.js       # criação de grade de inimigos e escudos
│   ├── weapons.js       # sistema de upgrade de armas
│   └── input.js         # captura de teclado
├── ui/
│   ├── hud.js           # HUD e editor inline de username
│   └── overlay.js       # show/hide de screens e modais
└── main.js              # Camada 4 — orquestrador e game loop
```

---

## Controles

| Tecla       | Ação              |
|-------------|-------------------|
| `← →`       | Mover nave        |
| `Espaço`    | Atirar            |
| `P`         | Pausar / Retomar  |
| `R`         | Reiniciar partida |

---

*Projeto em desenvolvimento — v2.0.0 (Firebase edition)*
