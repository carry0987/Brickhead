import type { WeaponId } from '@/types/game';

export type PlaceableKind = Extract<WeaponId, 'barrel' | 'wall' | 'mine' | 'charge_pack'>;

export interface PlaceableSpec {
    radius: number;
    width: number;
    height: number;
    maxHp: number;
    armDelayMs?: number;
    triggerDelayMs?: number;
}

export const PLACEABLE_SPECS = {
    barrel: {
        radius: 14,
        width: 26,
        height: 26,
        maxHp: 25,
    },
    wall: {
        radius: 16,
        width: 32,
        height: 32,
        maxHp: 280,
    },
    mine: {
        radius: 14,
        width: 26,
        height: 26,
        maxHp: 25,
        armDelayMs: 700,
        triggerDelayMs: 480,
    },
    charge_pack: {
        radius: 14,
        width: 26,
        height: 26,
        maxHp: 25,
    },
} as const satisfies Record<PlaceableKind, PlaceableSpec>;

export const PLACEABLE_GRID_TUNING = {
    cellSize: 32,
    overlapDistance: 16,
    playerClearance: 2,
} as const;
