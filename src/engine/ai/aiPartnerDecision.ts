import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/data/gameCatalog';
import { WEAPON_MAP } from '@/data/weaponCatalog';
import type { AIPartnerStrength, EnemyKind, PlayerEntity, RoomSpec, WeaponId } from '@/types/game';
import { clamp, dist, hasClearLineOfSight, segmentIntersectsRect } from '@/utils/battleGeometry';
import { getPlayerWeaponMuzzleWorldPos } from '@/utils/svgEffectRenderer';
import type { BattleEngineState, TrackedEnemyEntity } from '../battleTypes';
import { computeKnockbackImpulse } from '../combat/knockbackPhysics';
import { getFirearmBallistics } from '../combat/weaponProgression';
import { computeGridPathAngleToGoal } from '../pathfinding/flowFieldPathfinding';
import { AI_STRENGTH_SPECS, AI_TUNING } from '../tuning/aiTuning';
import { ENEMY_SPECS } from '../tuning/enemyTuning';
import { normalizeAngleRad, snapAngleTo8DirStable, stepAngleTowards } from './angleSteering';

function computeExactMuzzleAimAngle(
    px: number,
    py: number,
    targetX: number,
    targetY: number,
    weaponId: WeaponId,
): number {
    let ang = Math.atan2(targetY - py, targetX - px);
    for (let iter = 0; iter < 2; iter++) {
        const muzzle = getPlayerWeaponMuzzleWorldPos(px, py, ang, weaponId);
        if (Math.hypot(targetX - muzzle.x, targetY - muzzle.y) > 8) {
            ang = Math.atan2(targetY - muzzle.y, targetX - muzzle.x);
        }
    }
    return ang;
}

/**
 * Returns the effective hitscan reach for an AI partner's firearm (`pistol` | `uzi` | `shotgun`),
 * dynamically derived from `getFirearmBallistics(st, p, weaponId)` with a 6% safety margin
 * (`maxRange * 0.94`) so pellets/bullets never vanish short of the target.
 */
function getWeaponEffectiveRangeForAI(st: BattleEngineState, p: PlayerEntity, weaponId: WeaponId): number {
    const { maxRange } = getFirearmBallistics(st, p, weaponId);
    if (weaponId === 'pistol') {
        return Math.round(maxRange * AI_TUNING.weaponSelection.pistolRangeSafetyRatio);
    }
    return Math.round(maxRange * AI_TUNING.weaponSelection.defaultRangeSafetyRatio);
}

/**
 * Selects the optimal firearm (`shotgun` | `uzi` | `pistol`) for the AI partner
 * dynamically based on target distance and live `getFirearmBallistics` parameters:
 * - Automatically reads Shotgun `{ maxRange, pelletCount, spreadRad, hasLongShot }`.
 * - Computes angular gap between adjacent pellets: `deltaTheta = spreadRad / (pelletCount - 1)`
 *   (baseline `0.24 / 4 = 0.06 rad` at 5 pellets & 0.24 spread).
 * - Scales the Shotgun sweet-spot distance by both `maxRange` and `densityFactor = sqrt(0.06 / deltaTheta)`:
 *   tighter spread or more pellets -> engages from further away; wider spread or fewer pellets -> waits closer.
 */
