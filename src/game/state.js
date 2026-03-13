// ── Estado Global do Jogo ─────────────────────────────────────
// Mantém as variáveis dinâmicas da partida atual. Este objeto é mutável
// e lido por todo o game loop (update, render, etc).
export let state = {
  cfg: null,             // Configuração atual da wave (vida, velocidade, etc)
  wave: 0,               // Número da onda (fase) atual
  lives: 0,              // Vidas restantes do jogador
  player: { x: 0, y: 0, w: 0, h: 0 }, // Posição geométrica do jogador
  weaponLevel: 1,        // Nível atual da arma (1 = tiro simples, 5 = espalhado)
  
  bullets: [],           // Array de tiros disparados pelo jogador
  eBullets: [],          // Array de tiros disparados pelos inimigos/boss
  enemies: [],           // Array de inimigos comuns vivos na tela
  shields: [],           // Array de blocos de escudo de defesa do jogador
  drops: [],             // Array de itens (coração, arma) caindo na tela
  particles: [],         // Efeitos visuais (explosões, faíscas)
  
  enemyDir: 1,           // Direção de movimento dos inimigos (1 = direita, -1 = esquerda)
  enemyMoveTimer: 0,     // Temporizador para o passo lateral/descida dos inimigos
  enemyFireTimer: 0,     // Temporizador global para controle de cadência inimiga
  
  frame: 0,              // Contador de frames (usado em animações de sprite)
  flashTimer: 0,         // Temporizador do efeito de tela piscando vermelho (quando o jogador toma dano)
  lastFire: 0,           // Timestamp do último tiro disparado pelo jogador (cooldown)
  
  paused: false,         // Flag se o jogo está pausado
  over: false,           // Flag se o jogo terminou (game over ou wave clear)
  postWaveMagnet: false, // Flag se a fase acabou mas ainda está sugando os drops restantes
  _lastTs: 0,            // Timestamp do último frame renderizado (para cálculo de Delta Time - dt)
  score: 0,              // Pontuação acumulada
  
  // Dados do Chefão (quando aplicável na wave múltipla de 10)
  boss: {
    active: false,       // O boss está presente na tela?
    introAnim: false,    // O boss está executando animação de entrada?
    introStep: 0,
    x: 0,
    y: 0,
    hp: 0,               // Vida atual
    maxHp: 0,            // Vida total
    shield: 0,           // Escudo extra
    flashTimer: 0,       // Flash branco ao tomar dano
    dir: 1,
    fireTimer: 0
  }
};

/**
 * Atualiza propriedades específicas do estado sem sobrescrever o objeto todo.
 * @param {Object} newState Variáveis a atualizar (ex: { score: 100 })
 */
export function updateState(newState) {
  state = { ...state, ...newState };
}

/**
 * Zera o estado para um valor base (apenas usado no bootstrap total caso necessário).
 */
export function resetState(baseState) {
    state = { ...baseState };
}
