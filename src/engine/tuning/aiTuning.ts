import type { AIPartnerStrength } from '@/types/game';

export const AI_STRENGTH_SPECS: Record<
    AIPartnerStrength,
    {
        senseRadius: number;
        maxAimSpreadRad: number;
    }
> = {
    LV1: {
        senseRadius: 155,
        maxAimSpreadRad: 0.22,
    },
    LV2: {
        senseRadius: 235,
        maxAimSpreadRad: 0.12,
    },
    LV3: {
        senseRadius: 315,
        maxAimSpreadRad: 0.045,
    },
    LV4: {
        senseRadius: 420,
        maxAimSpreadRad: 0,
    },
};

export const AI_TUNING = {
    maxTurnStepRad: 0.34,
    fireAlignToleranceRad: 0.35,
    closeDefenseRadius: 100,
    postShotRecoilHoldMs: 190,
    lowHealthRatio: 0.6,
    opportunisticShotChance: 0.35,
    devilSenseMultiplier: 2.2,
    devilMinimumSenseRadius: 900,
    follow: {
        movingThreshold: 170,
        idleThreshold: 210,
        lineOfSightStartDistance: 125,
        occludedStartDistance: 95,
    },
    weaponSelection: {
        pistolRangeSafetyRatio: 0.98,
        defaultRangeSafetyRatio: 0.94,
        baselineShotgunPelletGapRad: 0.06,
        longShotSweetSpotRatio: 0.52,
        defaultSweetSpotRatio: 0.66,
    },
} as const;
