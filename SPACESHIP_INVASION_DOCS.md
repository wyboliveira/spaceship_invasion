# Spaceship Invasion — Dev Edition
### Documentação Técnica — Arquitetura Cloud & Persistência

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Bundler | [Vite](https://vitejs.dev/) — módulos ES6, dev server na porta 3000 |
| Backend-as-a-Service | [Supabase](https://supabase.com/) — Auth OAuth + PostgreSQL |
| Frontend | Vanilla JavaScript (Canvas API) + CSS com variáveis |
| Áudio | [Howler.js](https://howlerjs.com/) v2.2.4 — Web Audio API com fallback HTML5 |
| Testes | [Vitest](https://vitest.dev/) — unitários e integração, ambiente jsdom |

---

## Autenticação

Login social via **Google** e **GitHub** usando OAuth redirect.

- `prompt: 'select_account'` garante que o Google sempre exibe a tela de seleção de conta
- `scope: 'global'` no logout invalida a sessão no servidor (não apenas no navegador local)
- `TOKEN_REFRESHED` é tratado silenciosamente — não interrompe o jogo
- A URL é limpa após o redirect OAuth (`history.replaceState`) para evitar que o token
  fique visível na barra de endereços ou cause re-autenticação no reload

---

## Persistência de Dados — Estratégia Local-First

O jogo utiliza a estratégia **local-first**: o progresso é salvo no `localStorage` do
navegador de forma imediata, sem depender de rede. O Supabase é atualizado somente
quando o usuário clica no botão **SYNC RECORDS**.

### Por que local-first?

O Supabase no plano gratuito entra em modo de espera após ~10 minutos sem uso. A primeira
requisição após esse período pode demorar 8–12 segundos (cold start). Com a abordagem
anterior (sync automático após cada wave), o jogador via um spinner a cada fim de partida.

Com local-first, o jogo responde instantaneamente e a sincronização com o banco acontece
no momento escolhido pelo usuário.

### Fluxo de dados

```
Partida encerrada (wave end / game over)
  └─ localStorage atualizado imediatamente
       max_score, max_wave, last_score, last_wave
       pendingSync = true

Botão SYNC RECORDS (menu, usuário logado)
  └─ Spinner de loading exibido
  └─ Dados do localStorage enviados ao Supabase via upsert
  └─ lastSyncedAt atualizado, pendingSync = false
  └─ "LAST SYNC: dd/mm/yyyy hh:mm" exibido no menu

Primeiro login ou novo dispositivo
  └─ Sem dados locais → busca do Supabase uma única vez
  └─ localStorage inicializado com dados do banco (seedFromDatabase)
```

### Indicadores visuais no menu

| Estado | Cor do botão SYNC | Mensagem |
|---|---|---|
| Dados pendentes | Amarelo `#FFD700` | "LAST SYNC: [data]" em amarelo |
| Tudo sincronizado | Verde `#00ff88` | "LAST SYNC: [data]" em cinza |
| Nunca sincronizado | Verde `#00ff88` | "NUNCA SINCRONIZADO" em vermelho |

---

## Banco de Dados (Supabase)

Tabela: `profiles`

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid PK | Foreign key para `auth.users` |
| `username` | text | Nome exibido no jogo (editável pelo jogador) |
| `max_score` | bigint | Maior pontuação histórica |
| `max_wave` | int | Maior wave alcançada |
| `last_score` | bigint | Pontuação da última partida |
| `last_wave` | int | Wave da última partida |
| `updated_at` | timestamptz | Última sincronização com o banco |

---

## Editor de Username

O jogador pode editar o nome exibido no HUD passando o mouse sobre ele.
Um ícone de lápis `✎` amarelo aparece no hover. Ao clicar:

1. Um campo de texto inline substitui o nome (mesma fonte Orbitron do HUD)
2. **Enter** salva o nome — atualizado no localStorage imediatamente e no Supabase em background
3. **Escape** ou clicar fora cancela a edição
4. Após salvar, o foco vai para o botão START para o jogador iniciar o jogo com Enter

O username é preservado ao zerar o histórico e ao salvar novos scores.

---

## Testes

A suite usa Vitest com ambiente jsdom. Os testes ficam em `tests/` e são separados por módulo.

```
tests/
├── audio.test.js      ← audioConfig (schema), AudioManager (init, SFX, playlist, FSM)
├── auth.test.js       ← OAuth, getUserProfile, persistScore, updateUsername
├── history.test.js    ← lib/localStore.js: save, load, seed, clear, markSynced, updateUsername
├── flows.test.js      ← Fluxos de integração: partida local, SYNC RECORDS, zerar histórico
├── sync.test.js       ← SyncQueue: enqueue, retry com backoff, SYNC_DONE/SYNC_FAILED
├── core.test.js       ← EventBus e GameFSM: transições válidas e inválidas
├── gameplay.test.js   ← Sistema de armas, configuração de waves, sistema de drops
├── boss.test.js       ← Inicialização e posicionamento de bosses
├── helpers.test.js    ← Criação de inimigos e escudos
└── connection.test.js ← Diagnóstico de latência Supabase (requer rede, não é CI)
```

Howler.js é mockado integralmente nos testes de áudio — nenhuma chamada de Web Audio API real.
Os testes de AudioManager verificam: inicialização, mute/volume, SFX, playlist sequencial,
resiliência a erros de reprodução e integração com todos os eventos FSM relevantes.

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

**Cold start do Supabase free tier**
O plano gratuito pausa instâncias após inatividade. A solução foi abandonar o sync automático
e adotar local-first com sync manual — o usuário só espera quando escolhe sincronizar.

**Separação de responsabilidades no auth**
O `auth.js` não deve conhecer o estado do jogo. Toda lógica de "o que fazer com os dados
após receber do banco" fica no `main.js` ou no `localStore.js`.

**Atalhos de teclado conflitando com inputs**
O handler global de `keydown` em `input.js` precisa verificar `e.target.tagName` antes de
disparar atalhos do jogo — caso contrário, digitar "R" em um campo de texto abre o diálogo
de reiniciar, e "Enter" inicia o jogo antes de salvar o texto.

**Mocks de Supabase no Vitest**
O Vitest processa `vi.mock()` antes de qualquer `import`. É necessário usar `vi.hoisted()`
para criar mocks que serão referenciados dentro do bloco `vi.mock()`.

**Double-emit de evento no mesmo frame**
Quando o boss morre dentro do loop `.filter()` de balas, `GAME_WAVE_CLEAR` é emitido
síncronamente e seta `state.over = true`. O `update()` continua no mesmo frame e pode
re-entrar no bloco de vitória, emitindo `GAME_BOSS_SPAWN` uma segunda vez. Solução:
guard `if (state.over) return` antes do bloco de vitória.

**Resquícios visuais após stopLoop()**
Partículas renderizadas no `gameCanvas` permanecem visíveis através da sobreposição
semi-transparente (88% de opacidade) das telas de pausa/game over. Solução:
`ctx.clearRect()` + `state.particles = []` imediatamente após `stopLoop()`.

---

## Roadmap

### Concluído
- [x] Integração Supabase Auth (Google/GitHub)
- [x] Persistência local-first com SYNC RECORDS manual
- [x] Editor de username inline no HUD
- [x] FSM de 6 estados para navegação do jogo
- [x] Suite de testes com 102 casos cobrindo todos os módulos principais
- [x] Sistema de áudio completo (Howler.js): músicas, SFX, playlist, crossfade, duck
- [x] Favicon neon da nave

### Planejado
- [ ] Leaderboard global (já há campo `username` na tabela `profiles`)
- [ ] Responsive/mobile resizer
