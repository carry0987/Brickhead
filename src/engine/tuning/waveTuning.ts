export const WAVE_TUNING = {
    zombieCount: {
        base: 15,
        perWave: 8,
    },
    fastZombie: {
        minimumWave: 2,
        baseChance: 0.12,
        chancePerWave: 0.05,
        maximumChance: 0.45,
    },
    devil: {
        minimumWave: 2,
        waveDivisor: 2,
        baseCount: 1,
        maximumCount: 5,
    },
    spawning: {
        initialIntervalMs: 950,
        baseIntervalMs: 920,
        intervalReductionPerWaveMs: 55,
        minimumIntervalMs: 260,
        maximumActiveEnemies: 56,
        nextWaveDelayMs: 700,
    },
} as const;

export function getWaveSpawnIntervalMs(wave: number): number {
    return Math.max(
        WAVE_TUNING.spawning.minimumIntervalMs,
        WAVE_TUNING.spawning.baseIntervalMs - wave * WAVE_TUNING.spawning.intervalReductionPerWaveMs,
    );
}
