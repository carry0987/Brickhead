import type { ComboPerkMilestone, WeaponId } from '@/types/game';

export const COMBO_MILESTONES: ComboPerkMilestone[] = [
    // Column 1 (3 .. 40)
    {
        combo: 3,
        weaponId: 'pistol',
        effectType: 'FAST_FIRE',
    },
    {
        combo: 5,
        weaponId: 'uzi',
        effectType: 'UNLOCK',
    },
    {
        combo: 8,
        weaponId: 'pistol',
        effectType: 'DOUBLE_DAMAGE',
    },
    {
        combo: 10,
        weaponId: 'shotgun',
        effectType: 'UNLOCK',
    },
    { combo: 13, weaponId: 'uzi', effectType: 'RAPID_FIRE' },
    {
        combo: 15,
        weaponId: 'barrel',
        effectType: 'UNLOCK',
    },
    {
        combo: 17,
        weaponId: 'uzi',
        effectType: 'DOUBLE_AMMO',
    },
    {
        combo: 18,
        weaponId: 'shotgun',
        effectType: 'FAST_FIRE',
    },
    {
        combo: 20,
        weaponId: 'grenade',
        effectType: 'UNLOCK',
    },
    {
        combo: 21,
        weaponId: 'shotgun',
        effectType: 'DOUBLE_AMMO',
    },
    { combo: 23, weaponId: 'uzi', effectType: 'LONG_SHOT' },
    {
        combo: 26,
        weaponId: 'barrel',
        effectType: 'DOUBLE_AMMO',
    },
    {
        combo: 30,
        weaponId: 'wall',
        effectType: 'UNLOCK',
    },
    {
        combo: 31,
        weaponId: 'shotgun',
        effectType: 'WIDE_SHOT',
    },
    {
        combo: 32,
        weaponId: 'barrel',
        effectType: 'BIG_BANG',
    },
    {
        combo: 33,
        weaponId: 'grenade',
        effectType: 'CLUSTER',
    },
    {
        combo: 35,
        weaponId: 'shotgun',
        effectType: 'LONG_SHOT',
    },
    {
        combo: 36,
        weaponId: 'barrel',
        effectType: 'QUAD_AMMO',
    },
    {
        combo: 37,
        weaponId: 'wall',
        effectType: 'DOUBLE_AMMO',
    },
    { combo: 39, weaponId: 'uzi', effectType: 'QUAD_AMMO' },
    {
        combo: 40,
        weaponId: 'mine',
        effectType: 'UNLOCK',
    },

    // Column 2 (41 .. 64)
    {
        combo: 41,
        weaponId: 'shotgun',
        effectType: 'QUAD_AMMO',
    },
    {
        combo: 42,
        weaponId: 'grenade',
        effectType: 'DOUBLE_AMMO',
    },
    {
        combo: 43,
        weaponId: 'shotgun',
        effectType: 'RAPID_FIRE',
    },
    {
        combo: 44,
        weaponId: 'barrel',
        effectType: 'BIGGER_BANG',
    },
    {
        combo: 45,
        weaponId: 'grenade',
        effectType: 'BIG_BANG',
    },
    {
        combo: 47,
        weaponId: 'mine',
        effectType: 'CLUSTER',
    },
    {
        combo: 48,
        weaponId: 'uzi',
        effectType: 'DOUBLE_DAMAGE',
    },
    {
        combo: 50,
        weaponId: 'rocket',
        effectType: 'UNLOCK',
    },
    {
        combo: 51,
        weaponId: 'shotgun',
        effectType: 'WIDER_SHOT',
    },
    {
        combo: 52,
        weaponId: 'grenade',
        effectType: 'QUAD_AMMO',
    },
    {
        combo: 53,
        weaponId: 'wall',
        effectType: 'QUAD_AMMO',
    },
    {
        combo: 54,
        weaponId: 'mine',
        effectType: 'DOUBLE_AMMO',
    },
    {
        combo: 55,
        weaponId: 'charge_pack',
        effectType: 'UNLOCK',
    },
    {
        combo: 56,
        weaponId: 'shotgun',
        effectType: 'DOUBLE_DAMAGE',
    },
    {
        combo: 57,
        weaponId: 'grenade',
        effectType: 'BIGGER_BANG',
    },
    {
        combo: 58,
        weaponId: 'mine',
        effectType: 'BIG_BANG',
    },
    {
        combo: 59,
        weaponId: 'rocket',
        effectType: 'FAST_FIRE',
    },
    {
        combo: 61,
        weaponId: 'uzi',
        effectType: 'INFINITE_RANGE',
    },
    {
        combo: 62,
        weaponId: 'mine',
        effectType: 'BIGGER_BANG',
    },
    {
        combo: 63,
        weaponId: 'charge_pack',
        effectType: 'CLUSTER',
    },
    {
        combo: 64,
        weaponId: 'mine',
        effectType: 'QUAD_AMMO',
    },

    // Column 3 (66 .. 125)
    {
        combo: 66,
        weaponId: 'rocket',
        effectType: 'DOUBLE_AMMO',
    },
    {
        combo: 68,
        weaponId: 'charge_pack',
        effectType: 'DOUBLE_AMMO',
    },
    {
        combo: 70,
        weaponId: 'railgun',
        effectType: 'UNLOCK',
    },
    {
        combo: 72,
        weaponId: 'rocket',
        effectType: 'BIG_BANG',
    },
    {
        combo: 74,
        weaponId: 'charge_pack',
        effectType: 'BIG_BANG',
    },
    {
        combo: 76,
        weaponId: 'charge_pack',
        effectType: 'QUAD_AMMO',
    },
    {
        combo: 78,
        weaponId: 'railgun',
        effectType: 'FAST_FIRE',
    },
    {
        combo: 80,
        weaponId: 'railgun',
        effectType: 'DOUBLE_AMMO',
    },
    {
        combo: 85,
        weaponId: 'rocket',
        effectType: 'QUAD_AMMO',
    },
    {
        combo: 90,
        weaponId: 'uzi',
        effectType: 'QUAD_DAMAGE',
    },
    {
        combo: 95,
        weaponId: 'charge_pack',
        effectType: 'BIGGER_BANG',
    },
    {
        combo: 100,
        weaponId: 'railgun',
        effectType: 'RAPID_FIRE',
    },
    {
        combo: 105,
        weaponId: 'rocket',
        effectType: 'BIGGER_BANG',
    },
    {
        combo: 110,
        weaponId: 'railgun',
        effectType: 'QUAD_AMMO',
    },
    {
        combo: 120,
        weaponId: 'rocket',
        effectType: 'RAPID_FIRE',
    },
    {
        combo: 125,
        weaponId: 'railgun',
        effectType: 'LONG_SHOT',
    },
];

const WEAPON_UNLOCK_COMBOS = COMBO_MILESTONES.reduce<Partial<Record<WeaponId, number>>>((acc, milestone) => {
    if (milestone.effectType === 'UNLOCK') {
        acc[milestone.weaponId] = milestone.combo;
    }
    return acc;
}, {});

export function getWeaponUnlockCombo(weaponId: WeaponId): number {
    return WEAPON_UNLOCK_COMBOS[weaponId] ?? 0;
}
