/**
 * AudioManager.js — Singleton de áudio do jogo.
 *
 * Responsabilidades:
 *  - Criar e gerenciar todas as instâncias Howl (música + SFX)
 *  - Escutar o EventBus e reagir com a trilha ou efeito correto
 *  - Crossfade suave entre músicas de acordo com a FSM
 *  - Playlist sequencial para gameplay (N faixas → loop automático)
 *  - Reduzir (duck) volume no PAUSE e no GAME_OVER, restaurar ao retomar
 *  - Liga/desliga músicas independente dos SFX (botão ♫)
 *  - Feedback sonoro em cliques de botão via delegação global
 *  - Degradar graciosamente: arquivo ausente → console.warn, jogo continua
 *
 * Para trocar ou adicionar músicas de gameplay: edite apenas audioConfig.js
 * (campo `gameplay.playlist`). Nenhum outro arquivo precisa ser modificado.
 */

import { Howl, Howler } from 'howler';
import { EventBus }     from '../core/EventBus.js';
import { audioConfig }  from './audioConfig.js';

class AudioManagerClass {
  constructor() {
    /** @type {Object.<string, Howl>} trackId → Howl (faixas simples) */
    this._tracks     = {};
    /** @type {Object.<string, {howls: Howl[], index: number}>} playlists */
    this._playlists  = {};
    /** @type {Object.<string, Howl>} eventName → Howl de SFX */
    this._sfx        = {};

    /** @type {string|null} id da música/playlist em reprodução */
    this._currentTrackId = null;
    /** @type {boolean} true somente durante PAUSED */
    this._isDucked       = false;
    /** @type {boolean} músicas silenciadas pelo botão ♫ */
    this._musicMuted     = false;
    this._muted          = false;
    this._masterVolume   = 1.0;
    /** @type {boolean} true quando a música do boss foi interrompida ao fim da wave */
    this._comingFromBoss = false;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  init() {
    this._buildMusicHowls();
    this._buildSfxHowls();
    this._bindFsmListeners();
    this._bindSfxListeners();
    this._bindButtonSfx();
  }

  // ── Music API ──────────────────────────────────────────────────────────────

  /**
   * Inicia a faixa ou playlist indicada, com crossfade a partir da faixa atual.
   * Se a mesma faixa já está tocando, não faz nada.
   * @param {string} trackId — chave em audioConfig.music
   */
  playMusic(trackId) {
    const cfg = audioConfig.music[trackId];
    if (!cfg) {
      console.warn(`[AudioManager] trackId desconhecido: '${trackId}'`);
      return;
    }

    // Já tocando — não interrompe
    if (this._currentTrackId === trackId && this._currentHowl?.playing()) return;

    // Fade-out do áudio atual
    this._fadeOutCurrent(cfg.fadeMs);

    this._currentTrackId = trackId;
    this._isDucked = false;

    if (cfg.playlist) {
      // Playlist: reinicia do índice 0
      const pl = this._playlists[trackId];
      if (!pl) return;
      pl.index = 0;
      this._startPlaylistTrack(trackId);
    } else {
      const next = this._tracks[trackId];
      if (!next) return;
      this._playHowl(next, cfg);
    }
  }

  /**
   * Inicia playlist em uma faixa aleatória (evita repetir sempre a primeira).
   * Usado após combate com boss para variar a trilha de gameplay.
   * @param {string} trackId — chave em audioConfig.music (deve ter playlist)
   */
  playMusicRandom(trackId) {
    const cfg = audioConfig.music[trackId];
    if (!cfg?.playlist) return this.playMusic(trackId);

    const pl = this._playlists[trackId];
    if (!pl || pl.howls.length === 0) return;

    this._fadeOutCurrent(cfg.fadeMs);
    this._currentTrackId = trackId;
    this._isDucked       = false;
    pl.index = Math.floor(Math.random() * pl.howls.length);
    this._startPlaylistTrack(trackId);
  }

  /**
   * Para a música atual com fade-out.
   * @param {number} [fadeMs=500]
   */
  stopMusic(fadeMs = 500) {
    this._fadeOutCurrent(fadeMs);
    this._currentTrackId = null;
    this._isDucked = false;
  }

  // ── SFX API ────────────────────────────────────────────────────────────────

  playSfx(eventName) {
    const howl = this._sfx[eventName];
    if (!howl) return;
    try { howl.play(); } catch (e) {
      console.warn(`[AudioManager] playSfx falhou para '${eventName}':`, e);
    }
  }

  // ── Volume / Mute ──────────────────────────────────────────────────────────

  setVolume(vol) {
    this._masterVolume = Math.max(0, Math.min(1, vol));
    Howler.volume(this._masterVolume);
  }

  /** Mute global (músicas + SFX). */
  setMuted(force) {
    this._muted = force !== undefined ? force : !this._muted;
    Howler.mute(this._muted);
  }

  /**
   * Liga/desliga mute somente das músicas (SFX não são afetados).
   * @param {boolean} [force]
   * @returns {boolean} novo estado
   */
  setMusicMuted(force) {
    this._musicMuted = force !== undefined ? force : !this._musicMuted;

    const howl = this._currentHowl;
    const cfg  = audioConfig.music[this._currentTrackId];

    if (howl?.playing() && cfg) {
      if (this._musicMuted) {
        howl.fade(howl.volume(), 0, 200);
      } else {
        const base   = cfg.volume * this._masterVolume;
        const target = this._isDucked ? base * 0.15 : base;
        howl.fade(howl.volume(), target, 200);
      }
    }

    return this._musicMuted;
  }

  get isMuted()      { return this._muted; }
  get isMusicMuted() { return this._musicMuted; }

  // ── Private — getter de conveniência ──────────────────────────────────────

  /**
   * Retorna o Howl da faixa atualmente em reprodução,
   * seja uma faixa simples ou a faixa corrente de uma playlist.
   * @returns {Howl|null}
   */
  get _currentHowl() {
    const id = this._currentTrackId;
    if (!id) return null;
    const cfg = audioConfig.music[id];
    if (cfg?.playlist) {
      const pl = this._playlists[id];
      return pl?.howls[pl.index] ?? null;
    }
    return this._tracks[id] ?? null;
  }

  // ── Private — construção ───────────────────────────────────────────────────

  _buildMusicHowls() {
    for (const [id, cfg] of Object.entries(audioConfig.music)) {
      if (cfg.playlist) {
        // ── Playlist
        const howls = cfg.playlist.map((track, i) => {
          try {
            return new Howl({
              src:         track.src,
              loop:        false,
              volume:      0,
              preload:     true,
              onend:       () => this._onPlaylistEnd(id),
              onloaderror: (_, err) =>
                console.warn(`[AudioManager] Playlist '${id}[${i}]' não carregou:`, err),
            });
          } catch (e) {
            console.warn(`[AudioManager] Erro ao criar playlist '${id}[${i}]':`, e);
            return null;
          }
        }).filter(Boolean);

        this._playlists[id] = { howls, index: 0 };
      } else {
        // ── Faixa simples
        try {
          this._tracks[id] = new Howl({
            src:         cfg.src,
            loop:        cfg.loop,
            volume:      0,
            preload:     true,
            onloaderror: (_, err) =>
              console.warn(`[AudioManager] Música '${id}' não carregou:`, err),
          });
        } catch (e) {
          console.warn(`[AudioManager] Erro ao criar Howl para '${id}':`, e);
        }
      }
    }
  }

  _buildSfxHowls() {
    for (const entry of audioConfig.sfx) {
      try {
        this._sfx[entry.event] = new Howl({
          src:         entry.src,
          volume:      entry.volume,
          loop:        false,
          preload:     true,
          onloaderror: (_, err) =>
            console.warn(`[AudioManager] SFX '${entry.event}' não carregou:`, err),
        });
      } catch (e) {
        console.warn(`[AudioManager] Erro ao criar SFX '${entry.event}':`, e);
      }
    }
  }

  // ── Private — playlist ────────────────────────────────────────────────────

  /** Inicia a faixa no índice atual da playlist. */
  _startPlaylistTrack(playlistId) {
    const pl  = this._playlists[playlistId];
    const cfg = audioConfig.music[playlistId];
    if (!pl || !cfg) return;

    const howl = pl.howls[pl.index];
    if (!howl) return;

    this._playHowl(howl, cfg);
  }

  /** Callback: faixa da playlist terminou → avança e toca a próxima. */
  _onPlaylistEnd(playlistId) {
    if (this._currentTrackId !== playlistId) return; // foi interrompida por outra coisa

    const pl = this._playlists[playlistId];
    if (!pl) return;

    pl.index = (pl.index + 1) % pl.howls.length;
    this._startPlaylistTrack(playlistId);
  }

  // ── Private — helpers de reprodução ──────────────────────────────────────

  /**
   * Faz o fade-out da faixa/playlist atual e agenda o stop.
   * @param {number} fadeMs
   */
  _fadeOutCurrent(fadeMs) {
    const howl = this._currentHowl;
    if (!howl?.playing()) return;
    try {
      howl.fade(howl.volume(), 0, fadeMs);
      setTimeout(() => { try { howl.stop(); } catch (_) {} }, fadeMs + 50);
    } catch (_) {}
  }

  /**
   * Coloca um Howl para tocar com fade-in, respeitando o estado de mute.
   * @param {Howl} howl
   * @param {Object} cfg — entrada de audioConfig.music com `volume` e `fadeMs`
   */
  _playHowl(howl, cfg) {
    try {
      howl.stop();
      howl.volume(0);
      howl.play();
      if (!this._musicMuted) {
        howl.fade(0, cfg.volume * this._masterVolume, cfg.fadeMs);
      }
    } catch (e) {
      console.warn('[AudioManager] _playHowl falhou:', e);
    }
  }

  // ── Private — listeners FSM ───────────────────────────────────────────────

  _bindFsmListeners() {
    EventBus.on('FSM_MENU', () => this.playMusic('menu'));

    EventBus.on('FSM_PLAYING', ({ from }) => {
      this._isDucked = false;

      if (from === 'PAUSED') {
        this._unduck();
        return;
      }

      if (from === 'GAME_OVER') {
        // Para a faixa ducked e reinicia gameplay do início
        const curr = this._currentHowl;
        if (curr?.playing()) curr.stop();
        this._currentTrackId = null;
      }

      if (from === 'WAVE_END' && this._currentTrackId === 'gameplay') {
        // Wave normal: playlist já tocando → não interrompe
        return;
      }

      // Pós-boss: sorteia uma faixa aleatória para não repetir sempre a primeira
      if (from === 'WAVE_END' && this._comingFromBoss) {
        this._comingFromBoss = false;
        this.playMusicRandom('gameplay');
        return;
      }

      this.playMusic('gameplay');
    });

    EventBus.on('FSM_PAUSED',   () => this._duck());
    EventBus.on('FSM_WAVE_END', () => {
      if (this._currentTrackId === 'boss') {
        this._comingFromBoss = true;
        this.stopMusic(400);
      }
    });

    EventBus.on('FSM_GAME_OVER', () => {
      this._duckForGameOver();
      setTimeout(() => this.playSfx('SFX_GAME_OVER'), 400);
    });

    EventBus.on('GAME_BOSS_SPAWN', () => this.playMusic('boss'));
  }

  _bindSfxListeners() {
    for (const entry of audioConfig.sfx) {
      if (['SFX_GAME_OVER', 'SFX_NORMAL_BUTTON', 'SFX_CANCEL_BUTTON'].includes(entry.event)) {
        continue;
      }
      EventBus.on(entry.event, () => this.playSfx(entry.event));
    }
  }

  _bindButtonSfx() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      if (btn.dataset.sfx === 'none') return;
      if (btn.dataset.sfx === 'cancel') {
        this.playSfx('SFX_CANCEL_BUTTON');
      } else {
        this.playSfx('SFX_NORMAL_BUTTON');
      }
    }, true);
  }

  // ── Private — duck / unduck ────────────────────────────────────────────────

  _duck() {
    const howl = this._currentHowl;
    const cfg  = audioConfig.music[this._currentTrackId];
    if (!howl?.playing() || this._isDucked) return;
    this._isDucked = true;
    if (!this._musicMuted) {
      const target = (cfg?.volume ?? 0.5) * this._masterVolume * 0.15;
      try { howl.fade(howl.volume(), target, 300); } catch (_) {}
    }
  }

  _duckForGameOver() {
    const howl = this._currentHowl;
    const cfg  = audioConfig.music[this._currentTrackId];
    if (!howl?.playing()) return;
    if (!this._musicMuted) {
      const target = (cfg?.volume ?? 0.5) * this._masterVolume * 0.15;
      try { howl.fade(howl.volume(), target, 500); } catch (_) {}
    }
  }

  _unduck() {
    this._isDucked = false;
    const howl = this._currentHowl;
    const cfg  = audioConfig.music[this._currentTrackId];
    if (!howl?.playing() || !cfg) return;
    if (!this._musicMuted) {
      try { howl.fade(howl.volume(), cfg.volume * this._masterVolume, 300); } catch (_) {}
    }
  }
}

export const AudioManager = new AudioManagerClass();