function selectBestAIWeapon(st: BattleEngineState, p: PlayerEntity, targetDist: number): WeaponId {
    const hasShotgun = st.sandboxAllUnlocked || (p.unlocked.shotgun && p.ammo.shotgun > 0);
    const hasUzi = st.sandboxAllUnlocked || (p.unlocked.uzi && p.ammo.uzi > 0);

    const sg = getFirearmBallistics(st, p, 'shotgun');
    const shotgunEffectiveRange = getWeaponEffectiveRangeForAI(st, p, 'shotgun');

    // Baseline angular spacing between adjacent pellets is 0.24 / (5 - 1) = 0.06 rad
    const pelletGapRad =
        sg.pelletCount > 1 ? sg.spreadRad / Math.max(1, sg.pelletCount - 1) : Math.max(0.008, sg.spreadRad);
    const densityFactor = clamp(
        Math.sqrt(AI_TUNING.weaponSelection.baselineShotgunPelletGapRad / Math.max(0.008, pelletGapRad)),
        0.55,
        1.35,
    );

    const baseSweetSpotRatio = sg.hasLongShot
        ? AI_TUNING.weaponSelection.longShotSweetSpotRatio
        : AI_TUNING.weaponSelection.defaultSweetSpotRatio;
    const shotgunPrimarySweetSpot = clamp(
        Math.round(sg.maxRange * baseSweetSpotRatio * densityFactor),
        75,
        Math.round(shotgunEffectiveRange * 0.92),
    );
    const shotgunFallbackMaxDist = clamp(
        Math.round(shotgunEffectiveRange * 0.95 * Math.min(1.05, densityFactor)),
        shotgunPrimarySweetSpot,
        shotgunEffectiveRange,
    );
    const uziEffectiveRange = getWeaponEffectiveRangeForAI(st, p, 'uzi');

    if (hasShotgun && targetDist <= shotgunPrimarySweetSpot) {
        return 'shotgun';
    }
    if (hasUzi && targetDist <= uziEffectiveRange) {
        return 'uzi';
    }
    if (hasShotgun && targetDist <= shotgunFallbackMaxDist) {
        return 'shotgun';
    }
    return 'pistol';
}
function hasClearBallisticShotForAI(
    st: BattleEngineState,
    room: RoomSpec,
    p: PlayerEntity,
    en: TrackedEnemyEntity,
    weaponId: WeaponId,
    overrideAngle?: number,
): boolean {
    if (!hasClearLineOfSight(p.x, p.y, en.x, en.y, room.obstacles, st.placedObjects)) {
        return false;
    }

    const testAngle =
        overrideAngle !== undefined ? overrideAngle : computeExactMuzzleAimAngle(p.x, p.y, en.x, en.y, weaponId);
    const muzzle = getPlayerWeaponMuzzleWorldPos(p.x, p.y, testAngle, weaponId);

    // Ensure the gun muzzle itself isn't poked inside/across a wall corner from the player's body
    for (let i = 0; i < room.obstacles.length; i++) {
        const obs = room.obstacles[i];
        if (
            segmentIntersectsRect(p.x, p.y, muzzle.x, muzzle.y, obs.x - 3, obs.y - 3, obs.w + 6, obs.h + 6) ||
            segmentIntersectsRect(muzzle.x, muzzle.y, en.x, en.y, obs.x - 5, obs.y - 5, obs.w + 10, obs.h + 10)
        ) {
            return false;
        }
    }

    // Check placed fake walls and barrels along both body-to-enemy and muzzle-to-enemy rays
    for (let i = 0; i < st.placedObjects.length; i++) {
        const obj = st.placedObjects[i];
        if (obj.hp <= 0) continue;

        if (obj.kind === 'wall') {
            const pad = obj.radius + 3;
            if (segmentIntersectsRect(muzzle.x, muzzle.y, en.x, en.y, obj.x - pad, obj.y - pad, pad * 2, pad * 2)) {
                return false;
            }
        } else if (obj.kind === 'barrel') {
            const pad = obj.radius + 5;
            const hitsBarrelFromMuzzle = segmentIntersectsRect(
                muzzle.x,
                muzzle.y,
                en.x,
                en.y,
                obj.x - pad,
                obj.y - pad,
                pad * 2,
                pad * 2,
            );
            const hitsBarrelFromCenter = segmentIntersectsRect(
                p.x,
                p.y,
                en.x,
                en.y,
                obj.x - pad,
                obj.y - pad,
                pad * 2,
                pad * 2,
            );

            if (hitsBarrelFromMuzzle || hitsBarrelFromCenter) {
                // Scheme C: Only shoot through/at a barrel if all alive players are safely outside its blast radius
                // AND the target zombie is close enough to be caught in the barrel explosion!
                const safeMargin = obj.blastRadius + 24;
                const safeForPlayers = st.players.every(
                    (pl) => pl.isDowned || dist(pl.x, pl.y, obj.x, obj.y) > safeMargin + pl.radius,
                );
                const enemyInBlast = dist(en.x, en.y, obj.x, obj.y) <= obj.blastRadius + en.radius;
                if (!safeForPlayers || !enemyInBlast) {
                    return false;
                }
            }
        }
    }

    return true;
}

function hasClearNavigationLine(
    p: PlayerEntity,
    targetX: number,
    targetY: number,
    room: RoomSpec,
    st: BattleEngineState,
): boolean {
    if (!hasClearLineOfSight(p.x, p.y, targetX, targetY, room.obstacles, st.placedObjects)) {
        return false;
    }

    for (let i = 0; i < st.placedObjects.length; i++) {
        const obj = st.placedObjects[i];
        if (obj.kind !== 'barrel' || obj.hp <= 0) continue;

        const pad = obj.radius + p.radius;
        if (segmentIntersectsRect(p.x, p.y, targetX, targetY, obj.x - pad, obj.y - pad, pad * 2, pad * 2)) {
            return false;
        }
    }

    return true;
}

/**
 * Dynamically computes the target-lock hysteresis distance buffer (in pixels) from the
 * active weapon's physical knockback force (`forceNT`), pellet count, and target mass (`massKg`).
 * Future weapons added to `WEAPON_MAP` automatically scale their lock-retention buffer.
 */
