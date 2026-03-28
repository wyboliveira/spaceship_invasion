/**
 * tests/audio.test.js
 *
 * Cobre:
 *  1. audioConfig — integridade da estrutura de dados (schema)
 *  2. AudioManager — inicialização e criação de Howls
 *  3. AudioManager — controle de volume e mute
 *  4. AudioManager — reprodução de SFX e resiliência a erros
 *  5. AudioManager — playlist sequencial com wrap-around
 *  6. AudioManager — integração com EventBus / FSM
 *
 * Howler.js é mockado integralmente: nenhuma chamada de Web Audio API real.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { audioConfig } from '../src/audio/audioConfig.js';
import { Howler }      from 'howler';
import { AudioManager } from '../src/audio/AudioManager.js';
import { EventBus }    from '../src/core/EventBus.js';

// ── Mock Howler ────────────────────────────────────────────────────────────────
// Deve ser declarado ANTES de qualquer import que use 'howler'.
// Vitest eleva vi.mock() para o topo do arquivo automaticamente.

vi.mock('howler', () => {
  const createInst = (opts) => ({
    play:     vi.fn().mockReturnValue(1),
    stop:     vi.fn(),
    volume:   vi.fn().mockReturnValue(0),
    fade:     vi.fn(),
    playing:  vi.fn().mockReturnValue(false),
    _opts:    opts,
    /** Dispara o callback onend manualmente nos testes de playlist. */
    _fireEnd: () => opts?.onend?.(),
  });

  const Howl    = vi.fn().mockImplementation(createInst);
  const Howler  = { volume: vi.fn(), mute: vi.fn() };
  return { Howl, Howler };
});

// Inicializa o AudioManager uma única vez para toda a suite.
// Múltiplas chamadas a init() acumulariam listeners; uma é suficiente.
beforeAll(() => {
  AudioManager.init();
});

// Restaura todos os spies após cada teste sem precisar de beforeEach.
afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. audioConfig — estrutura e integridade
// ─────────────────────────────────────────────────────────────────────────────

