import { COMBO_MILESTONES } from '@/data/comboMilestones';
import { WEAPON_MAP } from '@/data/weaponCatalog';
import type { CharacterId, PlayerEntity, WeaponId } from '@/types/game';
import { snapAngleTo8Dir } from '@/utils/battleGeometry';
import { PLAYER_DEFAULTS } from '../tuning/playerTuning';

interface CreatePlayerEntityOptions {
    id: 'P1' | 'P2';
    characterId: CharacterId;
    isAI: boolean;
    x: number;
    y: number;
    unlockAll: boolean;
    aiLabel: string;
    initialAngle?: number;
}

export function createPlayerEntity({
    id,
    characterId,
    isAI,
    x,
    y,
    unlockAll,
    aiLabel,
    initialAngle,
}: CreatePlayerEntityOptions): PlayerEntity {
    const nonAIUnlockAll = unlockAll && !isAI;
    const unlocked: Record<WeaponId, boolean> = {
        pistol: true,
        uzi: unlockAll,
        shotgun: unlockAll,
        barrel: nonAIUnlockAll,
        grenade: nonAIUnlockAll,
        wall: nonAIUnlockAll,
        mine: nonAIUnlockAll,
        rocket: nonAIUnlockAll,
        charge_pack: nonAIUnlockAll,
        railgun: nonAIUnlockAll,
    };
    const ammo: Record<WeaponId, number> = {
        pistol: -1,
        uzi: unlockAll ? WEAPON_MAP.uzi.baseMaxAmmo * 4 : WEAPON_MAP.uzi.baseMaxAmmo,
        shotgun: unlockAll ? WEAPON_MAP.shotgun.baseMaxAmmo * 4 : WEAPON_MAP.shotgun.baseMaxAmmo,
        barrel: unlockAll ? WEAPON_MAP.barrel.baseMaxAmmo * 4 : WEAPON_MAP.barrel.baseMaxAmmo,
        grenade: unlockAll ? WEAPON_MAP.grenade.baseMaxAmmo * 4 : WEAPON_MAP.grenade.baseMaxAmmo,
        wall: unlockAll ? WEAPON_MAP.wall.baseMaxAmmo * 4 : WEAPON_MAP.wall.baseMaxAmmo,
        mine: unlockAll ? WEAPON_MAP.mine.baseMaxAmmo * 4 : WEAPON_MAP.mine.baseMaxAmmo,
        rocket: unlockAll ? WEAPON_MAP.rocket.baseMaxAmmo * 4 : WEAPON_MAP.rocket.baseMaxAmmo,
        charge_pack: unlockAll ? WEAPON_MAP.charge_pack.baseMaxAmmo * 4 : WEAPON_MAP.charge_pack.baseMaxAmmo,
        railgun: unlockAll ? WEAPON_MAP.railgun.baseMaxAmmo * 4 : WEAPON_MAP.railgun.baseMaxAmmo,
    };
    const angle = initialAngle ?? (id === 'P1' ? 0 : Math.PI);
    const snapped = snapAngleTo8Dir(Math.cos(angle), Math.sin(angle));

    return {
        id,
        label: id === 'P1' ? 'P1' : isAI ? aiLabel : 'P2',
        isAI,
        characterId,
        x,
        y,
        vx: 0,
        vy: 0,
        radius: PLAYER_DEFAULTS.radius,
        dir8: snapped.dir8,
        angle: snapped.angle,
        hp: PLAYER_DEFAULTS.maxHp,
        maxHp: PLAYER_DEFAULTS.maxHp,
        speed: PLAYER_DEFAULTS.speed,
        currentWeapon: unlockAll ? 'shotgun' : 'pistol',
        ammo,
        maxAmmo: { ...ammo },
        unlocked,
        combo: 0,
        comboExpiresAt: 0,
        maxComboReached: unlockAll ? PLAYER_DEFAULTS.sandboxMaxCombo : 0,
        unlockedMilestones: unlockAll ? COMBO_MILESTONES.map((milestone) => milestone.combo) : [],
        lastShotTime: 0,
        muzzleFlashUntil: 0,
        invulnerableUntil: 0,
        walkCycle: 0,
        kills: 0,
        frags: 0,
        isDowned: false,
        reviveTimer: 0,
        massKg: PLAYER_DEFAULTS.massKg,
        hurtUntil: 0,
        downedAt: 0,
    };
}
