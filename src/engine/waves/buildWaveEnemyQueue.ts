import type { EnemyKind, GameMode } from '@/types/game';
import { WAVE_TUNING } from '../tuning/waveTuning';

interface WaveEnemyQueueOptions {
    gameMode: GameMode;
    wave: number;
    difficultyMultiplier: number;
    devilsEnabled: boolean;
    random?: () => number;
}

export function buildWaveEnemyQueue({
    gameMode,
    wave,
    difficultyMultiplier,
    devilsEnabled,
    random = Math.random,
}: WaveEnemyQueueOptions): EnemyKind[] {
    if (gameMode === 'DEATHMATCH_2P') return [];

    const enemies: EnemyKind[] = [];
    const zombieCount = Math.round(
        (WAVE_TUNING.zombieCount.base + wave * WAVE_TUNING.zombieCount.perWave) * difficultyMultiplier,
    );
    for (let i = 0; i < zombieCount; i++) {
        const fastZombieChance = Math.min(
            WAVE_TUNING.fastZombie.maximumChance,
            WAVE_TUNING.fastZombie.baseChance + wave * WAVE_TUNING.fastZombie.chancePerWave,
        );
        if (wave >= WAVE_TUNING.fastZombie.minimumWave && random() < fastZombieChance) {
            enemies.push('fast_zombie');
        } else {
            enemies.push('zombie');
        }
    }

    if (devilsEnabled) {
        const devilCount =
            wave >= WAVE_TUNING.devil.minimumWave
                ? Math.min(
                      WAVE_TUNING.devil.maximumCount,
                      Math.floor(wave / WAVE_TUNING.devil.waveDivisor) + WAVE_TUNING.devil.baseCount,
                  )
                : 0;
        for (let i = 0; i < devilCount; i++) {
            enemies.push('devil');
        }
    }

    return enemies;
}
