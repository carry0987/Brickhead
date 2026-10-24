import type { EnemyKind } from '@/types/game';

export interface EnemySpec {
    radius: number;
    massKg: number;
    baseHp: number;
    baseSpeed: number;
    baseDamage: number;
    meleeKnockback: number;
    scoreValue: number;
    speedJitter: {
        min: number;
        max: number;
    };
    obstacleClearance: number;
    flowFieldClearancePad: number;
    death: {
        corpseDurationMs: number;
        bloodScale: number;
        gibCount: number;
        redBoxDropChance: number;
    };
    render: {
        attackDurationMs: number;
        hpBarWidth: number;
        hpBarTopOffset: number;
    };
    rangedAttack?: {
        cooldownMs: number;
        maxRange: number;
        projectileSpeed: number;
        knockback: number;
    };
}

export const ENEMY_SPECS: Readonly<Record<EnemyKind, EnemySpec>> = {
    zombie: {
        radius: 14,
        massKg: 8,
        baseHp: 65,
        baseSpeed: 0.32,
        baseDamage: 14,
        meleeKnockback: 30,
        scoreValue: 100,
        speedJitter: { min: 0.94, max: 1.06 },
        obstacleClearance: 6,
        flowFieldClearancePad: 8,
        death: {
            corpseDurationMs: 900,
            bloodScale: 1.15,
            gibCount: 5,
            redBoxDropChance: 0.22,
        },
        render: {
            attackDurationMs: 320,
            hpBarWidth: 26,
            hpBarTopOffset: 42,
        },
    },
    fast_zombie: {
        radius: 14,
        massKg: 8,
        baseHp: 42,
        baseSpeed: 0.64,
        baseDamage: 14,
        meleeKnockback: 30,
        scoreValue: 150,
        speedJitter: { min: 0.94, max: 1.06 },
        obstacleClearance: 6,
        flowFieldClearancePad: 8,
        death: {
            corpseDurationMs: 900,
            bloodScale: 1.15,
            gibCount: 5,
            redBoxDropChance: 0.22,
        },
        render: {
            attackDurationMs: 320,
            hpBarWidth: 26,
            hpBarTopOffset: 42,
        },
    },
    devil: {
        radius: 22,
        massKg: 15,
        baseHp: 750,
        baseSpeed: 0.52,
        baseDamage: 34,
        meleeKnockback: 50,
        scoreValue: 1500,
        speedJitter: { min: 1, max: 1 },
        obstacleClearance: 14,
        flowFieldClearancePad: 22,
        death: {
            corpseDurationMs: 900,
            bloodScale: 1.8,
            gibCount: 12,
            redBoxDropChance: 1,
        },
        render: {
            attackDurationMs: 380,
            hpBarWidth: 46,
            hpBarTopOffset: 62,
        },
        rangedAttack: {
            cooldownMs: 1250,
            maxRange: 580,
            projectileSpeed: 8.4,
            knockback: 50,
        },
    },
};

export const ENEMY_SCALING = {
    hpPerWave: 0.16,
    speedPerWave: 0.03,
    maxSpeedMultiplier: 1.4,
} as const;

export const ENEMY_COMBAT_TUNING = {
    meleeCooldownMs: 600,
    meleeInvulnerabilityMs: 400,
    objectAttackCooldownMs: 480,
} as const;

export const ENEMY_MOVEMENT_TUNING = {
    maxTurnStepRad: 0.24,
    velocityRetention: 0.72,
    acceleration: 0.28,
    wallSlideSpeedMultiplier: 0.65,
} as const;

export const ENEMY_DROP_TUNING = {
    minimumBoxSeparation: 32,
    zombieDropExclusionRadius: 200,
    roomBoundsPadding: 36,
} as const;
