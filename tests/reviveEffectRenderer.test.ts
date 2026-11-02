import { describe, expect, test, vi } from 'vitest';
import { findRevivingAlly } from '../src/engine/player/reviveProximity';
import { enqueueReviveEffects } from '../src/engine/rendering/reviveEffectRenderer';
import type { WorldRenderItem } from '../src/engine/rendering/worldRenderQueue';
import { PLAYER_REVIVE_TUNING } from '../src/engine/tuning/playerTuning';
import type { GameMode, PlayerEntity } from '../src/types/game';

function player(id: 'P1' | 'P2', x: number, isDowned: boolean): PlayerEntity {
    return { id, x, y: 100, isDowned } as PlayerEntity;
}

function render(players: PlayerEntity[], mode: GameMode = 'COOP_2P', now = 100) {
    const ctx = {
        save: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const queue: WorldRenderItem[] = [];
    enqueueReviveEffects(ctx, players, mode, { left: 0, right: 500, top: 0, bottom: 500 }, queue, now);
    for (const item of queue) item.draw();
    return { ctx, queue };
}

describe('co-op revive effects', () => {
    test('shows an orange circle at the actual revive distance when the ally is outside', () => {
        const downed = player('P1', 100, true);
        const ally = player('P2', 100 + PLAYER_REVIVE_TUNING.coopDistance, false);
        const { ctx, queue } = render([downed, ally]);
        expect(findRevivingAlly(downed, [downed, ally])).toBeUndefined();
        expect(queue).toHaveLength(1);
        expect(ctx.arc).toHaveBeenCalledWith(100, 100, PLAYER_REVIVE_TUNING.coopDistance, 0, Math.PI * 2);
        expect(ctx.fillStyle).toBe('rgba(251, 146, 60, 0.18)');
        expect(ctx.moveTo).not.toHaveBeenCalled();
    });

    test.each(['COOP_2P', 'COOP_AI'] as const)('shows green and floating crosses while reviving in %s', (mode) => {
        const downed = player('P2', 100, true);
        const ally = player('P1', 100 + PLAYER_REVIVE_TUNING.coopDistance - 1, false);
        expect(findRevivingAlly(downed, [downed, ally])).toBe(ally);
        const first = render([downed, ally], mode, 100);
        const later = render([downed, ally], mode, 200);
        expect(first.queue).toHaveLength(2);
        expect(first.ctx.fillStyle).toBe('rgba(74, 222, 128, 0.18)');
        expect(first.ctx.moveTo).toHaveBeenCalledTimes(6);
        expect(vi.mocked(later.ctx.moveTo).mock.calls[0][1]).toBeLessThan(vi.mocked(first.ctx.moveTo).mock.calls[0][1]);
    });

    test('does not activate for a downed ally and disappears after revival', () => {
        const downed = player('P1', 100, true);
        const ally = player('P2', 120, true);
        expect(findRevivingAlly(downed, [downed, ally])).toBeUndefined();
        expect(render([downed, ally]).queue).toHaveLength(2);
        expect(render([player('P1', 100, false), player('P2', 120, false)]).queue).toHaveLength(0);
    });

    test.each(['SOLO', 'DEATHMATCH_2P'] as const)('does not show a rescue circle in %s', (mode) => {
        expect(render([player('P1', 100, true), player('P2', 120, false)], mode).queue).toHaveLength(0);
    });
});
