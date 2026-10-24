export const EXPLOSION_TUNING = {
    durationMs: 450,
    screenShake: {
        increase: 9,
        maximum: 18,
    },
    falloff: {
        minimumDamageRatio: 0.35,
        radiusPadding: 20,
    },
    playerDamage: {
        tenPercentModeScale: 0.1,
        normalScale: 0.35,
        devilDamage: 28,
    },
    cluster: {
        count: 4,
        angleJitterRad: 0.5,
        speed: 5.5,
        verticalSpeed: 4.2,
        damageMultiplier: 0.55,
        radius: 5,
        knockback: 50,
        blastRadius: 60,
        fuseMs: 420,
    },
} as const;