function computeWeaponKnockbackHysteresisBuffer(
    st: BattleEngineState,
    p: PlayerEntity,
    weaponId: WeaponId,
    targetKind: EnemyKind = 'devil',
): number {
    const spec = WEAPON_MAP[weaponId];
    const forceNT = spec?.knockback ?? 50;
    const ballistics = getFirearmBallistics(st, p, weaponId);
    const targetMassKg = ENEMY_SPECS[targetKind].massKg;

    // Single-shot velocity impulse = (F / m) * 0.75, scaled by effective pellets hitting the boss
    const effectivePellets = Math.min(Math.max(1, ballistics.pelletCount), 6);
    const singleShotImpulse = computeKnockbackImpulse(forceNT, targetMassKg) * effectivePellets;

    // Enemy velocity decays by 0.85 per frame -> geometric displacement sum = v0 / (1 - 0.85)
    // Multiply by 2.4 to cover rapid-fire burst stacking + AI kiting movement during recoil
    const estimatedKnockbackSlidePx = (singleShotImpulse / (1 - 0.85)) * 2.4;
    return Math.max(60, Math.round(estimatedKnockbackSlidePx + 45));
}

export function computeAIPlayerDecision(
    st: BattleEngineState,
    room: RoomSpec,
    p: PlayerEntity,
    aiStrength: AIPartnerStrength = 'LV3',
    now: number = performance.now(),
    activeCameraZoom: number = 1,
): { mx: number; my: number; isShooting: boolean; isShootJustPressed: boolean } {
    let mx = 0;
    let my = 0;
    let isShooting = false;
    let isShootJustPressed = false;
    const p1 = st.players[0];

    const strengthSpec = AI_STRENGTH_SPECS[aiStrength] || AI_STRENGTH_SPECS.LV3;
    const senseRadius = strengthSpec.senseRadius;
    const maxAimSpreadRad = strengthSpec.maxAimSpreadRad;

    // Maximum angular turn step per frame (~19 deg/frame) so the AI partner visibly turns
    // before firing and never shoots from behind its back during a 180-degree snap turn.
    const inPostShotRecoilHold = now - p.lastShotTime < AI_TUNING.postShotRecoilHoldMs;

    // Active Camera Viewport Box (matches the orange viewport rectangle on the minimap)
    const worldViewW = CANVAS_WIDTH / Math.max(0.25, activeCameraZoom);
    const worldViewH = CANVAS_HEIGHT / Math.max(0.25, activeCameraZoom);
    const camLeft = st.camShared.x;
    const camRight = st.camShared.x + worldViewW;
    const camTop = st.camShared.y;
    const camBottom = st.camShared.y + worldViewH;

    // Safe walkable interior inside the current camera viewport so the AI never walks into the screen edge
    const viewWalkMinX = camLeft + 34;
    const viewWalkMaxX = camRight - 34;
    const viewWalkMinY = camTop + 42;
    const viewWalkMaxY = camBottom - 30;

    const isInsideCameraViewport = (wx: number, wy: number, pad: number = 0): boolean =>
        wx >= camLeft - pad && wx <= camRight + pad && wy >= camTop - pad && wy <= camBottom + pad;

    const isAtViewportEdgeInDir = (dirX: number, dirY: number): boolean =>
        (dirX < -0.15 && p.x <= viewWalkMinX + 4) ||
        (dirX > 0.15 && p.x >= viewWalkMaxX - 4) ||
        (dirY < -0.15 && p.y <= viewWalkMinY + 4) ||
        (dirY > 0.15 && p.y >= viewWalkMaxY - 4);

    const isLV4 = aiStrength === 'LV4';
    const prioritizeDevil = aiStrength === 'LV3' || isLV4;
    // LV4 actively hunts Devil bosses within the active camera viewport instead of waiting passively
    const devilSenseRadius = isLV4
        ? Math.max(senseRadius * AI_TUNING.devilSenseMultiplier, AI_TUNING.devilMinimumSenseRadius)
        : senseRadius;
    // Dynamically compute lock-retention hysteresis buffer from the current weapon's knockback force
    const dynamicKnockbackBuffer = computeWeaponKnockbackHysteresisBuffer(st, p, p.currentWeapon, 'devil');
    const devilLockRetainRadius = devilSenseRadius + dynamicKnockbackBuffer;

    let visibleNearest: TrackedEnemyEntity | null = null;
    let bestVisibleD = Infinity;
    let anyNearest: TrackedEnemyEntity | null = null;
    let bestAnyD = Infinity;

    let losNearestDevil: TrackedEnemyEntity | null = null;
    let bestLosDevilD = Infinity;
    let anyNearestDevil: TrackedEnemyEntity | null = null;
    let bestAnyDevilD = Infinity;

    // Detect regular enemies within `senseRadius`, and for LV3/LV4 detect Devils with dynamic knockback hysteresis
    st.enemies.forEach((en) => {
        const d = dist(p.x, p.y, en.x, en.y);
        const isDevil = en.kind === 'devil';
        const isLockedDevil = isDevil && st.aiLockedDevilId === en.id;
        const candidateWeapon = selectBestAIWeapon(st, p, d);
        const candidateBuffer = isDevil
            ? Math.max(dynamicKnockbackBuffer, computeWeaponKnockbackHysteresisBuffer(st, p, candidateWeapon, 'devil'))
            : 0;
        const maxDetectD = isDevil
            ? isLockedDevil
                ? devilSenseRadius + candidateBuffer
                : devilSenseRadius
            : senseRadius;
        if (d > maxDetectD) return;

        // Only pursue Devils that are inside (or within weapon reach of) the current camera viewport box
        const devilReachableFromViewport =
            !isDevil ||
            isInsideCameraViewport(en.x, en.y, 24) ||
            d <= getWeaponEffectiveRangeForAI(st, p, candidateWeapon) + en.radius;
        if (isDevil && !devilReachableFromViewport) return;

        if (!isDevil && d <= senseRadius && d < bestAnyD) {
            bestAnyD = d;
            anyNearest = en;
        }
        if (isDevil && d < bestAnyDevilD) {
            bestAnyDevilD = d;
            anyNearestDevil = en;
        }

        if (isDevil) {
            // For Devils, use center-to-center LOS (or ballistic LOS) so right-hand muzzle corner grazing
            // never causes the AI to drop its Devil lock for 1 frame and spin toward a regular zombie!
            if (
                hasClearLineOfSight(p.x, p.y, en.x, en.y, room.obstacles, st.placedObjects) ||
                hasClearBallisticShotForAI(st, room, p, en, candidateWeapon)
            ) {
                if (d < bestLosDevilD || isLockedDevil) {
                    bestLosDevilD = d;
                    losNearestDevil = en;
                }
            }
        } else if (
            d <= senseRadius &&
            d < bestVisibleD &&
            hasClearBallisticShotForAI(st, room, p, en, candidateWeapon)
        ) {
            bestVisibleD = d;
            visibleNearest = en;
        }
    });

    // LV3+ AI Partner Boss Priority:
    // Once a Devil is sensed, strictly lock onto the Devil unless a regular zombie is within 100px self-defense range while the Devil is obstructed!
    if (prioritizeDevil) {
        if (losNearestDevil) {
            st.aiLockedDevilId = (losNearestDevil as TrackedEnemyEntity).id;
            visibleNearest = losNearestDevil;
            bestVisibleD = bestLosDevilD;
            anyNearest = losNearestDevil;
            bestAnyD = bestLosDevilD;
        } else if (anyNearestDevil) {
            st.aiLockedDevilId = (anyNearestDevil as TrackedEnemyEntity).id;
            anyNearest = anyNearestDevil;
            bestAnyD = bestAnyDevilD;
            // If the Devil is behind a wall, do NOT spin back and forth to shoot distant zombies;
            // only allow self-defense fire if a regular zombie is within 100px close-quarters range!
            if (bestVisibleD > AI_TUNING.closeDefenseRadius) {
                visibleNearest = null;
                bestVisibleD = Infinity;
            }
        } else {
            st.aiLockedDevilId = null;
        }
    } else {
        st.aiLockedDevilId = null;
    }

    const isCurrentlyMoving = Math.hypot(p.vx, p.vy) > 0.45;
    const aimErrorOffset =
        maxAimSpreadRad > 0
            ? Math.sin(now * 0.0046 + p.walkCycle * 0.35) * (maxAimSpreadRad * 0.72) +
              Math.cos(now * 0.0029) * (maxAimSpreadRad * 0.28)
            : 0;

    // If AI partner HP is below 60%, check for any Red Box supply crate within `senseRadius`
    // (scaling with AI Strength: 155px / 235px / 315px / 420px, matching zombie detection distance)
    // around the AI partner itself or around P1, and actively move to pick it up.
    let urgentSupplyBox: { x: number; y: number } | null = null;
    if (p.hp < p.maxHp * AI_TUNING.lowHealthRatio && st.redBoxes.length > 0) {
        let bestBoxD = Infinity;
        for (let i = 0; i < st.redBoxes.length; i++) {
            const box = st.redBoxes[i];
            if (!isInsideCameraViewport(box.x, box.y, -12)) continue;
            const dToAI = dist(p.x, p.y, box.x, box.y);
            const dToP1 = p1 ? dist(p1.x, p1.y, box.x, box.y) : Infinity;
            const withinSupplySense =
                dToAI <= p.radius + senseRadius || dToP1 <= (p1 ? p1.radius + senseRadius : senseRadius);
            if (withinSupplySense && dToAI < bestBoxD) {
                bestBoxD = dToAI;
                urgentSupplyBox = box;
            }
        }
    }

    const rotateAIFacingTowards = (targetAngle: number) => {
        const nextAngle = stepAngleTowards(p.angle, targetAngle, AI_TUNING.maxTurnStepRad);
        const snapped = snapAngleTo8DirStable(Math.cos(nextAngle), Math.sin(nextAngle), p.dir8);
        p.dir8 = snapped.dir8;
        p.angle = nextAngle;
    };

    let debugGoalLabel = 'HOLD / IDLE';
    let debugGoalX = p.x;
    let debugGoalY = p.y;
    const debugPathPoints: Array<{ x: number; y: number }> = [];

    if (p1?.isDowned) {
        const dToP1 = dist(p.x, p.y, p1.x, p1.y);
        debugGoalLabel = 'REVIVE P1';
        debugGoalX = p1.x;
        debugGoalY = p1.y;

        // Always aim and fire at visible enemies while approaching or reviving P1!
        let hasCloseThreatDuringRevive = false;
        let closeThreatAng = 0;
        if (visibleNearest) {
            const tEn = visibleNearest as TrackedEnemyEntity;
            p.currentWeapon = selectBestAIWeapon(st, p, bestVisibleD);
            const weaponReach = getWeaponEffectiveRangeForAI(st, p, p.currentWeapon) + tEn.radius;
            const exactAng = computeExactMuzzleAimAngle(p.x, p.y, tEn.x, tEn.y, p.currentWeapon) + aimErrorOffset;
            rotateAIFacingTowards(exactAng);
            if (
                bestVisibleD <= weaponReach &&
                Math.abs(normalizeAngleRad(exactAng - p.angle)) <= AI_TUNING.fireAlignToleranceRad &&
                hasClearBallisticShotForAI(st, room, p, tEn, p.currentWeapon, p.angle)
            ) {
                isShooting = true;
                isShootJustPressed = Math.random() < AI_TUNING.opportunisticShotChance;
            }
            if (bestVisibleD < AI_TUNING.closeDefenseRadius) {
                hasCloseThreatDuringRevive = true;
                closeThreatAng = exactAng;
            }
        }

        if (hasCloseThreatDuringRevive) {
            // Clear / kite back from zombies within 100px first instead of walking blindly onto P1's swarmed body!
            debugGoalLabel = 'CLEAR THREAT TO REVIVE';
            mx = -Math.cos(closeThreatAng);
            my = -Math.sin(closeThreatAng);
        } else if (dToP1 > 20) {
            const hasLOS = hasClearNavigationLine(p, p1.x, p1.y, room, st);
            // Do NOT use sampleFlowFieldAngle here because st.flowField seeds P2 itself at distance 0!
            const navAng = hasLOS
                ? Math.atan2(p1.y - p.y, p1.x - p.x)
                : computeGridPathAngleToGoal(
                      st,
                      p.x,
                      p.y,
                      p1.x,
                      p1.y,
                      st.debugPathfinding ? debugPathPoints : undefined,
                  );
            if (hasLOS && st.debugPathfinding) {
                debugPathPoints.push({ x: p.x, y: p.y }, { x: p1.x, y: p1.y });
            }
            if (navAng !== null && !visibleNearest && !inPostShotRecoilHold) {
                const snapped = snapAngleTo8DirStable(Math.cos(navAng), Math.sin(navAng), p.dir8);
                rotateAIFacingTowards(snapped.angle);
            }
            if (navAng !== null) {
                mx = Math.cos(navAng);
                my = Math.sin(navAng);
            } else {
                debugGoalLabel = 'HOLD: P1 UNREACHABLE';
            }
        }
    } else if (visibleNearest) {
        const tEn = visibleNearest as TrackedEnemyEntity;
        const isTargetDevil = tEn.kind === 'devil';
        const maxAllowEngageD = isTargetDevil ? devilLockRetainRadius : senseRadius;

        debugGoalLabel = prioritizeDevil && isTargetDevil ? 'PRIORITY DEVIL' : `ENGAGE ${tEn.kind.toUpperCase()}`;
        debugGoalX = tEn.x;
        debugGoalY = tEn.y;

        if (bestVisibleD <= maxAllowEngageD) {
            p.currentWeapon = selectBestAIWeapon(st, p, bestVisibleD);
        }

        const weaponReach = getWeaponEffectiveRangeForAI(st, p, p.currentWeapon) + tEn.radius;
        // Maintain at least 100px close-defense buffer (scaled down only if weaponReach itself is very short)
        const kiteBackDist = Math.min(AI_TUNING.closeDefenseRadius, weaponReach * 0.62);
        const desiredDevilEngageDist = Math.max(kiteBackDist + 25, Math.min(weaponReach * 0.82, 235));

        const exactAng = computeExactMuzzleAimAngle(p.x, p.y, tEn.x, tEn.y, p.currentWeapon) + aimErrorOffset;
        rotateAIFacingTowards(exactAng);

        const muzzleClear = hasClearBallisticShotForAI(st, room, p, tEn, p.currentWeapon, p.angle);

        // Only pull the trigger once the AI's facing angle is aligned, within range, AND its current muzzle angle clears all walls/unsafe barrels
        if (
            bestVisibleD <= maxAllowEngageD &&
            bestVisibleD <= weaponReach &&
            Math.abs(normalizeAngleRad(exactAng - p.angle)) <= AI_TUNING.fireAlignToleranceRad &&
            muzzleClear
        ) {
            isShooting = true;
            isShootJustPressed = Math.random() < AI_TUNING.opportunisticShotChance;
        }

        const dToP1 = p1 ? dist(p.x, p.y, p1.x, p1.y) : 0;
        const followThreshold = isCurrentlyMoving ? AI_TUNING.follow.movingThreshold : AI_TUNING.follow.idleThreshold;

        // Clamp pursuit goal inside the current camera viewport box so AI never walks into the screen border
        const clampedDevilGoalX = clamp(tEn.x, viewWalkMinX, viewWalkMaxX);
        const clampedDevilGoalY = clamp(tEn.y, viewWalkMinY, viewWalkMaxY);
        const chaseStepAng = Math.atan2(clampedDevilGoalY - p.y, clampedDevilGoalX - p.x);
        const canAdvanceInViewport =
            dist(p.x, p.y, clampedDevilGoalX, clampedDevilGoalY) > 18 &&
            !isAtViewportEdgeInDir(Math.cos(chaseStepAng), Math.sin(chaseStepAng));

        if (urgentSupplyBox) {
            debugGoalLabel = 'PICKUP RED BOX';
            debugGoalX = urgentSupplyBox.x;
            debugGoalY = urgentSupplyBox.y;
            const hasBoxLOS = hasClearNavigationLine(p, urgentSupplyBox.x, urgentSupplyBox.y, room, st);
            const boxAng = hasBoxLOS
                ? Math.atan2(urgentSupplyBox.y - p.y, urgentSupplyBox.x - p.x)
                : computeGridPathAngleToGoal(
                      st,
                      p.x,
                      p.y,
                      urgentSupplyBox.x,
                      urgentSupplyBox.y,
                      st.debugPathfinding ? debugPathPoints : undefined,
                  );
            if (hasBoxLOS && st.debugPathfinding) {
                debugPathPoints.push({ x: p.x, y: p.y }, { x: urgentSupplyBox.x, y: urgentSupplyBox.y });
            }
            if (boxAng !== null) {
                mx = Math.cos(boxAng);
                my = Math.sin(boxAng);
            } else {
                debugGoalLabel = 'HOLD: BOX UNREACHABLE';
            }
        } else if (bestVisibleD < kiteBackDist) {
            debugGoalLabel = 'KITE BACK';
            mx = -Math.cos(exactAng);
            my = -Math.sin(exactAng);
            if (st.debugPathfinding) {
                debugPathPoints.push({ x: p.x, y: p.y }, { x: tEn.x, y: tEn.y });
            }
        } else if (isTargetDevil && !muzzleClear && canAdvanceInViewport) {
            // Center LOS to Devil is clear, but the right-hand gun muzzle is grazing a pillar/wall corner:
            // step toward the Devil (within viewport bounds) to clear the muzzle obstruction!
            debugGoalLabel = 'CLEAR MUZZLE ON DEVIL';
            mx = Math.cos(chaseStepAng);
            my = Math.sin(chaseStepAng);
            if (st.debugPathfinding) {
                debugPathPoints.push({ x: p.x, y: p.y }, { x: clampedDevilGoalX, y: clampedDevilGoalY });
            }
        } else if (isLV4 && anyNearestDevil && !isTargetDevil) {
            // LV4 senses a Devil behind a wall while defending against a <100px zombie:
            // advance along the grid path toward the Devil only within the active camera viewport!
            const devilEn = anyNearestDevil as TrackedEnemyEntity;
            const clampedHuntX = clamp(devilEn.x, viewWalkMinX, viewWalkMaxX);
            const clampedHuntY = clamp(devilEn.y, viewWalkMinY, viewWalkMaxY);
            if (dist(p.x, p.y, clampedHuntX, clampedHuntY) > 20) {
                const huntAng = computeGridPathAngleToGoal(
                    st,
                    p.x,
                    p.y,
                    clampedHuntX,
                    clampedHuntY,
                    st.debugPathfinding ? debugPathPoints : undefined,
                );
                if (huntAng !== null && !isAtViewportEdgeInDir(Math.cos(huntAng), Math.sin(huntAng))) {
                    debugGoalLabel = 'HUNT DEVIL + FIRE';
                    debugGoalX = clampedHuntX;
                    debugGoalY = clampedHuntY;
                    mx = Math.cos(huntAng);
                    my = Math.sin(huntAng);
                }
            }
        } else if (isLV4 && isTargetDevil && bestVisibleD > desiredDevilEngageDist && canAdvanceInViewport) {
            // LV4 actively pursues the Devil into guaranteed effective weapon range (strictly inside the camera viewport)!
            debugGoalLabel = 'CHASE DEVIL';
            debugGoalX = clampedDevilGoalX;
            debugGoalY = clampedDevilGoalY;
            mx = Math.cos(chaseStepAng);
            my = Math.sin(chaseStepAng);
            if (st.debugPathfinding) {
                debugPathPoints.push({ x: p.x, y: p.y }, { x: clampedDevilGoalX, y: clampedDevilGoalY });
            }
        } else if (bestVisibleD > weaponReach && canAdvanceInViewport) {
            // Target is visible within senseRadius but outside current weaponReach -> step closer (inside viewport) to fire!
            debugGoalLabel = 'CLOSE IN TO FIRE';
            mx = Math.cos(chaseStepAng);
            my = Math.sin(chaseStepAng);
            if (st.debugPathfinding) {
                debugPathPoints.push({ x: p.x, y: p.y }, { x: clampedDevilGoalX, y: clampedDevilGoalY });
            }
        } else if (p1 && dToP1 > followThreshold && (!(prioritizeDevil && isTargetDevil) || !canAdvanceInViewport)) {
            debugGoalLabel = 'FOLLOW P1 + FIRE';
            debugGoalX = p1.x;
            debugGoalY = p1.y;
            const hasLOS = hasClearNavigationLine(p, p1.x, p1.y, room, st);
            const followAng = hasLOS
                ? Math.atan2(p1.y - p.y, p1.x - p.x)
                : computeGridPathAngleToGoal(
                      st,
                      p.x,
                      p.y,
                      p1.x,
                      p1.y,
                      st.debugPathfinding ? debugPathPoints : undefined,
                  );
            if (hasLOS && st.debugPathfinding) {
                debugPathPoints.push({ x: p.x, y: p.y }, { x: p1.x, y: p1.y });
            }
            if (followAng !== null) {
                mx = Math.cos(followAng);
                my = Math.sin(followAng);
            } else {
                debugGoalLabel = 'HOLD: P1 UNREACHABLE';
            }
        } else if (st.debugPathfinding) {
            debugPathPoints.push({ x: p.x, y: p.y }, { x: tEn.x, y: tEn.y });
        }
    } else if (urgentSupplyBox) {
        debugGoalLabel = 'PICKUP RED BOX';
        debugGoalX = urgentSupplyBox.x;
        debugGoalY = urgentSupplyBox.y;
        const hasBoxLOS = hasClearNavigationLine(p, urgentSupplyBox.x, urgentSupplyBox.y, room, st);
        const boxAng = hasBoxLOS
            ? Math.atan2(urgentSupplyBox.y - p.y, urgentSupplyBox.x - p.x)
            : computeGridPathAngleToGoal(
                  st,
                  p.x,
                  p.y,
                  urgentSupplyBox.x,
                  urgentSupplyBox.y,
                  st.debugPathfinding ? debugPathPoints : undefined,
              );
        if (hasBoxLOS && st.debugPathfinding) {
            debugPathPoints.push({ x: p.x, y: p.y }, { x: urgentSupplyBox.x, y: urgentSupplyBox.y });
        }
        if (boxAng !== null && !inPostShotRecoilHold) {
            const snapped = snapAngleTo8DirStable(Math.cos(boxAng), Math.sin(boxAng), p.dir8);
            rotateAIFacingTowards(snapped.angle);
        }
        if (boxAng !== null) {
            mx = Math.cos(boxAng);
            my = Math.sin(boxAng);
        } else {
            debugGoalLabel = 'HOLD: BOX UNREACHABLE';
        }
    } else if (
        isLV4 &&
        anyNearestDevil &&
        isInsideCameraViewport((anyNearestDevil as TrackedEnemyEntity).x, (anyNearestDevil as TrackedEnemyEntity).y, 16)
    ) {
        // LV4 senses a Devil inside the current camera viewport behind walls/obstacles:
        // actively pursue the Devil along the pathfinding grid within the camera viewport!
        const devilEn = anyNearestDevil as TrackedEnemyEntity;
        const clampedHuntX = clamp(devilEn.x, viewWalkMinX, viewWalkMaxX);
        const clampedHuntY = clamp(devilEn.y, viewWalkMinY, viewWalkMaxY);
        const hasDevilLOS = hasClearLineOfSight(p.x, p.y, clampedHuntX, clampedHuntY, room.obstacles, st.placedObjects);
        const navAng = hasDevilLOS
            ? Math.atan2(clampedHuntY - p.y, clampedHuntX - p.x)
            : computeGridPathAngleToGoal(
                  st,
                  p.x,
                  p.y,
                  clampedHuntX,
                  clampedHuntY,
                  st.debugPathfinding ? debugPathPoints : undefined,
              );
        if (navAng !== null && !inPostShotRecoilHold) {
            const snapped = snapAngleTo8DirStable(Math.cos(navAng), Math.sin(navAng), p.dir8);
            rotateAIFacingTowards(snapped.angle);
        }
        if (
            navAng !== null &&
            dist(p.x, p.y, clampedHuntX, clampedHuntY) > 20 &&
            !isAtViewportEdgeInDir(Math.cos(navAng), Math.sin(navAng))
        ) {
            debugGoalLabel = 'HUNT DEVIL';
            debugGoalX = clampedHuntX;
            debugGoalY = clampedHuntY;
            if (hasDevilLOS && st.debugPathfinding) {
                debugPathPoints.push({ x: p.x, y: p.y }, { x: clampedHuntX, y: clampedHuntY });
            }
            mx = Math.cos(navAng);
            my = Math.sin(navAng);
        } else {
            debugGoalLabel = navAng === null ? 'HOLD: DEVIL UNREACHABLE' : 'HOLD AT VIEWPORT EDGE';
            debugGoalX = clampedHuntX;
            debugGoalY = clampedHuntY;
        }
    } else if (p1) {
        const dToP1 = dist(p.x, p.y, p1.x, p1.y);
        const hasLOS = hasClearNavigationLine(p, p1.x, p1.y, room, st);
        // Distance hysteresis band: start catching up when > 125px (or > 95px if LOS is blocked),
        // and keep walking smoothly until within 80px of P1 so P2 never oscillates at the boundary.
        const startFollowDist = hasLOS
            ? AI_TUNING.follow.lineOfSightStartDistance
            : AI_TUNING.follow.occludedStartDistance;
        const stopFollowDist = 80;
        const shouldFollowP1 = isCurrentlyMoving ? dToP1 > stopFollowDist : dToP1 > startFollowDist;

        if (shouldFollowP1) {
            debugGoalLabel = 'FOLLOW P1';
            debugGoalX = p1.x;
            debugGoalY = p1.y;
            const navAng = hasLOS
                ? Math.atan2(p1.y - p.y, p1.x - p.x)
                : computeGridPathAngleToGoal(
                      st,
                      p.x,
                      p.y,
                      p1.x,
                      p1.y,
                      st.debugPathfinding ? debugPathPoints : undefined,
                  );
            if (hasLOS && st.debugPathfinding) {
                debugPathPoints.push({ x: p.x, y: p.y }, { x: p1.x, y: p1.y });
            }
            if (navAng !== null && !inPostShotRecoilHold) {
                const snapped = snapAngleTo8DirStable(Math.cos(navAng), Math.sin(navAng), p.dir8);
                rotateAIFacingTowards(snapped.angle);
            }
            if (navAng !== null) {
                mx = Math.cos(navAng);
                my = Math.sin(navAng);
            } else {
                debugGoalLabel = 'HOLD: P1 UNREACHABLE';
            }
        } else if (anyNearest && !inPostShotRecoilHold) {
            // Scheme A1: Enemy is behind a wall/obstacle -> pre-aim toward the corridor corner / doorway
            // where the zombie will emerge (using grid pathfinding), never staring straight into a solid wall!
            const tEn = anyNearest as TrackedEnemyEntity;
            debugGoalLabel = 'PRE-AIM CORNER';
            debugGoalX = tEn.x;
            debugGoalY = tEn.y;
            const cornerWatchAng = computeGridPathAngleToGoal(
                st,
                p.x,
                p.y,
                tEn.x,
                tEn.y,
                st.debugPathfinding ? debugPathPoints : undefined,
            );
            if (cornerWatchAng !== null) {
                const snapped = snapAngleTo8DirStable(Math.cos(cornerWatchAng), Math.sin(cornerWatchAng), p.dir8, 0.22);
                rotateAIFacingTowards(snapped.angle);
            }
        }
    } else if (anyNearest) {
        const tEn = anyNearest as TrackedEnemyEntity;
        debugGoalLabel = 'HUNT ZOMBIE';
        debugGoalX = tEn.x;
        debugGoalY = tEn.y;
        const navAng = computeGridPathAngleToGoal(
            st,
            p.x,
            p.y,
            tEn.x,
            tEn.y,
            st.debugPathfinding ? debugPathPoints : undefined,
        );
        if (navAng !== null && !inPostShotRecoilHold) {
            const snapped = snapAngleTo8DirStable(Math.cos(navAng), Math.sin(navAng), p.dir8);
            rotateAIFacingTowards(snapped.angle);
        }
        if (navAng !== null && bestAnyD > 150) {
            mx = Math.cos(navAng);
            my = Math.sin(navAng);
        }
    }

    if (st.debugPathfinding) {
        st.aiDebugTelemetry = {
            goalLabel: debugGoalLabel,
            goalX: debugGoalX,
            goalY: debugGoalY,
            moveAngle: mx !== 0 || my !== 0 ? Math.atan2(my, mx) : p.angle,
            pathPoints: debugPathPoints,
            senseRadius,
        };
    } else {
        st.aiDebugTelemetry = undefined;
    }

    return { mx, my, isShooting, isShootJustPressed };
}
