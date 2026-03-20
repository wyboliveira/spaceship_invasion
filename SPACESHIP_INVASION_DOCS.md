# 🚀 Spaceship Invasion — Dev Edition
### Documentação Técnica — Arquitetura Cloud & Persistência

---

## 🚀 Novidades da Versão Atual (Atualização Supabase)

O projeto evoluiu de um jogo puramente local para uma plataforma com persistência em nuvem, autenticação social e arquitetura modular robusta.

### 1. Stack Tecnológica Atualizada
- **Bundler:** [Vite](https://vitejs.dev/) (Substituiu o HTML legível por módulos ES6).
- **Backend-as-a-Service:** [Supabase](https://supabase.com/) (Auth + Database PostgreSQL).
- **Frontend:** Vanilla JavaScript (Canvas API) + CSS Dinâmico.
- **Testes:** [Vitest](https://vitest.dev/) (Unitários e Integração).

---

## 🛠 Arquitetura de Persistência e Auth

### Fluxo de Autenticação
Implementamos um sistema de login social via **Google** e **GitHub**.
- **Forced Selection:** Configuramos `prompt: 'select_account'` para permitir que o usuário troque de conta facilmente em cada tentativa de login.
- **Estado Reativo:** O estado global `state.session` e `state.userProfile` são sincronizados automaticamente através do listener `onAuthStateChange`.

### Estratégia de Salvamento (Persistence)
Utilizamos o padrão **Optimistic UI with Background Sync**:
1. **Atualização Imediata:** Quando o jogo acaba ou o histórico é zerado, o `state.userProfile` é atualizado localmente instantaneamente.
2. **Sync em Background:** Uma chamada assíncrona para a tabela `profiles` do Supabase ocorre em paralelo.
3. **Reconciliação:** Ao receber a resposta do banco, o estado local é validado para garantir integridade.

### Resiliência da Interface (UI Resilience)
Para evitar travamentos (Freezes), as operações críticas (`signOut` e `clearUserHistory`) possuem:
- **Timeouts:** Limite programado de 5 segundos.
- **Finally Block:** Garantia de que a interface (Loading/Bloqueio) seja liberada mesmo em caso de erro de rede.

---

## 📊 Estrutura do Banco de Dados (Supabase)

Tabela: `profiles`
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | Relacionado a `auth.users` |
| `max_score` | bigint | Maior pontuação histórica (Antigo `high_score`) |
| `max_wave` | int | Maior onda alcançada |
| `last_score` | bigint | Pontuação da última partida |
| `last_wave` | int | Onda da última partida |
| `updated_at`| timestamptz | Última sincronização |

---

## 🧪 Estratégia de Testes

Dividimos a qualidade do código em três camadas:

1. **Unitários (`tests/helpers.test.js`, `tests/boss.test.js`)**: Validação de fórmulas de colisão, padrões de tiro e configurações de ondas.
2. **Lógica de Persistência (`tests/history.test.js`)**: Garante que o estado local seja resetado corretamente e que o Supabase receba os valores de zeramento.
3. **E2E Simulado/Integração (`tests/integration/flows.test.js`)**: Simula fluxos completos (Login -> Jogar -> Save -> Logout) e verifica se a interface não trava sob falhas simuladas.

---

## 💡 Nossas "Falhas" e Aprendizados (Dev Log)

- **O Bug do Logout Infinito:** Inicialmente, se a rede falhasse durante o `signOut`, a UI ficava presa em "Saindo...". A solução foi desacoplar o estado local da resposta do servidor.
- **Renomeação de Coluna:** Corrigimos o erro conceitual onde chamávamos o recorde de `high_score` no código e `max_score` no banco, padronizando tudo como `max_score`.
- **Hoisting de Mocks:** Aprendemos que o Vitest processa `vi.mock` antes de tudo, o que nos forçou a refatorar o `flows.test.js` para usar closures corretas nos mocks do Supabase.

---

## 🗺 Roadmap Atualizado

### Sprint 3 — Cloud & Identidade (CONCLUÍDA)
- [x] Integração Supabase Auth (Google/GitHub).
- [x] Persistência de Score/Wave na nuvem.
- [x] Funcionalidade de "Zerar Histórico".
- [x] Padronização de documentação JSDoc/PT-BR.

### Sprint 4 — Polimento de Produção (EM ANDAMENTO)
- [ ] Implementar Ranking Global (Leaderboard).
- [ ] Adicionar Trilha Sonora Original.
- [ ] Implementar Responsive Resizer para Mobile.

---

*Documentação atualizada em 18/03/2026 para Spaceship Invasion v1.2.0-cloud*
