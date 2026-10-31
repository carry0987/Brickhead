export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY' | 'GAME_OVER';

export type GameMode = 'SOLO' | 'COOP_2P' | 'COOP_AI' | 'DEATHMATCH_2P';

export type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'NIGHTMARE';

export type GameSpeed = 'SLOW' | 'NORMAL' | 'FAST';

export type DeathmatchFragsGoal = 5 | 10 | 20 | 50;

export type BlastDamageMode = 'OFF' | 'TEN_PERCENT' | 'FULL';

export type AIPartnerStrength = 'LV1' | 'LV2' | 'LV3' | 'LV4';

export interface GameOptionsConfig {
    difficulty: Difficulty;
    objectCollision: boolean;
    devilsEnabled: boolean;
    friendlyFire: boolean;
    explosionPlayerDamage: BlastDamageMode;
    gameSpeed: GameSpeed;
    deathmatchFrags: DeathmatchFragsGoal;
    minimapEnabled: boolean;
    masterVolume: number; // 0..100 (Sound Effects only)
    aiPartnerStrength?: AIPartnerStrength;
    startingWave?: number; // 1..99 starting wave for non-Deathmatch modes
}

export interface PlayerControlsBinding {
    up: string;
    down: string;
    left: string;
    right: string;
    shoot: string;
    prevWeapon: string;
    nextWeapon: string;
}

export interface ControlsConfig {
    p1: PlayerControlsBinding;
    p2: PlayerControlsBinding;
}

export type CharacterId = 'bambo' | 'bind' | 'bert' | 'sakamoto';

export type BuiltInRoomId =
    | 'room_01'
    | 'room_02'
    | 'room_03'
    | 'room_04'
    | 'room_05'
    | 'room_06'
    | 'room_07'
    | 'room_08'
    | 'room_09'
    | 'room_10'
    | 'room_11'
    | 'room_12'
    | 'room_13'
    | 'room_14'
    | 'room_15'
    | 'room_16'
    | 'room_17'
    | 'room_18';

export type RoomId = BuiltInRoomId | (string & {});

export type WeaponId =
    | 'pistol'
    | 'uzi'
    | 'shotgun'
    | 'barrel'
    | 'grenade'
    | 'wall'
    | 'mine'
    | 'rocket'
    | 'charge_pack'
    | 'railgun';

export type EnemyKind = 'zombie' | 'fast_zombie' | 'devil';

export interface WeaponSpec {
    id: WeaponId;
    keyBind: string;
    slotNumber: number; // 1..9, 0
    baseDamage: number;
    baseFireRateMs: number;
    baseMaxAmmo: number; // -1 for infinite
    speed: number;
    pellets: number;
    spread: number;
    baseRange?: number;
    longShotRange?: number;
    knockback: number;
    blastRadius: number;
}

export type UpgradeEffectType =
    | 'UNLOCK'
    | 'FAST_FIRE'
    | 'RAPID_FIRE'
    | 'DOUBLE_DAMAGE'
    | 'QUAD_DAMAGE'
    | 'DOUBLE_AMMO'
    | 'QUAD_AMMO'
    | 'LONG_SHOT'
    | 'INFINITE_RANGE'
    | 'WIDE_SHOT'
    | 'WIDER_SHOT'
    | 'BIG_BANG'
    | 'BIGGER_BANG'
    | 'CLUSTER';

export interface ComboPerkMilestone {
    combo: number;
    weaponId: WeaponId;
    effectType: UpgradeEffectType;
}

export interface CharacterSpec {
    id: CharacterId;
    skinColor: string;
    hairColor: string;
    bandanaColor?: string;
    shirtColor: string;
    pantsColor: string;
    glasses?: boolean;
}

export type WallStyle =
    | 'classic_blue'
    | 'pyramid_pillar'
    | 'vertical_wall'
    | 'beveled_block'
    | 'tall_column'
    | 'strip_pillar'
    | 'tight_column'
    | 'concrete';

export interface WallBlock {
    x: number;
    y: number;
    w: number;
    h: number;
    style?: WallStyle;
}

export type SpawnNodeKind = '1' | '2' | 'P' | 'Z' | 'D' | 'W' | 'B';

export interface SpawnNode {
    kind: SpawnNodeKind;
    x: number;
    y: number;
    /** Direction angle in radians (used for '1' and '2' player spawn nodes) */
    angle?: number;
}

