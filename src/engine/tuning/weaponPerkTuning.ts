export const WEAPON_PERK_TUNING = {
    fastFire: {
        pistolCooldownMs: 140,
        defaultCooldownMultiplier: 0.45,
    },
    rapidFire: {
        cooldownMs: 65,
        rocketCooldownDivisor: 0.7,
    },
    bigBang: {
        damageMultiplier: 1.35,
        radiusMultiplier: 1.38,
    },
    biggerBang: {
        damageMultiplier: 1.75,
        radiusMultiplier: 1.75,
    },
    wideShot: {
        pelletMultiplier: 1.6,
        spreadMultiplier: 1.5,
    },
    widerShot: {
        pelletMultiplier: 2.4,
        spreadMultiplier: 2,
    },
    longRangeMultiplier: 1.68,
    infiniteRange: 1450,
    railgun: {
        baseRange: 480,
        longShotRange: 1450,
    },
    comboDurationMs: 3800,
} as const;