describe('audioConfig — estrutura', () => {
  it('deve conter as seções "music" e "sfx"', () => {
    expect(audioConfig).toHaveProperty('music');
    expect(audioConfig).toHaveProperty('sfx');
    expect(Array.isArray(audioConfig.sfx)).toBe(true);
  });

  it('cada trilha de música deve ter volume (number) e fadeMs (number)', () => {
    for (const [id, cfg] of Object.entries(audioConfig.music)) {
      expect(cfg.volume, `"${id}" sem volume`).toBeTypeOf('number');
      expect(cfg.fadeMs, `"${id}" sem fadeMs`).toBeTypeOf('number');
    }
  });

  it('cada trilha deve ter "src" (faixa simples) ou "playlist" (sequencial)', () => {
    for (const [id, cfg] of Object.entries(audioConfig.music)) {
      const ok = (Array.isArray(cfg.src)) || (Array.isArray(cfg.playlist));
      expect(ok, `"${id}" sem src nem playlist válidos`).toBe(true);
    }
  });

  it('gameplay deve ser uma playlist com ao menos 2 faixas', () => {
    const gp = audioConfig.music.gameplay;
    expect(Array.isArray(gp.playlist)).toBe(true);
    expect(gp.playlist.length).toBeGreaterThanOrEqual(2);
    for (const track of gp.playlist) {
      expect(Array.isArray(track.src)).toBe(true);
      expect(track.src.length).toBeGreaterThan(0);
    }
  });

  it('todos os SFX devem ter event (string), src (array) e volume (0–1)', () => {
    for (const entry of audioConfig.sfx) {
      expect(entry.event).toBeTypeOf('string');
      expect(Array.isArray(entry.src)).toBe(true);
      expect(entry.src.length).toBeGreaterThan(0);
      expect(entry.volume).toBeGreaterThanOrEqual(0);
      expect(entry.volume).toBeLessThanOrEqual(1);
    }
  });

  it('não deve haver eventos SFX duplicados', () => {
    const events = audioConfig.sfx.map(e => e.event);
    expect(new Set(events).size).toBe(events.length);
  });

  it('volumes de música devem estar entre 0 e 1', () => {
    for (const [id, cfg] of Object.entries(audioConfig.music)) {
      expect(cfg.volume, `"${id}" volume fora do range`).toBeGreaterThanOrEqual(0);
      expect(cfg.volume, `"${id}" volume fora do range`).toBeLessThanOrEqual(1);
    }
  });

  it('caminhos de música devem começar com /music/', () => {
    for (const [id, cfg] of Object.entries(audioConfig.music)) {
      const srcs = cfg.playlist ? cfg.playlist.flatMap(t => t.src) : cfg.src;
      for (const path of srcs) {
        expect(path, `"${id}" → "${path}"`).toMatch(/^\/music\//);
      }
    }
  });

  it('caminhos de SFX devem começar com /sfx/', () => {
    for (const entry of audioConfig.sfx) {
      for (const path of entry.src) {
        expect(path, `"${entry.event}" → "${path}"`).toMatch(/^\/sfx\//);
      }
    }
  });

  it('SFX_GAME_OVER deve estar presente (disparado com delay pelo AudioManager)', () => {
    const events = audioConfig.sfx.map(e => e.event);
    expect(events).toContain('SFX_GAME_OVER');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. AudioManager — inicialização
// ─────────────────────────────────────────────────────────────────────────────

describe('AudioManager — inicialização', () => {
  it('deve criar Howl para cada faixa de música simples (menu, boss)', () => {
    expect(AudioManager._tracks['menu']).toBeDefined();
    expect(AudioManager._tracks['boss']).toBeDefined();
  });

  it('deve criar playlist para gameplay com o número correto de faixas', () => {
    const pl = AudioManager._playlists['gameplay'];
    expect(pl).toBeDefined();
    expect(pl.howls.length).toBe(audioConfig.music.gameplay.playlist.length);
    expect(pl.index).toBeGreaterThanOrEqual(0);
  });

  it('deve criar um Howl para cada SFX registrado em audioConfig', () => {
    for (const entry of audioConfig.sfx) {
      expect(
        AudioManager._sfx[entry.event],
        `SFX "${entry.event}" não foi criado`,
      ).toBeDefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. AudioManager — volume e mute
// ─────────────────────────────────────────────────────────────────────────────

describe('AudioManager — volume e mute', () => {
  it('setMusicMuted() deve alternar o estado e retornar o novo valor', () => {
    const before = AudioManager.isMusicMuted;
    const result = AudioManager.setMusicMuted();
    expect(result).toBe(!before);
    // Restaura estado para não contaminar outros testes
    AudioManager.setMusicMuted(before);
  });

  it('setMusicMuted(true) chamado duas vezes deve manter muted=true', () => {
    AudioManager.setMusicMuted(true);
    AudioManager.setMusicMuted(true);
    expect(AudioManager.isMusicMuted).toBe(true);
    AudioManager.setMusicMuted(false);
  });

  it('setVolume() deve chamar Howler.volume com valor clamped a [0, 1]', () => {
    AudioManager.setVolume(1.5);
    expect(Howler.volume).toHaveBeenCalledWith(1);

    AudioManager.setVolume(-0.5);
    expect(Howler.volume).toHaveBeenCalledWith(0);

    AudioManager.setVolume(0.6);
    expect(Howler.volume).toHaveBeenCalledWith(0.6);
  });

  it('setMuted() deve chamar Howler.mute com o valor correto', () => {
    AudioManager.setMuted(true);
    expect(Howler.mute).toHaveBeenCalledWith(true);

    AudioManager.setMuted(false);
    expect(Howler.mute).toHaveBeenCalledWith(false);
  });

  it('isMusicMuted deve refletir o estado atual', () => {
    AudioManager.setMusicMuted(true);
    expect(AudioManager.isMusicMuted).toBe(true);
    AudioManager.setMusicMuted(false);
    expect(AudioManager.isMusicMuted).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. AudioManager — SFX e resiliência
// ─────────────────────────────────────────────────────────────────────────────

describe('AudioManager — SFX', () => {
  it('playSfx() deve chamar howl.play() para um evento registrado', () => {
    const howl = AudioManager._sfx['SFX_PLAYER_SHOOT'];
    AudioManager.playSfx('SFX_PLAYER_SHOOT');
    expect(howl.play).toHaveBeenCalledOnce();
  });

  it('playSfx() não deve lançar exceção para evento desconhecido', () => {
    expect(() => AudioManager.playSfx('SFX_NAO_EXISTE')).not.toThrow();
  });

  it('playSfx() deve capturar exceção de howl.play() e emitir console.warn', () => {
    const howl = AudioManager._sfx['SFX_ENEMY_DIE'];
    howl.play.mockImplementationOnce(() => {
      throw new Error('AudioContext was suspended');
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => AudioManager.playSfx('SFX_ENEMY_DIE')).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('playMusic() com trackId inválido deve emitir console.warn sem lançar', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => AudioManager.playMusic('trilha_inexistente')).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('stopMusic() com nenhuma trilha ativa não deve lançar exceção', () => {
    const saved = AudioManager._currentTrackId;
    AudioManager._currentTrackId = null;
    expect(() => AudioManager.stopMusic()).not.toThrow();
    AudioManager._currentTrackId = saved;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. AudioManager — playlist sequencial
// ─────────────────────────────────────────────────────────────────────────────

describe('AudioManager — playlist sequencial', () => {
  it('_onPlaylistEnd() deve avançar o índice da playlist', () => {
    const pl = AudioManager._playlists['gameplay'];
    AudioManager._currentTrackId = 'gameplay';
    pl.index = 0;
    // Mocka _startPlaylistTrack para evitar chamar howl.play() real
    vi.spyOn(AudioManager, '_startPlaylistTrack').mockImplementation(() => {});
    AudioManager._onPlaylistEnd('gameplay');
    expect(pl.index).toBe(1);
  });

  it('_onPlaylistEnd() deve voltar ao índice 0 ao ultrapassar o fim (wrap-around)', () => {
    const pl = AudioManager._playlists['gameplay'];
    AudioManager._currentTrackId = 'gameplay';
    pl.index = pl.howls.length - 1;
    vi.spyOn(AudioManager, '_startPlaylistTrack').mockImplementation(() => {});
    AudioManager._onPlaylistEnd('gameplay');
    expect(pl.index).toBe(0);
  });

  it('_onPlaylistEnd() deve ser ignorado se outra trilha estiver ativa', () => {
    const pl = AudioManager._playlists['gameplay'];
    AudioManager._currentTrackId = 'menu'; // gameplay não está ativa
    const indexBefore = pl.index;
    const spy = vi.spyOn(AudioManager, '_startPlaylistTrack');
    AudioManager._onPlaylistEnd('gameplay');
    expect(spy).not.toHaveBeenCalled();
    expect(pl.index).toBe(indexBefore);
    // Restaura
    AudioManager._currentTrackId = null;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. AudioManager — integração com EventBus / FSM
// ─────────────────────────────────────────────────────────────────────────────

describe('AudioManager — EventBus (FSM)', () => {
  it('FSM_MENU deve acionar playMusic("menu")', () => {
    const spy = vi.spyOn(AudioManager, 'playMusic').mockImplementation(() => {});
    EventBus.emit('FSM_MENU');
    expect(spy).toHaveBeenCalledWith('menu');
  });

  it('FSM_PLAYING (from: PAUSED) deve chamar _unduck e NÃO reiniciar música', () => {
    const unduckSpy    = vi.spyOn(AudioManager, '_unduck').mockImplementation(() => {});
    const playMusicSpy = vi.spyOn(AudioManager, 'playMusic').mockImplementation(() => {});
    EventBus.emit('FSM_PLAYING', { from: 'PAUSED' });
    expect(unduckSpy).toHaveBeenCalled();
    expect(playMusicSpy).not.toHaveBeenCalled();
  });

  it('FSM_PLAYING (from: WAVE_END, gameplay ativo) não deve reiniciar a playlist', () => {
    AudioManager._currentTrackId = 'gameplay';
    const spy = vi.spyOn(AudioManager, 'playMusic').mockImplementation(() => {});
    EventBus.emit('FSM_PLAYING', { from: 'WAVE_END' });
    expect(spy).not.toHaveBeenCalled();
    AudioManager._currentTrackId = null;
  });

  it('FSM_PLAYING (from: MENU) deve iniciar playMusic("gameplay")', () => {
    AudioManager._currentTrackId = null;
    const spy = vi.spyOn(AudioManager, 'playMusic').mockImplementation(() => {});
    EventBus.emit('FSM_PLAYING', { from: 'MENU' });
    expect(spy).toHaveBeenCalledWith('gameplay');
  });

  it('FSM_PLAYING (from: GAME_OVER) deve reiniciar playMusic("gameplay")', () => {
    AudioManager._currentTrackId = null;
    const spy = vi.spyOn(AudioManager, 'playMusic').mockImplementation(() => {});
    EventBus.emit('FSM_PLAYING', { from: 'GAME_OVER' });
    expect(spy).toHaveBeenCalledWith('gameplay');
  });

  it('FSM_PAUSED deve acionar _duck()', () => {
    const spy = vi.spyOn(AudioManager, '_duck').mockImplementation(() => {});
    EventBus.emit('FSM_PAUSED');
    expect(spy).toHaveBeenCalled();
  });

  it('FSM_GAME_OVER deve acionar _duckForGameOver()', () => {
    const spy = vi.spyOn(AudioManager, '_duckForGameOver').mockImplementation(() => {});
    EventBus.emit('FSM_GAME_OVER');
    expect(spy).toHaveBeenCalled();
  });

  it('GAME_BOSS_SPAWN deve acionar playMusic("boss")', () => {
    const spy = vi.spyOn(AudioManager, 'playMusic').mockImplementation(() => {});
    EventBus.emit('GAME_BOSS_SPAWN');
    expect(spy).toHaveBeenCalledWith('boss');
  });

  it('FSM_WAVE_END com boss ativo deve parar a música', () => {
    AudioManager._currentTrackId = 'boss';
    const spy = vi.spyOn(AudioManager, 'stopMusic').mockImplementation(() => {});
    EventBus.emit('FSM_WAVE_END');
    expect(spy).toHaveBeenCalled();
    AudioManager._currentTrackId = null;
  });

  it('FSM_WAVE_END com gameplay ativo não deve parar a música', () => {
    AudioManager._currentTrackId = 'gameplay';
    const spy = vi.spyOn(AudioManager, 'stopMusic').mockImplementation(() => {});
    EventBus.emit('FSM_WAVE_END');
    expect(spy).not.toHaveBeenCalled();
    AudioManager._currentTrackId = null;
  });
});
