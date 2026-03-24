import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus.js';
import { GameFSM } from '../src/core/GameFSM.js';

describe('EventBus', () => {
    it('should emit and receive events', () => {
        const spy = vi.fn();
        EventBus.on('TEST_EVENT', spy);
        EventBus.emit('TEST_EVENT', { data: 123 });
        expect(spy).toHaveBeenCalledWith({ data: 123 });
    });

    it('should handle multiple listeners', () => {
        const spy1 = vi.fn();
        const spy2 = vi.fn();
        EventBus.on('MULTI', spy1);
        EventBus.on('MULTI', spy2);
        EventBus.emit('MULTI', 'hello');
        expect(spy1).toHaveBeenCalledWith('hello');
        expect(spy2).toHaveBeenCalledWith('hello');
    });

    it('should remove listeners with off()', () => {
        const spy = vi.fn();
        EventBus.on('OFF_TEST', spy);
        EventBus.off('OFF_TEST', spy);
        EventBus.emit('OFF_TEST', 1);
        expect(spy).not.toHaveBeenCalled();
    });
});

describe('GameFSM', () => {
    it('should initialize in MENU state', () => {
        expect(GameFSM.state).toBe('MENU');
    });

    it('should allow valid transition MENU -> PLAYING', () => {
        GameFSM.transition('PLAYING');
        expect(GameFSM.state).toBe('PLAYING');
    });

    it('should allow PLAYING -> PAUSED -> PLAYING', () => {
        GameFSM.forceState('PLAYING');
        GameFSM.transition('PAUSED');
        expect(GameFSM.state).toBe('PAUSED');
        GameFSM.transition('PLAYING');
        expect(GameFSM.state).toBe('PLAYING');
    });

    it('should ignore invalid transition MENU -> PAUSED', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        GameFSM.forceState('MENU');
        GameFSM.transition('PAUSED');
        expect(GameFSM.state).toBe('MENU');
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    it('should emit FSM_ event on transition', () => {
        const spy = vi.fn();
        EventBus.on('FSM_GAME_OVER', spy);
        GameFSM.forceState('PLAYING');
        GameFSM.transition('SYNCING', { next: 'GAME_OVER' });
        GameFSM.transition('GAME_OVER');
        expect(spy).toHaveBeenCalled();
    });
});
