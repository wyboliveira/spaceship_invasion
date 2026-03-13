# 🚀 Spaceship Invasion — Dev Edition
### Documentação Técnica Completa

---

## Índice

1. [Visão Geral do Projeto](#visão-geral)
2. [Arquitetura do Código](#arquitetura)
3. [Variáveis Configuráveis](#variáveis-configuráveis)
4. [Customização de Sprites](#sprites)
5. [Estrutura para Deploy em Produção](#deploy)
6. [Planejamento de Features](#features)
7. [Estratégia de CI/CD](#cicd)
8. [Testes](#testes)
9. [Autenticação e Segurança](#segurança)
10. [Roadmap Sugerido](#roadmap)

---

## 1. Visão Geral do Projeto <a name="visão-geral"></a>

O projeto é um jogo estilo Space Invaders desenvolvido em **HTML5 Canvas + JavaScript puro**, sem dependências externas. Essa escolha permite:

- Rodar diretamente no navegador sem instalação
- Fácil deploy em qualquer CDN ou servidor estático
- Portabilidade total (funciona em desktop e mobile)
- Base limpa para evoluir para um framework (React, Vue, etc.)

**Stack atual:**
- Frontend: HTML5 + Canvas API + JavaScript ES6+
- Fontes: Google Fonts (Orbitron + Share Tech Mono)
- Sem backend (versão 1.0 — local apenas)

---

## 2. Arquitetura do Código <a name="arquitetura"></a>

O código está organizado em módulos lógicos comentados com `// ──` para facilitar navegação:

```
CONFIG          → Leitura e validação dos controles de configuração
CANVAS & CTX    → Referências ao canvas e contexto 2D
SPRITES         → Funções de desenho: drawPlayer, drawEnemy, drawBullet, etc.
SHIELDS         → Criação e lógica dos escudos destrutíveis
ENEMIES GRID    → Criação da grade de inimigos
INIT            → Inicialização/reset do estado de jogo
HUD             → Atualização do display (score, vidas, wave)
INPUT           → Captura de teclado
GAME LOOP       → Loop principal com requestAnimationFrame
UPDATE          → Física, colisões, movimento, tiro
RENDER          → Desenho de todos os objetos por frame
OVERLAY         → Telas de início, pausa e game over
PUBLIC API      → startGame(), resetGame()
```

### Estado do Jogo (`state`)

```javascript
state = {
  player: { x, y, w, h },
  lives: number,
  bullets: [],           // balas do jogador
  enemyBullets: [],      // balas dos inimigos
  enemies: [],           // grid de inimigos
  shields: [],           // escudos destrutíveis
  particles: [],         // sistema de partículas (explosões)
  enemyDir: 1,           // direção atual (-1 = esquerda, 1 = direita)
  enemyMoveTimer: 0,
  enemyMoveInterval: 800,
  enemyFireTimer: 0,
  frame: 0,
  flashTimer: 0,
}
```

---

## 3. Variáveis Configuráveis <a name="variáveis-configuráveis"></a>

Todas as variáveis são expostas via painel de controle em tempo real. No código, cada uma está em `CONFIG`:

| Variável | Painel | Descrição | Range |
|---|---|---|---|
| `lives` | Vidas | Número de vidas do jogador | 1–9 |
| `playerSpeed` | Vel. Player | Pixels por frame de movimento | 2–12 |
| `maxBullets` | Balas (máx.) | Máximo de projéteis simultâneos | 1–8 |
| `bulletSpeed` | Vel. Bala | Velocidade dos projéteis | 4–18 |
| `fireCooldown` | Cooldown tiro | Intervalo mínimo entre tiros (ms) | 80–1000 |
| `enemyCols` | Colunas | Número de colunas de inimigos | 4–14 |
| `enemyRows` | Linhas | Número de linhas de inimigos | 1–6 |
| `enemySpeed` | Vel. inimigo | Multiplicador de velocidade da grade | 0.3–4 |
| `enemyFireRate` | Freq. tiro | Tiros por segundo dos inimigos | 0.2–5 |
| `enemyHP` | HP inimigo | Pontos de vida por inimigo | 1–5 |

### Para adicionar uma nova variável configurável:

1. Adicionar o controle HTML no painel (slider, checkbox, etc.)
2. Ler o valor em `readConfig()`: `CONFIG.minhaVar = +document.getElementById('minhaVar').value`
3. Usar `CONFIG.minhaVar` no lugar do valor hardcoded no código

---

## 4. Customização de Sprites <a name="sprites"></a>

Os sprites são desenhados programaticamente via Canvas 2D com `ctx.fillRect()`. Isso é 100% customizável.

### Estrutura de uma função de sprite:

```javascript
function drawPlayer(x, y, color) {
  ctx.shadowColor = color;     // glow effect
  ctx.shadowBlur = 12;
  ctx.fillStyle = color;

  // Fuselagem: retângulos pixel a pixel
  ctx.fillRect(x+10, y+8, 6, 18);   // fillRect(x, y, width, height)
  ctx.fillRect(x+2,  y+16, 8, 6);   // asa esquerda
  // ...

  ctx.shadowBlur = 0;          // sempre resetar o glow
}
```

### Para customizar a nave do jogador:

Encontre a função `drawPlayer(x, y, color)` e modifique os `fillRect`. O sprite é desenhado num grid de ~26x28 pixels. Use uma ferramenta como **Piskel** ou **Aseprite** para planejar o pixel art e depois traduzir para `fillRect`.

### Para usar imagens PNG em vez de pixel art:

```javascript
// No topo do script, carregue a imagem
const playerImg = new Image();
playerImg.src = 'assets/player.png';

// Na função drawPlayer:
function drawPlayer(ctx, x, y) {
  ctx.drawImage(playerImg, x, y, 34, 36);
}
```

### Tipos de inimigos:

Existem 3 sprites diferentes baseados na linha (`row`):
- `row < 1` → Tipo A (calamar) — 30 pontos
- `row < 3` → Tipo B (caranguejo) — 20 pontos
- `row >= 3` → Tipo C (zumbido) — 10 pontos

Todos animam em 2 frames (`t = Math.floor(frame * 0.05) % 2`).

---

## 5. Estrutura para Deploy em Produção <a name="deploy"></a>

### Versão 1.0 (arquivo único — já pronto)

O `space-invaders.html` pode ser hospedado diretamente em:
- **Netlify** (drag & drop do arquivo)
- **Vercel** (repositório GitHub)
- **GitHub Pages** (gratuito)
- **AWS S3 + CloudFront** (produção escalável)

### Estrutura de projeto recomendada para escalar:

```
space-invaders/
├── public/
│   ├── index.html
│   ├── assets/
│   │   ├── sprites/       ← PNGs dos sprites
│   │   └── sounds/        ← efeitos sonoros (ogg/mp3)
├── src/
│   ├── game/
│   │   ├── config.js      ← CONFIG e readConfig()
│   │   ├── state.js       ← estado global
│   │   ├── input.js       ← captura de teclado/touch
│   │   ├── update.js      ← lógica de física e colisões
│   │   ├── render.js      ← todas as funções de draw
│   │   ├── sprites.js     ← drawPlayer, drawEnemy, etc.
│   │   └── loop.js        ← loop principal
│   ├── ui/
│   │   ├── hud.js         ← HUD e overlay
│   │   └── config-panel.js ← painel de configuração
│   ├── api/               ← chamadas ao backend (scores, auth)
│   │   ├── auth.js
│   │   └── leaderboard.js
│   └── main.js            ← entry point
├── tests/
│   ├── unit/
│   └── e2e/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
├── package.json
├── vite.config.js         ← ou webpack.config.js
└── README.md
```

### Bundler recomendado e em uso: **Vite**

```bash
npm run dev    # Ambiente de desenvolvimento em localhost
npm run build  # Compila e gera pasta dist/ ofuscada e otimizada para produção
npm run test   # Roda a stack de Vitest em watch-mode
```

#### Omitir o Helper em Produção:
Quando formos "empacotar" o jogo para produção, usaremos o Vite (que já está configurado no repositório) para remover qualquer linha de exposição global usando as variáveis de ambiente em tempo de compilação.
>(ex: `if (import.meta.env.DEV) { window.GameTest = ... }`).

Assim, no jogo final, todas essas facilidades e atalhos abertos para automação somem, não criando nenhum risco de injeção ou vulnerabilidade via console do DevTools.

---

## 6. Planejamento de Features <a name="features"></a>

### Sistema de Feature Flags

Antes de adicionar features grandes, implemente um sistema de flags:

```javascript
// src/config/features.js
export const FEATURES = {
  SOUND_ENABLED: false,       // toggle para adicionar som
  LEADERBOARD: false,         // ranking online
  MOBILE_CONTROLS: false,     // controles touch
  POWER_UPS: false,           // itens no mapa
  BOSS_WAVE: false,           // wave com boss
  MULTIPLAYER: false,         // local co-op
};
```

### Features planejadas (backlog atualizado):

**P0 (Concluídas e em Andamento):**
- [x] Jogo base com escalonamento infinito (100+ Waves)
- [x] Sistema de Drops Recompensadores (Vidas aleatórias e Níveis de Arma crescentes)
- [x] Efeito de Ímã End-Wave para evitar perda acidental de drop
- [x] Batalhas Épicas contra Chefões (Bosses) a cada 10 ondas, com shield e tiro-triplo
- [x] Bateria de Automação de CQA via Vitest 
- [ ] Adicionar Efeitos Sonoros / Trilha Sonora (Web Audio API)
- [ ] Tela de Game Over completa computando score final offline
- [ ] Painel direcional Touch (Virtual Joystick) para Mobile UI

**P1 (Sistemas Online & Comunidade):**
- [ ] **Leaderboard online mundial / Top 10 Ranks** (Requer backend Database)
- [ ] Autenticação de jogadores para proteção do ranqueamento do Leaderboard
- [ ] Novos Buffs (Escudo de Invulnerabilidade temporária)

**P2 (Futuro Distante):**
- [ ] Modo cooperativo local share-screen
- [ ] Eventos sazonais e novas cores Neon de acordo com estéticas

---

## 7. Estratégia de CI/CD <a name="cicd"></a>

### Pipeline recomendado (GitHub Actions):

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  deploy-preview:
    needs: test
    if: github.event_name == 'pull_request'
    # Deploy para URL de preview (Vercel/Netlify)
    # Cada PR recebe URL única para revisão

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    # Deploy automático para produção
```

### Branches recomendadas:

```
main          ← produção (protegida, requer PR + review)
develop       ← integração de features
feature/xxx   ← features individuais
bugfix/xxx    ← correções
hotfix/xxx    ← correções urgentes em produção
```

### Versionamento semântico:

```
v1.0.0  ← Major.Minor.Patch
v1.1.0  ← nova feature sem quebrar compatibilidade
v1.1.1  ← bugfix
v2.0.0  ← mudança que quebra compatibilidade (novo sistema de auth, por ex.)
```

---

## 8. Testes <a name="testes"></a>

### Tipos de teste para o projeto:

#### Testes Unitários (Vitest ou Jest)

Funções puras são fáceis de testar:

```javascript
// tests/unit/collision.test.js
import { checkBulletEnemyCollision } from '../../src/game/update.js';

test('bullet hits enemy when overlapping', () => {
  const bullet = { x: 50, y: 50 };
  const enemy  = { x: 40, y: 40, alive: true, hp: 1 };
  expect(checkBulletEnemyCollision(bullet, enemy)).toBe(true);
});

test('bullet misses enemy when not overlapping', () => {
  const bullet = { x: 200, y: 200 };
  const enemy  = { x: 40, y: 40, alive: true, hp: 1 };
  expect(checkBulletEnemyCollision(bullet, enemy)).toBe(false);
});
```

#### Testes de Integração

Testar a lógica do loop de jogo com estado simulado:

```javascript
// tests/integration/game-loop.test.js
test('enemy reaches bottom triggers game over', () => {
  const state = createTestState();
  state.enemies[0].y = CANVAS_HEIGHT - 10; // simular inimigo perto do fundo
  const result = update(state, 16);
  expect(result.gameOver).toBe(true);
});
```

#### Testes E2E (Playwright ou Cypress)

```javascript
// tests/e2e/game.spec.js
test('player can start game and shoot', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.click('#startBtn');
  await page.keyboard.press('Space');
  // verificar que bala foi criada no canvas
});
```

### Configuração do Vitest:

```bash
npm install -D vitest @vitest/coverage-v8
```

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

---

## 9. Autenticação e Segurança <a name="segurança"></a>

### Autenticação Recomendada

Para adicionar login ao jogo:

**Opção A — Auth0 / Supabase Auth (mais rápido):**
- Pronto para uso, sem backend próprio
- Suporta Google, GitHub, email/senha
- SDK JavaScript simples

**Opção B — Backend próprio (Node.js + JWT):**

```javascript
// Fluxo básico
// 1. Usuário faz login → backend retorna JWT
// 2. Frontend armazena token (httpOnly cookie, não localStorage)
// 3. Cada requisição inclui token no header Authorization
// 4. Backend valida token antes de salvar scores, etc.
```

### Segurança para Jogo Online

| Área | Risco | Mitigação |
|---|---|---|
| **Score manipulation** | Usuário envia score falso | Validar servidor-side: recalcular score com log de eventos |
| **XSS** | Injeção via inputs | Sanitizar todo input, usar Content-Security-Policy header |
| **HTTPS** | Dados em claro | Sempre usar HTTPS em produção (Let's Encrypt gratuito) |
| **Rate limiting** | Spam de requisições | Express-rate-limit ou AWS WAF |
| **CORS** | Requests de origens indevidas | Configurar CORS restritivo no backend |
| **Secrets no frontend** | API keys expostas | Nunca colocar chaves no JS client-side; usar backend como proxy |
| **SQL Injection** | Se usar banco próprio | Usar ORM (Prisma, Drizzle) ou prepared statements |
| **Autenticação fraca** | Senhas fracas, brute force | bcrypt para hash, rate limit em login, captcha |

### Headers de Segurança Recomendados:

```javascript
// Se usar Express.js no backend
import helmet from 'helmet';
app.use(helmet());

// Headers importantes:
// Content-Security-Policy: default-src 'self'
// X-Frame-Options: DENY
// X-Content-Type-Options: nosniff
// Strict-Transport-Security: max-age=31536000
```

---

## 10. Roadmap Sugerido <a name="roadmap"></a>

### Sprint 1 — Fundação & Escalabilidade Base (Concluída)
- [x] Jogo funcional com configuração em tempo real via UI
- [x] Migração para módulo ecossistema com bundler Vite
- [x] Multiplas entidades dinâmicas (Boss, Elite, Escudos, Partículas)
- [x] Framework de colisão rigoroso
- [x] Design progressivo com 100 leveis estruturados

### Sprint 2 — Mecânicas & Lógica Definitiva (Quase Concluída)
- [x] Testes Mapeados TDD (Unit) e Testes Visuais em navegador  
- [x] Pishing & Otimizações: Balanceamento (-15% Endgame Nerf)
- [x] Sistema de Loot Completo (Armas em leque e Drops dinâmicos baseados no RNG)
- [ ] Áudio imersivo (Lasers, Explosões e Warnings do Boss)

### Sprint 3 — Cloud, Identidade e Competição (Iniciando em Breve)
- [ ] Estrutura Backend (SupaBase ou Banco SQLite na nuvem)
- [ ] Configuração de Identificação de Usuário
- [ ] Criação de Tabela "Leaderboard Global" cravando os maiores recordes alcançados 

### Sprint 4 — Publish (Final Release)
- [ ] Refino de vulnerabilidades (Ocultar API de testes import.meta.env.DEV)
- [ ] Monitoramento Live (Deploy na Vercel/Netlify)
- [ ] Resizer responsivo Mobile Fullscreen

---

## Referências e Recursos

- **Canvas API:** https://developer.mozilla.org/pt-BR/docs/Web/API/Canvas_API
- **Vite:** https://vitejs.dev
- **Vitest:** https://vitest.dev
- **Playwright:** https://playwright.dev
- **Supabase (auth + banco):** https://supabase.com
- **Auth0:** https://auth0.com
- **GitHub Actions:** https://docs.github.com/en/actions
- **Netlify:** https://netlify.com
- **Vercel:** https://vercel.com

---

*Documentação gerada para Spaceship Invasion Dev Edition v1.1.0 (UI Update)*
