/**
 * audioConfig.js — Fonte única de verdade para todos os áudios do jogo.
 *
 * ─── COMO TROCAR UM SOM ───────────────────────────────────────────────────
 *  Música  → altere o campo `src` na seção `music` (ex: music.gameplay.src)
 *  Efeito  → altere o campo `src` no item da seção `sfx` pelo `event` correto
 *  Volume  → ajuste o campo `volume` (0.0 a 1.0) sem tocar em mais nada
 *  Formato → Howler tenta os caminhos em ordem; coloque .ogg primeiro (menor),
 *             .mp3 ou .wav como fallback
 *
 * Nenhum outro arquivo precisa ser modificado ao trocar arquivos de áudio.
 *
 * Estrutura esperada em /public:
 *   /public/music/   ← trilhas em loop (.ogg / .mp3)
 *   /public/sfx/     ← efeitos sonoros (.ogg / .wav)
 * ─────────────────────────────────────────────────────────────────────────
 */

export const audioConfig = {

  // ── Músicas ───────────────────────────────────────────────────────────────
  //
  // Faixa simples (src + loop):
  //   `trackId`  chave interna — não alterar
  //   `src`      array de caminhos; Howler tenta em ordem
  //   `loop`     true = toca em loop; false = toca uma vez
  //   `volume`   volume alvo (0.0–1.0); fade parte de 0 até este valor
  //   `fadeMs`   duração do crossfade em ms
  //
  // Playlist (playlist[]):
  //   Faixas reproduzidas em sequência. Ao terminar a última, volta à primeira.
  //   Cada item da playlist tem apenas `src`.
  //   `volume` e `fadeMs` valem para todas as faixas da playlist.
  //
  // Nota: não há trilha separada para game over.
  // Ao entrar em GAME_OVER, a música atual é reduzida a 15% (igual pause).

  music: {
    menu: {
      trackId: 'menu',
      src:     ['/music/menu.ogg', '/music/menu.mp3'],
      loop:    true,
      volume:  0.35,
      fadeMs:  800,
    },

    // gameplay: sequência de 3 faixas tocadas uma após a outra.
    // Para adicionar/remover músicas: edite apenas o array `playlist`.
    // Para substituir uma faixa: troque o `src` do item correspondente.
    gameplay: {
      trackId:  'gameplay',
      playlist: [
        { src: ['/music/gameplay_1.ogg', '/music/gameplay_1.mp3'] },
        { src: ['/music/gameplay_2.ogg', '/music/gameplay_2.mp3'] },
        { src: ['/music/gameplay_3.ogg', '/music/gameplay_3.mp3'] },
      ],
      volume:  0.10,
      fadeMs:  600,
    },

    boss: {
      trackId: 'boss',
      src:     ['/music/boss.ogg', '/music/boss.mp3'],
      loop:    true,
      volume:  0.40,
      fadeMs:  300,
    },
  },

  // ── Efeitos sonoros ───────────────────────────────────────────────────────
  //
  // `event`    nome exato do evento emitido pelo EventBus que dispara este som
  // `src`      array de caminhos; Howler tenta em ordem
  // `volume`   volume deste efeito (0.0 a 1.0)
  //
  // Eventos customizados (SFX_*) são emitidos por update.js.
  // Eventos de jogo (GAME_*) já existem no sistema e são reaproveitados.

  sfx: [
    {
      event:  'SFX_PLAYER_SHOOT',
      src:    ['/sfx/shoot.ogg', '/sfx/shoot.wav'],
      volume: 0.25,
    },
    {
      event:  'SFX_ENEMY_DIE',
      src:    ['/sfx/enemy_die.ogg', '/sfx/enemy_die.wav'],
      volume: 0.40,
    },
    {
      event:  'SFX_PLAYER_HIT',
      src:    ['/sfx/player_hit.ogg', '/sfx/player_hit.wav'],
      volume: 0.70,
    },
    {
      event:  'SFX_DROP_COLLECT',
      src:    ['/sfx/drop_collect.ogg', '/sfx/drop_collect.wav'],
      volume: 0.55,
    },
    // GAME_BOSS_SPAWN: emitido por update.js quando o boss entra em cena.
    // O AudioManager também usa este evento para trocar a trilha para 'boss'.
    {
      event:  'GAME_BOSS_SPAWN',
      src:    ['/sfx/boss_spawn.ogg', '/sfx/boss_spawn.wav'],
      volume: 0.70,
    },
    // GAME_BOSS_DEFEATED: emitido por update.js quando o boss é derrotado.
    {
      event:  'GAME_BOSS_DEFEATED',
      src:    ['/sfx/boss_defeated.ogg', '/sfx/boss_defeated.wav'],
      volume: 0.75,
    },
    // GAME_WAVE_CLEAR: já existe no sistema; reaproveitado para o jingle de vitória.
    {
      event:  'GAME_WAVE_CLEAR',
      src:    ['/sfx/wave_clear.ogg', '/sfx/wave_clear.wav'],
      volume: 0.65,
    },
    // SFX_GAME_OVER: disparado pelo AudioManager com delay ao receber FSM_GAME_OVER.
    {
      event:  'SFX_GAME_OVER',
      src:    ['/sfx/game_over.ogg', '/sfx/game_over.wav'],
      volume: 0.65,
    },
    // SFX_NORMAL_BUTTON: clique em qualquer botão do menu/diálogos.
    // Disparado via delegação global no AudioManager (data-sfx !== "none" e !== "cancel").
    {
      event:  'SFX_NORMAL_BUTTON',
      src:    ['/sfx/normal_button.ogg', '/sfx/normal_button.wav'],
      volume: 0.55,
    },
    // SFX_CANCEL_BUTTON: clique em botões de cancelamento de ação (data-sfx="cancel").
    {
      event:  'SFX_CANCEL_BUTTON',
      src:    ['/sfx/cancel_button.ogg', '/sfx/cancel_button.wav'],
      volume: 0.50,
    },
  ],
};