export interface RoomBounds {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface RoomSpec {
    id: RoomId;
    worldWidth: number;
    worldHeight: number;
    bounds: RoomBounds;
    floorColor: string;
    patchColor?: string;
    gridLineColor: string;
    wallTopColor: string;
    wallBevelColor?: string;
    wallSideColor: string;
    hasPerimeterWalls?: boolean;
    filePath?: string;
    isLoaded?: boolean;
    stainTransforms?: Array<[number, number, number, number, number, number]>;
    obstacles: WallBlock[];
    spawnNodes: SpawnNode[];
}

export interface PlayerEntity {
    id: 'P1' | 'P2';
    label: string;
    isAI: boolean;
    characterId: CharacterId;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    dir8: number; // 0..7 (E, SE, S, SW, W, NW, N, NE)
    angle: number;
    hp: number;
    maxHp: number;
    speed: number;
    currentWeapon: WeaponId;
    ammo: Record<WeaponId, number>;
    maxAmmo: Record<WeaponId, number>;
    unlocked: Record<WeaponId, boolean>;
    combo: number;
    comboExpiresAt: number;
    maxComboReached: number;
    unlockedMilestones: number[];
    lastShotTime: number;
    muzzleFlashUntil: number;
    invulnerableUntil: number;
    walkCycle: number;
    kills: number;
    frags: number; // For 2P Deathmatch
    isDowned: boolean;
    reviveTimer: number;
    massKg?: number;
    hurtUntil?: number;
    downedAt?: number;
}

export interface ShellCasing {
    id: string;
    x: number;
    y: number;
    angle: number;
    isShotgun: boolean;
    createdAt: number;
}

export interface EnemyEntity {
    id: string;
    kind: EnemyKind;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    angle: number;
    hp: number;
    maxHp: number;
    speed: number;
    damage: number;
    scoreValue: number;
    walkCycle: number;
    lastAttackTime: number;
    lastFireballTime: number;
    hitFlashUntil: number;
    shirtBloodSeed: number;
    massKg?: number;
    hurtUntil?: number;
}

export interface CorpseEntity {
    id: string;
    kind: EnemyKind;
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    angle: number;
    diedAt: number;
    durationMs: number;
}

export interface BulletEntity {
    id: string;
    ownerId: 'P1' | 'P2' | 'DEVIL';
    weaponId: WeaponId | 'devil_fireball';
    x: number;
    y: number;
    vx: number;
    vy: number;
    z: number;
    vz: number;
    radius: number;
    damage: number;
    knockback: number;
    blastRadius: number;
    cluster: boolean;
    isGrenade?: boolean;
    sourceEnemyId?: string;
    spawnTime: number;
    fuseMs?: number;
    sortY?: number;
}

export interface PlacedObject {
    id: string;
    kind: 'barrel' | 'wall' | 'mine' | 'charge_pack';
    ownerId: 'P1' | 'P2';
    x: number;
    y: number;
    w: number;
    h: number;
    radius: number;
    hp: number;
    maxHp: number;
    damage: number;
    blastRadius: number;
    cluster: boolean;
    createdAt: number;
    armed: boolean;
    triggeredAt?: number;
    passThroughPlayers?: ('P1' | 'P2')[];
}

export interface RedBoxPickup {
    id: string;
    x: number;
    y: number;
    createdAt: number;
    source?: 'MAP' | 'DROP';
}

export interface FloorDecal {
    id: string;
    kind: 'BLOOD' | 'SCORCH';
    x: number;
    y: number;
    radius: number;
    alpha: number;
    blobs: { dx: number; dy: number; r: number }[];
}

export interface ExplosionRing {
    id: string;
    x: number;
    y: number;
    z?: number;
    isMidAir?: boolean;
    maxRadius: number;
    createdAt: number;
    durationMs: number;
    sortY?: number;
    occludeBelowY?: number;
}

export type SvgEffectId =
    | 'explosion'
    | 'explosion_dome'
    | 'explosion_midair'
    | 'rocket_smoke'
    | 'fake_wall_smoke'
    | 'fake_wall_damage'
    | 'scorch_mark_ground'
    | 'scorch_mark_faint'
    | 'muzzle_pistol'
    | 'muzzle_uzi'
    | 'muzzle_shotgun'
    | 'muzzle_rocket'
    | 'muzzle_railgun'
    | 'throw_grenade'
    | 'place_object';

export interface ActiveSvgEffect {
    id: string;
    effectId: SvgEffectId;
    x: number;
    y: number;
    z?: number;
    angle: number;
    scale: number;
    radius?: number;
    createdAt: number;
    durationMs: number;
    ownerId?: 'P1' | 'P2' | 'DEVIL';
}

export interface RailBeam {
    id: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    color: string;
    createdAt: number;
    durationMs: number;
    width?: number;
    isBulletTrail?: boolean;
    sortY?: number;
    depthStartY?: number;
    depthEndY?: number;
}

export interface FloatingBanner {
    id: string;
    x: number;
    y: number;
    text: string;
    subText?: string;
    color: string;
    createdAt: number;
    durationMs: number;
    isGlobalBanner?: boolean;
}
