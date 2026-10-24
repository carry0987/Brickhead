import type {
    BulletEntity,
    ComboPerkMilestone,
    CorpseEntity,
    EnemyEntity,
    EnemyKind,
    ExplosionRing,
    FloatingBanner,
    PlacedObject,
    PlayerEntity,
    RailBeam,
    RedBoxPickup,
    ShellCasing,
} from '@/types/game';

export interface Particle3D {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    size: number;
    color: string;
    kind: 'BLOOD' | 'SHELL' | 'GIB';
    bounces: number;
}

export interface WallSmokePuff {
    id: string;
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    startRadius: number;
    endRadius: number;
    createdAt: number;
    durationMs: number;
    shade: string;
    sortY?: number;
    effectId?: 'rocket_smoke' | 'fake_wall_smoke';
}

export type TrackedEnemyEntity = EnemyEntity & {
    lastAttackerId?: 'P1' | 'P2';
    debugNavMode?: 'DIRECT_LOS' | 'FLOW_FIELD' | 'FALLBACK_NO_PATH';
    debugTargetX?: number;
    debugTargetY?: number;
    debugPathPoints?: Array<{ x: number; y: number }>;
    debugWallHit?: boolean;
    debugFlowDist?: number;
    debugDesiredAngle?: number;
};

export interface AIPlayerDebugTelemetry {
    goalLabel: string;
    goalX: number;
    goalY: number;
    moveAngle: number;
    pathPoints: Array<{ x: number; y: number }>;
    senseRadius: number;
}

export interface RoomBounds {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface LoadingAssetsInfo {
    soundsLoaded: number;
    soundsTotal: number;
    modelsLoaded: number;
    modelsTotal: number;
    effectsLoaded: number;
    effectsTotal: number;
    mapReady: boolean;
    stageLabel: string;
}

export interface HudState {
    wave: number;
    enemiesRemaining: number;
    score: number;
    combo: number;
    maxComboReached: number;
    earnedMaxCombo: number;
    survivalSeconds: number;
    bestComboRecord: number;
    bestSurvivalSecondsRecord: number;
    newRecordCombo: boolean;
    newRecordTime: boolean;
    comboRatio: number;
    latestMilestoneText: string;
    players: PlayerEntity[];
    sandboxAllUnlocked: boolean;
    debugPathfinding?: boolean;
    activeEnemiesCount?: number;
    deathmatchWinner: 'P1' | 'P2' | null;
}

export interface BattleEngineState {
    wave: number;
    spawnQueue: EnemyKind[];
    lastSpawnTime: number;
    spawnIntervalMs: number;
    nextWaveStartAt: number | null;
    score: number;
    combo: number;
    maxComboReached: number;
    earnedMaxCombo: number;
    survivalMs: number;
    lastTickTime: number;
    newRecordCombo: boolean;
    newRecordTime: boolean;
    comboExpiresAt: number;
    latestMilestoneText: string;
    formatMilestone: (milestone: ComboPerkMilestone, playerId: string) => { title: string; summary: string };
    sandboxAllUnlocked: boolean;
    debugPathfinding?: boolean;
    aiDebugTelemetry?: AIPlayerDebugTelemetry | null;
    aiLockedDevilId?: string | null;
    deathmatchWinner: 'P1' | 'P2' | null;
    gameOverPendingAt: number | null;
    waveBanner: { text: string; createdAt: number; durationMs: number } | null;
    players: PlayerEntity[];
    enemies: TrackedEnemyEntity[];
    corpses: CorpseEntity[];
    bullets: BulletEntity[];
    placedObjects: PlacedObject[];
    redBoxes: RedBoxPickup[];
    shellCasings: ShellCasing[];
    particles3D: Particle3D[];
    wallSmokePuffs: WallSmokePuff[];
    explosions: ExplosionRing[];
    beams: RailBeam[];
    banners: FloatingBanner[];
    keys: Set<string>;
    justPressedKeys: Set<string>;
    shotgunFiringPlayers: Set<'P1' | 'P2'>;
    mouse: { x: number; y: number; down: boolean };
    screenShake: number;
    lastRedBoxTime: number;
    camShared: { x: number; y: number };
    camP1: { x: number; y: number };
    camP2: { x: number; y: number };
    flowField: Int16Array;
    flowBlocked: Uint8Array;
    devilFlowField?: Int16Array;
    devilFlowBlocked?: Uint8Array;
    flowCols: number;
    flowRows: number;
    lastFlowUpdate: number;
}
