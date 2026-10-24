export const PLAYER_DEFAULTS = {
    radius: 15,
    massKg: 10,
    maxHp: 100,
    speed: 3.6,
    sandboxMaxCombo: 125,
} as const;

export const PLAYER_MOVEMENT_TUNING = {
    velocityRetention: 0.68,
    acceleration: 0.32,
    downedVelocityRetention: 0.78,
} as const;

export const PLAYER_REVIVE_TUNING = {
    coopDistance: 48,
    coopTicks: 70,
    deathmatchTicks: 90,
    deathmatchSafeSpawnDistance: 360,
    revivedHealth: 65,
} as const;

export const PICKUP_TUNING = {
    collisionRadius: 13.6,
    healthRestore: 25,
    ammoRestoreRatio: 0.45,
    mapSpawnIntervalMs: 12000,
    minimumMapBoxSeparation: 32,
} as const;
