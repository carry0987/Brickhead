import { COMBO_MILESTONES } from '@/data/comboMilestones';
import { CANVAS_WIDTH } from '@/data/gameCatalog';
import { WEAPON_MAP } from '@/data/weaponCatalog';
import type { PlayerEntity, RoomId, UpgradeEffectType, WeaponId } from '@/types/game';
import { addBannerToEngine } from '@/utils/floorDecalRenderer';
import { statsStorage, weaponStateStorage } from '@/utils/statsStorage';
import type { BattleEngineState, TrackedEnemyEntity } from '../battleTypes';
import { ENEMY_SPECS } from '../tuning/enemyTuning';
import { PLAYER_DEFAULTS } from '../tuning/playerTuning';
import { WEAPON_PERK_TUNING } from '../tuning/weaponPerkTuning';
import { calculateKnockbackVelocity } from './knockbackPhysics';

export function syncWeaponState(st: BattleEngineState): void {
    if (!st.sandboxAllUnlocked) {
        weaponStateStorage.savePlayersWeaponState(st.players, st.maxComboReached);
    }
}

export function hasComboPerk(
    st: BattleEngineState,
    player: PlayerEntity,
    weaponId: WeaponId,
    effectType: UpgradeEffectType,
): boolean {
    return COMBO_MILESTONES.some(
        (m) =>
            m.weaponId === weaponId &&
            m.effectType === effectType &&
            (st.sandboxAllUnlocked || player.maxComboReached >= m.combo || player.unlockedMilestones.includes(m.combo)),
    );
}

export function getFirearmBallistics(
    st: BattleEngineState,
    player: PlayerEntity,
    weaponId: WeaponId,
): {
    maxRange: number;
    pelletCount: number;
    spreadRad: number;
    hasLongShot: boolean;
} {
    const spec = WEAPON_MAP[weaponId] || WEAPON_MAP.pistol;

    if (weaponId === 'shotgun') {
        const basePellets = Math.max(1, spec.pellets);
        const baseSpread = Math.max(0.005, spec.spread);
        const baseRange = spec.baseRange ?? 250;
        const longRange = spec.longShotRange ?? Math.round(baseRange * WEAPON_PERK_TUNING.longRangeMultiplier);

        const widePerk = hasComboPerk(st, player, 'shotgun', 'WIDE_SHOT');
        const widerPerk = hasComboPerk(st, player, 'shotgun', 'WIDER_SHOT');
        const longShotPerk = hasComboPerk(st, player, 'shotgun', 'LONG_SHOT');
        const pelletCount = widerPerk
            ? Math.max(basePellets + 2, Math.round(basePellets * WEAPON_PERK_TUNING.widerShot.pelletMultiplier))
            : widePerk
              ? Math.max(basePellets + 1, Math.round(basePellets * WEAPON_PERK_TUNING.wideShot.pelletMultiplier))
              : basePellets;

        return {
            maxRange: longShotPerk ? longRange : baseRange,
            pelletCount,
            spreadRad: widerPerk
                ? baseSpread * WEAPON_PERK_TUNING.widerShot.spreadMultiplier
                : widePerk
                  ? baseSpread * WEAPON_PERK_TUNING.wideShot.spreadMultiplier
                  : baseSpread,
            hasLongShot: longShotPerk,
        };
    }

    if (weaponId === 'uzi') {
        const baseRange = spec.baseRange ?? 310;
        const longRange = spec.longShotRange ?? Math.round(baseRange * WEAPON_PERK_TUNING.longRangeMultiplier);
        const infinitePerk = hasComboPerk(st, player, 'uzi', 'INFINITE_RANGE');
        const longShotPerk = hasComboPerk(st, player, 'uzi', 'LONG_SHOT');
        return {
            maxRange: infinitePerk ? WEAPON_PERK_TUNING.infiniteRange : longShotPerk ? longRange : baseRange,
            pelletCount: Math.max(1, spec.pellets),
            spreadRad: spec.spread,
            hasLongShot: longShotPerk || infinitePerk,
        };
    }

    return {
        maxRange: spec.baseRange ?? 440,
        pelletCount: Math.max(1, spec.pellets),
        spreadRad: spec.spread,
        hasLongShot: false,
    };
}

