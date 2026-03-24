import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncQueue } from '../src/core/SyncQueue.js';
import { EventBus } from '../src/core/EventBus.js';

describe('SyncQueue', () => {
    beforeEach(() => {
        SyncQueue.reset();
        SyncQueue.newSession(); // Move de 0 (reset) para 1 (primeira sessão)
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    it('should enqueue and process a successful task', async () => {
        const taskFn = vi.fn().mockResolvedValue('ok');
        SyncQueue.enqueue('TestTask', taskFn);
        
        // Wait for processing
        await vi.runAllTimersAsync();
        
        expect(taskFn).toHaveBeenCalledTimes(1);
    });

    it('should retry a failed task up to 3 times then emit SYNC_FAILED', async () => {
        const taskFn = vi.fn().mockRejectedValue(new Error('Fail'));
        const spyError = vi.fn();
        EventBus.on('SYNC_FAILED', spyError);

        SyncQueue.enqueue('RetryTask', taskFn);

        // Attempt 1
        await vi.runAllTimersAsync(); 
        // Attempt 2 (Retry 1)
        await vi.advanceTimersByTimeAsync(1000); // 1s
        // Attempt 3 (Retry 2) - Should fail and EMIT here
        await vi.advanceTimersByTimeAsync(2000); // 2s

        expect(taskFn).toHaveBeenCalledTimes(3); 
        expect(spyError).toHaveBeenCalledWith(expect.objectContaining({ type: 'RetryTask' }));
    });

    it('should clear the queue on session change', async () => {
        const task1 = vi.fn().mockResolvedValue('ok');
        const task2 = vi.fn().mockResolvedValue('ok');
        
        let resolveBlocker;
        const blockerTask = vi.fn().mockReturnValue(new Promise(r => resolveBlocker = r));
        
        const session1 = SyncQueue.currentSessionId;
        SyncQueue.enqueue('Blocker', blockerTask, session1);
        SyncQueue.enqueue('Task1', task1, session1);
        
        SyncQueue.newSession();
        const session2 = SyncQueue.currentSessionId;
        SyncQueue.enqueue('Task2', task2, session2);

        // O Blocker está rodando. O Task1 está na fila (session1). O Task2 está na fila (session2).
        resolveBlocker();
        await vi.runAllTimersAsync();

        // Task1 deve ser descartado porque sua sessão (1) é inferior à atual (2)
        expect(task1).not.toHaveBeenCalled();
        expect(task2).toHaveBeenCalled();
    });

    it('should emit SYNC_DONE when queue is empty', async () => {
        const spyDone = vi.fn();
        EventBus.on('SYNC_DONE', spyDone);

        SyncQueue.enqueue('T1', () => Promise.resolve());
        await vi.runAllTimersAsync();

        expect(spyDone).toHaveBeenCalled();
    });
});
