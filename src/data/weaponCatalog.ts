import type { WeaponId, WeaponSpec } from '@/types/game';

export const WEAPONS: WeaponSpec[] = [
    {
        id: 'pistol',
        keyBind: '1',
        slotNumber: 1,
        baseDamage: 30,
        baseFireRateMs: 240,
        baseMaxAmmo: -1,
        speed: 14,
        pellets: 1,
        spread: 0.015,
        baseRange: 440,
        knockback: 400, // 400 NT
        blastRadius: 0,
    },
    {
        id: 'uzi',
        keyBind: '2',
        slotNumber: 2,
        baseDamage: 15,
        baseFireRateMs: 115,
        baseMaxAmmo: 100,
        speed: 15,
        pellets: 1,
        spread: 0.04,
        baseRange: 310,
        longShotRange: 520,
        knockback: 70, // 70 NT
        blastRadius: 0,
    },
    {
        id: 'shotgun',
        keyBind: '3',
        slotNumber: 3,
        baseDamage: 28,
        baseFireRateMs: 480,
        baseMaxAmmo: 40,
        speed: 13.5,
        pellets: 5,
        spread: 0.24,
        baseRange: 250,
        longShotRange: 420,
        knockback: 80, // 80 NT
        blastRadius: 0,
    },
    {
        id: 'barrel',
        keyBind: '4',
        slotNumber: 4,
        baseDamage: 210,
        baseFireRateMs: 140,
        baseMaxAmmo: 10,
        speed: 0,
        pellets: 0,
        spread: 0,
        knockback: 50, // 50 NT
        blastRadius: 60,
    },
    {
        id: 'grenade',
        keyBind: '5',
        slotNumber: 5,
        baseDamage: 185,
        baseFireRateMs: 420,
        baseMaxAmmo: 10,
        speed: 8,
        pellets: 1,
        spread: 0.05,
        knockback: 50, // 50 NT
        blastRadius: 60,
    },
    {
        id: 'wall',
        keyBind: '6',
        slotNumber: 6,
        baseDamage: 0,
        baseFireRateMs: 110,
        baseMaxAmmo: 10,
        speed: 0,
        pellets: 0,
        spread: 0,
        knockback: 0,
        blastRadius: 0,
    },
    {
        id: 'mine',
        keyBind: '7',
        slotNumber: 7,
        baseDamage: 250,
        baseFireRateMs: 140,
        baseMaxAmmo: 10,
        speed: 0,
        pellets: 0,
        spread: 0,
        knockback: 50, // 50 NT
        blastRadius: 60,
    },
    {
        id: 'rocket',
        keyBind: '8',
        slotNumber: 8,
        baseDamage: 310,
        baseFireRateMs: 560,
        baseMaxAmmo: 10,
        speed: 11.5,
        pellets: 1,
        spread: 0.02,
        knockback: 50, // 50 NT
        blastRadius: 60,
    },
    {
        id: 'charge_pack',
        keyBind: '9',
        slotNumber: 9,
        baseDamage: 360,
        baseFireRateMs: 150,
        baseMaxAmmo: 10,
        speed: 0,
        pellets: 0,
        spread: 0,
        knockback: 50, // 50 NT
        blastRadius: 60,
    },
    {
        id: 'railgun',
        keyBind: '0',
        slotNumber: 0,
        baseDamage: 240,
        baseFireRateMs: 420,
        baseMaxAmmo: 20,
        speed: 35,
        pellets: 1,
        spread: 0,
        knockback: 100, // 100 NT
        blastRadius: 0,
    },
];

export const WEAPON_MAP: Record<WeaponId, WeaponSpec> = WEAPONS.reduce(
    (acc, w) => {
        acc[w.id] = w;
        return acc;
    },
    {} as Record<WeaponId, WeaponSpec>,
);

// Exact 58-Row Original Boxhead 2Play UPGRADE LIST (From 3x to 125x)
