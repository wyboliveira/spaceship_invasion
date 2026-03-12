import { describe, it, expect } from 'vitest';
import { createEnemies } from '../src/game/helpers.js';

describe('Game Helpers', () => {
    it('should create the correct number of enemies', () => {
        const cfg = { enemyRows: 2, enemyCols: 8, enemyHP: 1 };
        const enemies = createEnemies(cfg);
        expect(enemies.length).toBe(16);
    });

    it('should initialize enemies with correct HP', () => {
        const cfg = { enemyRows: 1, enemyCols: 1, enemyHP: 3 };
        const enemies = createEnemies(cfg);
        expect(enemies[0].hp).toBe(3);
        expect(enemies[0].maxHp).toBe(3);
    });
});