export function applyMilestoneToPlayer(st: BattleEngineState, player: PlayerEntity, milestoneCombo: number): void {
    const milestone = COMBO_MILESTONES.find((m) => m.combo === milestoneCombo);
    if (!milestone) return;

    player.maxComboReached = Math.max(player.maxComboReached, milestone.combo);
    if (
        player.isAI &&
        milestone.weaponId !== 'pistol' &&
        milestone.weaponId !== 'uzi' &&
        milestone.weaponId !== 'shotgun'
    ) {
        return;
    }
    if (!player.unlockedMilestones.includes(milestone.combo)) {
        player.unlockedMilestones.push(milestone.combo);
    }
    player.unlocked[milestone.weaponId] = true;

    const weaponSpec = WEAPON_MAP[milestone.weaponId];
    if (weaponSpec.baseMaxAmmo !== -1) {
        if (milestone.effectType === 'QUAD_AMMO') {
            player.maxAmmo[milestone.weaponId] = weaponSpec.baseMaxAmmo * 4;
        } else if (milestone.effectType === 'DOUBLE_AMMO') {
            player.maxAmmo[milestone.weaponId] = Math.max(
                player.maxAmmo[milestone.weaponId],
                weaponSpec.baseMaxAmmo * 2,
            );
        }
        player.ammo[milestone.weaponId] = player.maxAmmo[milestone.weaponId];
    }

    const milestoneDisplay = st.formatMilestone(milestone, player.id);
    st.latestMilestoneText = milestoneDisplay.summary;
    addBannerToEngine(st, CANVAS_WIDTH / 2, 118, milestoneDisplay.title, player.id === 'P2' ? '#38bdf8' : '#fef08a');
}

export function incrementPlayerCombo(
    st: BattleEngineState,
    roomId: RoomId,
    killerPlayer: PlayerEntity | undefined,
    now: number,
): void {
    const targetPlayer = killerPlayer || st.players[0];
    st.combo += 1;
    st.comboExpiresAt = now + WEAPON_PERK_TUNING.comboDurationMs;

    if (targetPlayer) {
        targetPlayer.kills += 1;
        targetPlayer.combo += 1;
        targetPlayer.comboExpiresAt = now + WEAPON_PERK_TUNING.comboDurationMs;

        if (targetPlayer.combo > targetPlayer.maxComboReached) {
            targetPlayer.maxComboReached = targetPlayer.combo;
            applyMilestoneToPlayer(st, targetPlayer, targetPlayer.combo);
        }
        st.maxComboReached = Math.max(st.maxComboReached, targetPlayer.maxComboReached);
    }

    if (st.combo > st.earnedMaxCombo) {
        st.earnedMaxCombo = st.combo;
        const res = statsStorage.updateFromRun({
            roomId,
            maxCombo: st.earnedMaxCombo,
            survivalSeconds: Math.floor(st.survivalMs / 1000),
            wave: st.wave,
            score: st.score,
            killsDelta: 1,
        });
        if (res.isNewBestCombo) st.newRecordCombo = true;
        if (res.isNewBestTime) st.newRecordTime = true;
    } else {
        statsStorage.updateFromRun({
            roomId,
            maxCombo: st.earnedMaxCombo,
            survivalSeconds: Math.floor(st.survivalMs / 1000),
            wave: st.wave,
            score: st.score,
            killsDelta: 1,
        });
    }

    syncWeaponState(st);
}

export function applyKnockbackToEnemy(en: TrackedEnemyEntity, dirAngle: number, forceNT: number): void {
    const massKg = en.massKg ?? ENEMY_SPECS[en.kind].massKg;
    const { dvx, dvy } = calculateKnockbackVelocity(forceNT, massKg, dirAngle);
    en.vx += dvx;
    en.vy += dvy;
}

export function applyKnockbackToPlayer(pl: PlayerEntity, dirAngle: number, forceNT: number): void {
    const massKg = pl.massKg ?? PLAYER_DEFAULTS.massKg;
    const { dvx, dvy } = calculateKnockbackVelocity(forceNT, massKg, dirAngle);
    pl.vx += dvx;
    pl.vy += dvy;
}
