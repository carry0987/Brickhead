import { WEAPON_MAP } from '@/data/weaponCatalog';
import type { PlacedObject, PlayerEntity, RoomSpec } from '@/types/game';
import { circleRectCollide, clamp, dist } from '@/utils/battleGeometry';
import {
    addBannerToEngine,
    spawn3DParticles,
    spawnWallHitSmoke,
    stampBloodOnFloorCanvas,
} from '@/utils/floorDecalRenderer';
import { ISO_Z_SCALE } from '@/utils/rendering/isoModelRenderer';
import { soundFX } from '@/utils/sound';
import { getPlayerWeaponMuzzleWorldPos, getWeaponMuzzleDurationMs } from '@/utils/svgEffectRenderer';
import type { TrackedEnemyEntity } from '../battleTypes';
import { PLACEABLE_GRID_TUNING, PLACEABLE_SPECS } from '../tuning/placeableTuning';
import { WEAPON_PERK_TUNING } from '../tuning/weaponPerkTuning';
import type { CombatContext } from './combatContext';
import {
    applyKnockbackToEnemy,
    applyKnockbackToPlayer,
    getFirearmBallistics,
    hasComboPerk,
    incrementPlayerCombo,
    syncWeaponState,
} from './weaponProgression';

export function fireWeapon(ctx: CombatContext, player: PlayerEntity, now: number, isJustPressed: boolean): void {
    const { st, floorCanvas, room, roomBounds, roomId, gameMode, friendlyFire } = ctx;
    const wId = player.currentWeapon;
    const spec = WEAPON_MAP[wId];

    // Weapon #9: Charge Pack Remote Detonation
    if (wId === 'charge_pack') {
        if (!isJustPressed) return;
        const existingPack = st.placedObjects.find(
            (o) => o.kind === 'charge_pack' && o.ownerId === player.id && o.hp > 0,
        );
        if (existingPack) {
            soundFX.playMineDetonate();
            existingPack.hp = 0;
            return;
        }
    }

    // Grenade requires a single distinct button press per throw (cannot hold down to throw continuously)
    if (wId === 'grenade' && !isJustPressed) {
        return;
    }

    const fastFirePerk = hasComboPerk(st, player, wId, 'FAST_FIRE');
    const rapidPerk = hasComboPerk(st, player, wId, 'RAPID_FIRE');
    const doubleDmgPerk = hasComboPerk(st, player, wId, 'DOUBLE_DAMAGE');
    const quadDmgPerk = hasComboPerk(st, player, wId, 'QUAD_DAMAGE');
    const _widePerk = hasComboPerk(st, player, wId, 'WIDE_SHOT');
    const _widerPerk = hasComboPerk(st, player, wId, 'WIDER_SHOT');
    const bigBangPerk = hasComboPerk(st, player, wId, 'BIG_BANG');
    const biggerBangPerk = hasComboPerk(st, player, wId, 'BIGGER_BANG');
    const clusterPerk = hasComboPerk(st, player, wId, 'CLUSTER');

    // Human grenade throws have no cooldown, so every key press throws immediately.
    // Rocket top-tier (RAPID_FIRE) firing speed is reduced by 30% compared to UZI rapid fire (65ms / 0.7 = 93ms).
    const cooldown =
        wId === 'grenade' && !player.isAI
            ? 0
            : rapidPerk
              ? wId === 'rocket'
                  ? Math.round(
                        WEAPON_PERK_TUNING.rapidFire.cooldownMs / WEAPON_PERK_TUNING.rapidFire.rocketCooldownDivisor,
                    )
                  : WEAPON_PERK_TUNING.rapidFire.cooldownMs
              : fastFirePerk
                ? wId === 'pistol'
                    ? WEAPON_PERK_TUNING.fastFire.pistolCooldownMs
                    : Math.round(spec.baseFireRateMs * WEAPON_PERK_TUNING.fastFire.defaultCooldownMultiplier)
                : spec.baseFireRateMs;
    if (cooldown > 0 && now - player.lastShotTime < cooldown) return;

    if (!st.sandboxAllUnlocked && spec.baseMaxAmmo !== -1 && player.ammo[wId] <= 0) {
        addBannerToEngine(st, player.x, player.y - 36, 'OUT OF AMMO!', '#f87171');
        player.currentWeapon = 'pistol';
        syncWeaponState(st);
        return;
    }

    const finalDamage = quadDmgPerk
        ? spec.baseDamage * 4
        : doubleDmgPerk
          ? spec.baseDamage * 2
          : biggerBangPerk
            ? Math.round(spec.baseDamage * WEAPON_PERK_TUNING.biggerBang.damageMultiplier)
            : bigBangPerk
              ? Math.round(spec.baseDamage * WEAPON_PERK_TUNING.bigBang.damageMultiplier)
              : spec.baseDamage;

    const finalRadius = biggerBangPerk
        ? Math.round(spec.blastRadius * WEAPON_PERK_TUNING.biggerBang.radiusMultiplier)
        : bigBangPerk
          ? Math.round(spec.blastRadius * WEAPON_PERK_TUNING.bigBang.radiusMultiplier)
          : spec.blastRadius;

    const muzzleAnimDuration = getWeaponMuzzleDurationMs(wId);

    // Placeables: Snap to the center of the 32x32 invisible tile grid cell under (player.x, player.y)
    if (wId === 'barrel' || wId === 'wall' || wId === 'mine' || wId === 'charge_pack') {
        const placeableSpec = PLACEABLE_SPECS[wId];
        const GRID_CELL = PLACEABLE_GRID_TUNING.cellSize;
        const halfCell = GRID_CELL / 2;
        const maxCol = Math.max(0, Math.floor(roomBounds.w / GRID_CELL) - 1);
        const maxRow = Math.max(0, Math.floor(roomBounds.h / GRID_CELL) - 1);
        const col = clamp(Math.floor((player.x - roomBounds.x) / GRID_CELL), 0, maxCol);
        const row = clamp(Math.floor((player.y - roomBounds.y) / GRID_CELL), 0, maxRow);
        const snapX = roomBounds.x + col * GRID_CELL + halfCell;
        const snapY = roomBounds.y + row * GRID_CELL + halfCell;

        const hitsRoomPillar = room.obstacles.some(
            (obs) => circleRectCollide(snapX, snapY, 12, obs.x, obs.y, obs.w, obs.h).hit,
        );
        if (hitsRoomPillar) return;

        const hasRedBoxOverlap = st.redBoxes.some(
            (rb) => dist(snapX, snapY, rb.x, rb.y) < PLACEABLE_GRID_TUNING.overlapDistance,
        );
        if (hasRedBoxOverlap) return;

        if (wId === 'barrel' || wId === 'mine' || wId === 'charge_pack') {
            const hasOverlap = st.placedObjects.some(
                (o) => o.hp > 0 && dist(snapX, snapY, o.x, o.y) < PLACEABLE_GRID_TUNING.overlapDistance,
            );
            if (hasOverlap) return;
        } else if (wId === 'wall') {
            const hasNonWallOverlap = st.placedObjects.some(
                (o) =>
                    o.hp > 0 &&
                    o.kind !== 'wall' &&
                    dist(snapX, snapY, o.x, o.y) < PLACEABLE_GRID_TUNING.overlapDistance,
            );
            if (hasNonWallOverlap) return;

            const existingWallIdx = st.placedObjects.findIndex(
                (o) =>
                    o.hp > 0 &&
                    o.kind === 'wall' &&
                    dist(snapX, snapY, o.x, o.y) < PLACEABLE_GRID_TUNING.overlapDistance,
            );
            if (existingWallIdx !== -1) {
                const existingWall = st.placedObjects[existingWallIdx];
                if (existingWall.hp >= existingWall.maxHp) {
                    return;
                }
                st.placedObjects.splice(existingWallIdx, 1);
            }
        }

        player.lastShotTime = now;
        player.muzzleFlashUntil = now + muzzleAnimDuration;

        if (!st.sandboxAllUnlocked && spec.baseMaxAmmo !== -1) {
            player.ammo[wId] = Math.max(0, player.ammo[wId] - 1);
            syncWeaponState(st);
        }

        soundFX.playWeaponFire(wId);

        const overlappingPlayerIds = st.players
            .filter(
                (p) =>
                    dist(p.x, p.y, snapX, snapY) <
                    p.radius + placeableSpec.radius + PLACEABLE_GRID_TUNING.playerClearance,
            )
            .map((p) => p.id);

        st.placedObjects.push({
            id: `obj-${now}-${Math.random()}`,
            kind: wId,
            ownerId: player.id,
            x: snapX,
            y: snapY,
            w: placeableSpec.width,
            h: placeableSpec.height,
            radius: placeableSpec.radius,
            hp: placeableSpec.maxHp,
            maxHp: placeableSpec.maxHp,
            damage: finalDamage,
            blastRadius: finalRadius,
            cluster: clusterPerk,
            createdAt: now,
            armed: wId !== 'mine',
            passThroughPlayers: overlappingPlayerIds,
        });
        return;
    }

    player.lastShotTime = now;
    player.muzzleFlashUntil = now + muzzleAnimDuration;

    if (!st.sandboxAllUnlocked && spec.baseMaxAmmo !== -1) {
        player.ammo[wId] = Math.max(0, player.ammo[wId] - 1);
        syncWeaponState(st);
    }

    soundFX.playWeaponFire(wId);
    if (wId === 'shotgun') {
        st.shotgunFiringPlayers.add(player.id);
    }

    const muzzle = getPlayerWeaponMuzzleWorldPos(player.x, player.y, player.angle, wId);

    // Eject 3D Brass Bullet Casing from the weapon's chamber/ejection port
    if (wId === 'pistol' || wId === 'uzi' || wId === 'shotgun') {
        spawn3DParticles(
            st,
            muzzle.x - Math.cos(player.angle) * 6,
            muzzle.y - Math.sin(player.angle) * 6,
            muzzle.z,
            player.angle,
            'SHELL',
            1,
        );
    }

    // Instant Hitscan White Bullet Trajectory Lines for Pistol, UZI, and Shotgun!
    if (wId === 'pistol' || wId === 'uzi' || wId === 'shotgun') {
        const { maxRange, pelletCount, spreadRad: spreadVal } = getFirearmBallistics(st, player, wId);

        const x1 = muzzle.x;
        const y1 = muzzle.y;

        for (let i = 0; i < pelletCount; i++) {
            const offset =
                pelletCount > 1
                    ? (i - (pelletCount - 1) / 2) * (spreadVal / Math.max(1, pelletCount - 1)) +
                      (Math.random() - 0.5) * 0.02
                    : (Math.random() - 0.5) * spreadVal;
            const fireAng = player.angle + offset;

            const fullDx = Math.cos(fireAng) * maxRange;
            const fullDy = Math.sin(fireAng) * maxRange;
            const fullL2 = Math.max(1, fullDx * fullDx + fullDy * fullDy);

            let bestT = 1.0;
            let hitType = 'NONE' as 'NONE' | 'WALL' | 'OBJECT' | 'ENEMY' | 'PLAYER';
            let hitWallFace = 'NONE' as 'NONE' | 'NORTH' | 'SOUTH' | 'WEST' | 'EAST';
            let hitObstacle: RoomSpec['obstacles'][number] | null = null;
            let hitObj: PlacedObject | null = null;
            let hitEnemy: TrackedEnemyEntity | null = null;
            let hitPlayer: PlayerEntity | null = null;

            // 1. Check outer world boundaries
            const minWX = roomBounds.x;
            const maxWX = roomBounds.x + roomBounds.w;
            const minWY = roomBounds.y;
            const maxWY = roomBounds.y + roomBounds.h;

            if (fullDx < -0.001) {
                const t = (minWX - x1) / fullDx;
                if (t > 0 && t < bestT) {
                    bestT = t;
                    hitType = 'WALL';
                    hitWallFace = 'EAST';
                    hitObstacle = null;
                }
            } else if (fullDx > 0.001) {
                const t = (maxWX - x1) / fullDx;
                if (t > 0 && t < bestT) {
                    bestT = t;
                    hitType = 'WALL';
                    hitWallFace = 'WEST';
                    hitObstacle = null;
                }
            }
            if (fullDy < -0.001) {
                const t = (minWY - y1) / fullDy;
                if (t > 0 && t < bestT) {
                    bestT = t;
                    hitType = 'WALL';
                    hitWallFace = 'SOUTH';
                    hitObstacle = null;
                }
            } else if (fullDy > 0.001) {
                const t = (maxWY - y1) / fullDy;
                if (t > 0 && t < bestT) {
                    bestT = t;
                    hitType = 'WALL';
                    hitWallFace = 'NORTH';
                    hitObstacle = null;
                }
            }

            // 2. Check room concrete pillar obstacles (exact Ray-AABB slab intersection + hit face normal)
            for (const obs of room.obstacles) {
                if (x1 >= obs.x && x1 <= obs.x + obs.w && y1 >= obs.y && y1 <= obs.y + obs.h) {
                    bestT = 0;
                    hitType = 'WALL';
                    hitWallFace = fullDy >= 0 ? 'NORTH' : 'SOUTH';
                    hitObstacle = obs;
                    continue;
                }
                let tMinX = -Infinity;
                let tMaxX = Infinity;
                if (Math.abs(fullDx) < 1e-6) {
                    if (x1 < obs.x || x1 > obs.x + obs.w) continue;
                } else {
                    const invDx = 1 / fullDx;
                    let t1 = (obs.x - x1) * invDx;
                    let t2 = (obs.x + obs.w - x1) * invDx;
                    if (t1 > t2) {
                        const tmp = t1;
                        t1 = t2;
                        t2 = tmp;
                    }
                    tMinX = t1;
                    tMaxX = t2;
                }

                let tMinY = -Infinity;
                let tMaxY = Infinity;
                if (Math.abs(fullDy) < 1e-6) {
                    if (y1 < obs.y || y1 > obs.y + obs.h) continue;
                } else {
                    const invDy = 1 / fullDy;
                    let t1 = (obs.y - y1) * invDy;
                    let t2 = (obs.y + obs.h - y1) * invDy;
                    if (t1 > t2) {
                        const tmp = t1;
                        t1 = t2;
                        t2 = tmp;
                    }
                    tMinY = t1;
                    tMaxY = t2;
                }

                const tEnter = Math.max(tMinX, tMinY);
                const tExit = Math.min(bestT, tMaxX, tMaxY);
                if (tEnter > tExit || tExit < 0) continue;

                const tHit = Math.max(0, tEnter);
                if (tHit >= 0 && tHit < bestT) {
                    bestT = tHit;
                    hitType = 'WALL';
                    hitObstacle = obs;
                    if (tMinY >= tMinX) {
                        hitWallFace = fullDy >= 0 ? 'NORTH' : 'SOUTH';
                    } else {
                        hitWallFace = fullDx >= 0 ? 'WEST' : 'EAST';
                    }
                }
            }

            // 3. Check Placed Fake Walls and Barrels
            for (const obj of st.placedObjects) {
                if ((obj.kind === 'wall' || obj.kind === 'barrel') && obj.hp > 0) {
                    if (obj.passThroughPlayers?.includes(player.id)) {
                        continue;
                    }
                    const projT = clamp(((obj.x - x1) * fullDx + (obj.y - y1) * fullDy) / fullL2, 0, 1);
                    if (projT >= 0 && projT < bestT) {
                        const cx = x1 + projT * fullDx;
                        const cy = y1 + projT * fullDy;
                        const d = dist(obj.x, obj.y, cx, cy);
                        if (d <= obj.radius + 3) {
                            const backOffset = Math.sqrt(Math.max(0, (obj.radius + 3) ** 2 - d * d)) / maxRange;
                            const enterT = Math.max(0, projT - backOffset);
                            if (enterT < bestT) {
                                bestT = enterT;
                                hitType = 'OBJECT';
                                hitObj = obj;
                            }
                        }
                    }
                }
            }

            // 4. Check Enemies (Zombies & Devils)
            st.enemies.forEach((en) => {
                if (en.hp <= 0) return;
                const projT = clamp(((en.x - x1) * fullDx + (en.y - y1) * fullDy) / fullL2, 0, 1);
                if (projT >= 0 && projT < bestT) {
                    const cx = x1 + projT * fullDx;
                    const cy = y1 + projT * fullDy;
                    const d = dist(en.x, en.y, cx, cy);
                    if (d <= en.radius + 3) {
                        const backOffset = Math.sqrt(Math.max(0, (en.radius + 3) ** 2 - d * d)) / maxRange;
                        const enterT = Math.max(0, projT - backOffset);
                        if (enterT < bestT) {
                            bestT = enterT;
                            hitType = 'ENEMY';
                            hitEnemy = en;
                        }
                    }
                }
            });

            // 5. Check Teammate / Opponent Player
            if (gameMode === 'DEATHMATCH_2P' || friendlyFire) {
                st.players.forEach((other) => {
                    if (other.id !== player.id && !other.isDowned) {
                        const projT = clamp(((other.x - x1) * fullDx + (other.y - y1) * fullDy) / fullL2, 0, 1);
                        if (projT >= 0 && projT < bestT) {
                            const cx = x1 + projT * fullDx;
                            const cy = y1 + projT * fullDy;
                            const d = dist(other.x, other.y, cx, cy);
                            if (d <= other.radius + 3) {
                                const backOffset = Math.sqrt(Math.max(0, (other.radius + 3) ** 2 - d * d)) / maxRange;
                                const enterT = Math.max(0, projT - backOffset);
                                if (enterT < bestT) {
                                    bestT = enterT;
                                    hitType = 'PLAYER';
                                    hitPlayer = other;
                                }
                            }
                        }
                    }
                });
            }

            const endX = x1 + fullDx * bestT;
            const endY = y1 + fullDy * bestT;

            // Compute 2.5D Y-sort depth key (Option A) so southern walls occlude beams hitting their back (NORTH) face
            let beamSortY = fullDy >= 0 ? endY - 0.8 : endY + 0.8;
            let smokeSortY = endY + 0.8;
            let smokeX = endX;
            let occludedBySouthWall = false;

            if (hitType === 'WALL') {
                if (hitObstacle) {
                    const obsSortY = hitObstacle.y + hitObstacle.h - (hitObstacle.style === 'pyramid_pillar' ? 0 : 0.5);
                    if (hitWallFace === 'NORTH') {
                        beamSortY = hitObstacle.y - 1;
                        smokeSortY = hitObstacle.y - 0.5;
                        occludedBySouthWall = true;
                    } else if (hitWallFace === 'SOUTH') {
                        beamSortY = obsSortY + 0.5;
                        smokeSortY = obsSortY + 0.8;
                        occludedBySouthWall = false;
                    } else {
                        beamSortY = hitObstacle.y - 1;
                        smokeSortY = hitObstacle.y - 0.5;
                        smokeX = endX + (hitWallFace === 'WEST' ? -3.0 : 3.0);
                        occludedBySouthWall = false;
                    }
                } else if (hitWallFace === 'NORTH') {
                    beamSortY = endY - 1;
                    smokeSortY = endY - 0.5;
                    occludedBySouthWall = true;
                }
            } else if (hitType === 'OBJECT' && hitObj && hitObj.kind === 'wall') {
                const fwSortY = hitObj.y + hitObj.h / 2;
                if (endY < hitObj.y - 2) {
                    beamSortY = hitObj.y - 1;
                    smokeSortY = hitObj.y - 0.5;
                    occludedBySouthWall = true;
                } else {
                    beamSortY = fwSortY + 0.5;
                    smokeSortY = fwSortY + 0.8;
                    occludedBySouthWall = false;
                }
            }

            st.beams.push({
                id: `hitscan-${now}-${i}-${Math.random()}`,
                x1: muzzle.screenX,
                y1: muzzle.screenY,
                x2: endX,
                y2: endY - muzzle.z * ISO_Z_SCALE,
                color: '#ffffff',
                createdAt: now,
                durationMs: 95,
                width: 1.8,
                isBulletTrail: true,
                sortY: beamSortY,
            });

            if (hitType === 'ENEMY' && hitEnemy) {
                const targetEn = hitEnemy as TrackedEnemyEntity;
                targetEn.hp -= finalDamage;
                targetEn.lastAttackerId = player.id;
                targetEn.hitFlashUntil = now + 75;
                targetEn.hurtUntil = now + 220;
                applyKnockbackToEnemy(targetEn, fireAng, spec.knockback);
                stampBloodOnFloorCanvas(floorCanvas, targetEn.x, targetEn.y, fireAng, 0.85);
                spawn3DParticles(st, targetEn.x, targetEn.y, 15, fireAng, 'BLOOD', 3);
            } else if (hitType === 'OBJECT' && hitObj) {
                const targetObj = hitObj as PlacedObject;
                if (targetObj.kind === 'barrel') {
                    targetObj.hp = 0;
                } else if (targetObj.kind === 'wall') {
                    targetObj.hp -= finalDamage;
                    spawnWallHitSmoke(st, smokeX, endY, fireAng, now, muzzle.z, smokeSortY, occludedBySouthWall);
                    soundFX.playHitWall();
                }
            } else if (hitType === 'PLAYER' && hitPlayer) {
                const targetPl = hitPlayer as PlayerEntity;
                const dmg = Math.max(4, Math.round(finalDamage * 0.45));
                targetPl.hp = Math.max(0, targetPl.hp - dmg);
                targetPl.hurtUntil = now + 240;
                applyKnockbackToPlayer(targetPl, fireAng, spec.knockback);
                stampBloodOnFloorCanvas(floorCanvas, targetPl.x, targetPl.y, fireAng, 0.85);
                spawn3DParticles(st, targetPl.x, targetPl.y, 14, fireAng, 'BLOOD', 3);
                if (targetPl.hp <= 0) {
                    targetPl.isDowned = true;
                    targetPl.downedAt = now;
                    soundFX.playPlayerDeathScream();
                    soundFX.playCreatureHitFloor();
                    if (gameMode === 'DEATHMATCH_2P') {
                        player.frags += 1;
                        incrementPlayerCombo(st, roomId, player, now);
                    }
                } else {
                    soundFX.playPlayerScream();
                }
            } else if (hitType === 'WALL') {
                spawnWallHitSmoke(st, smokeX, endY, fireAng, now, muzzle.z, smokeSortY, occludedBySouthWall);
                soundFX.playHitWall();
            }
        }
        return;
    }

    // Railgun (stopped by Room Walls & Fake Walls using exact Ray-AABB slab intersection, pierces through enemies!)
    if (wId === 'railgun') {
        const len = hasComboPerk(st, player, 'railgun', 'LONG_SHOT')
            ? WEAPON_PERK_TUNING.railgun.longShotRange
            : WEAPON_PERK_TUNING.railgun.baseRange;
        const x1 = muzzle.x;
        const y1 = muzzle.y;
        const rawX2 = x1 + Math.cos(player.angle) * len;
        const rawY2 = y1 + Math.sin(player.angle) * len;

        const fullDx = rawX2 - x1;
        const fullDy = rawY2 - y1;
        const fullL2 = Math.max(1, fullDx * fullDx + fullDy * fullDy);

        let maxT = 1.0;
        let railHitWall = false;
        let railWallFace = 'NONE' as 'NONE' | 'NORTH' | 'SOUTH' | 'WEST' | 'EAST';
        let railObstacle: RoomSpec['obstacles'][number] | null = null;
        let hitFakeWall: PlacedObject | null = null;

        // 1. Check outer world boundaries
        const minWX = roomBounds.x;
        const maxWX = roomBounds.x + roomBounds.w;
        const minWY = roomBounds.y;
        const maxWY = roomBounds.y + roomBounds.h;

        if (fullDx < -0.001) {
            const t = (minWX - x1) / fullDx;
            if (t > 0 && t < maxT) {
                maxT = t;
                railHitWall = true;
                railWallFace = 'EAST';
            }
        } else if (fullDx > 0.001) {
            const t = (maxWX - x1) / fullDx;
            if (t > 0 && t < maxT) {
                maxT = t;
                railHitWall = true;
                railWallFace = 'WEST';
            }
        }
        if (fullDy < -0.001) {
            const t = (minWY - y1) / fullDy;
            if (t > 0 && t < maxT) {
                maxT = t;
                railHitWall = true;
                railWallFace = 'SOUTH';
            }
        } else if (fullDy > 0.001) {
            const t = (maxWY - y1) / fullDy;
            if (t > 0 && t < maxT) {
                maxT = t;
                railHitWall = true;
                railWallFace = 'NORTH';
            }
        }

        // 2. Exact Ray-AABB slab intersection with room concrete obstacles
        room.obstacles.forEach((obs) => {
            if (x1 >= obs.x && x1 <= obs.x + obs.w && y1 >= obs.y && y1 <= obs.y + obs.h) {
                maxT = 0;
                railHitWall = true;
                railObstacle = obs;
                railWallFace = fullDy >= 0 ? 'NORTH' : 'SOUTH';
                hitFakeWall = null;
                return;
            }
            let tMinX = -Infinity;
            let tMaxX = Infinity;
            if (Math.abs(fullDx) < 1e-6) {
                if (x1 < obs.x || x1 > obs.x + obs.w) return;
            } else {
                const invDx = 1 / fullDx;
                let t1 = (obs.x - x1) * invDx;
                let t2 = (obs.x + obs.w - x1) * invDx;
                if (t1 > t2) {
                    const tmp = t1;
                    t1 = t2;
                    t2 = tmp;
                }
                tMinX = t1;
                tMaxX = t2;
            }

            let tMinY = -Infinity;
            let tMaxY = Infinity;
            if (Math.abs(fullDy) < 1e-6) {
                if (y1 < obs.y || y1 > obs.y + obs.h) return;
            } else {
                const invDy = 1 / fullDy;
                let t1 = (obs.y - y1) * invDy;
                let t2 = (obs.y + obs.h - y1) * invDy;
                if (t1 > t2) {
                    const tmp = t1;
                    t1 = t2;
                    t2 = tmp;
                }
                tMinY = t1;
                tMaxY = t2;
            }

            const tEnter = Math.max(tMinX, tMinY);
            const tExit = Math.min(maxT, tMaxX, tMaxY);
            if (tEnter > tExit || tExit < 0) return;

            const tHit = Math.max(0, tEnter);
            if (tHit >= 0 && tHit < maxT) {
                maxT = tHit;
                railHitWall = true;
                railObstacle = obs;
                hitFakeWall = null;
                if (tMinY >= tMinX) {
                    railWallFace = fullDy >= 0 ? 'NORTH' : 'SOUTH';
                } else {
                    railWallFace = fullDx >= 0 ? 'WEST' : 'EAST';
                }
            }
        });

        // 3. Check Fake Walls (outer surface intersection)
        st.placedObjects.forEach((obj) => {
            if (obj.kind === 'wall' && obj.hp > 0) {
                const projT = clamp(((obj.x - x1) * fullDx + (obj.y - y1) * fullDy) / fullL2, 0, 1);
                if (projT >= 0 && projT < maxT) {
                    const cx = x1 + projT * fullDx;
                    const cy = y1 + projT * fullDy;
                    const d = dist(obj.x, obj.y, cx, cy);
                    if (d <= obj.radius + 4) {
                        const backOffset = Math.sqrt(Math.max(0, (obj.radius + 4) ** 2 - d * d)) / len;
                        const enterT = Math.max(0, projT - backOffset);
                        if (enterT < maxT) {
                            maxT = enterT;
                            hitFakeWall = obj;
                            railHitWall = false;
                            railObstacle = null;
                        }
                    }
                }
            }
        });

        const x2 = x1 + fullDx * maxT;
        const y2 = y1 + fullDy * maxT;

        let railBeamSortY = fullDy >= 0 ? y2 - 0.8 : y2 + 0.8;
        let railSmokeSortY = y2 + 0.8;
        let railSmokeX = x2;
        let railOccludedBySouthWall = false;

        if (hitFakeWall) {
            const fw = hitFakeWall as PlacedObject;
            fw.hp -= finalDamage;
            const fwSortY = fw.y + fw.h / 2;
            if (y2 < fw.y - 2) {
                railBeamSortY = fw.y - 1;
                railSmokeSortY = fw.y - 0.5;
                railOccludedBySouthWall = true;
            } else {
                railBeamSortY = fwSortY + 0.5;
                railSmokeSortY = fwSortY + 0.8;
            }
            spawnWallHitSmoke(st, railSmokeX, y2, player.angle, now, muzzle.z, railSmokeSortY, railOccludedBySouthWall);
            soundFX.playHitWall();
        } else if (railHitWall) {
            if (railObstacle) {
                const obs = railObstacle as RoomSpec['obstacles'][number];
                const obsSortY = obs.y + obs.h - (obs.style === 'pyramid_pillar' ? 0 : 0.5);
                if (railWallFace === 'NORTH') {
                    railBeamSortY = obs.y - 1;
                    railSmokeSortY = obs.y - 0.5;
                    railOccludedBySouthWall = true;
                } else if (railWallFace === 'SOUTH') {
                    railBeamSortY = obsSortY + 0.5;
                    railSmokeSortY = obsSortY + 0.8;
                } else {
                    railBeamSortY = obs.y - 1;
                    railSmokeSortY = obs.y - 0.5;
                    railSmokeX = x2 + (railWallFace === 'WEST' ? -3.0 : 3.0);
                }
            } else if (railWallFace === 'NORTH') {
                railBeamSortY = y2 - 1;
                railSmokeSortY = y2 - 0.5;
                railOccludedBySouthWall = true;
            }
            spawnWallHitSmoke(st, railSmokeX, y2, player.angle, now, muzzle.z, railSmokeSortY, railOccludedBySouthWall);
        }

        st.beams.push({
            id: `rail-${now}-${Math.random()}`,
            x1: muzzle.screenX,
            y1: muzzle.screenY,
            x2,
            y2: y2 - muzzle.z * ISO_Z_SCALE,
            color: '#ef4444',
            createdAt: now,
            durationMs: 200,
            sortY: railBeamSortY,
            depthStartY: y1,
            depthEndY: y2,
        });

        const dx = x2 - x1;
        const dy = y2 - y1;
        const l2 = Math.max(1, dx * dx + dy * dy);

        st.enemies.forEach((en) => {
            const t = clamp(((en.x - x1) * dx + (en.y - y1) * dy) / l2, 0, 1);
            const cx = x1 + t * dx;
            const cy = y1 + t * dy;
            if (dist(en.x, en.y, cx, cy) <= en.radius + 12) {
                en.hp -= finalDamage;
                en.lastAttackerId = player.id;
                en.hitFlashUntil = now + 100;
                en.hurtUntil = now + 220;
                applyKnockbackToEnemy(en, player.angle, spec.knockback);
                stampBloodOnFloorCanvas(floorCanvas, en.x, en.y, player.angle, 1.25);
                spawn3DParticles(st, en.x, en.y, 16, player.angle, 'BLOOD', 4);
                incrementPlayerCombo(st, roomId, player, now);
            }
        });

        st.placedObjects.forEach((obj) => {
            if (obj.kind === 'barrel' && obj.hp > 0) {
                const t = clamp(((obj.x - x1) * dx + (obj.y - y1) * dy) / l2, 0, 1);
                if (dist(obj.x, obj.y, x1 + t * dx, y1 + t * dy) <= obj.radius + 10) {
                    obj.hp = 0;
                }
            }
        });

        if (gameMode === 'DEATHMATCH_2P' || friendlyFire) {
            st.players.forEach((other) => {
                if (other.id !== player.id && !other.isDowned) {
                    const t = clamp(((other.x - x1) * dx + (other.y - y1) * dy) / l2, 0, 1);
                    if (dist(other.x, other.y, x1 + t * dx, y1 + t * dy) <= other.radius + 10) {
                        other.hp = Math.max(0, other.hp - 45);
                        other.hurtUntil = now + 240;
                        applyKnockbackToPlayer(other, player.angle, spec.knockback);
                        stampBloodOnFloorCanvas(floorCanvas, other.x, other.y, player.angle, 1);
                        if (other.hp <= 0) {
                            other.isDowned = true;
                            other.downedAt = now;
                            soundFX.playPlayerDeathScream();
                            soundFX.playCreatureHitFloor();
                            if (gameMode === 'DEATHMATCH_2P') {
                                player.frags += 1;
                                incrementPlayerCombo(st, roomId, player, now);
                            }
                        } else {
                            soundFX.playPlayerScream();
                        }
                    }
                }
            });
        }
        return;
    }

    // Projectiles: Grenade (3D Lobbed Arc!) & Rocket (spawned from 3D weapon muzzle_bone!)
    for (let i = 0; i < spec.pellets; i++) {
        const offset = (Math.random() - 0.5) * spec.spread;
        const fireAng = player.angle + offset;

        st.bullets.push({
            id: `b-${now}-${i}-${Math.random()}`,
            ownerId: player.id,
            weaponId: wId,
            x: muzzle.x,
            y: muzzle.y,
            vx: Math.cos(fireAng) * spec.speed,
            vy: Math.sin(fireAng) * spec.speed,
            z: muzzle.z,
            vz: wId === 'grenade' ? 4.8 : 0,
            radius: 5.5,
            damage: finalDamage,
            knockback: spec.knockback,
            blastRadius: finalRadius,
            cluster: clusterPerk,
            isGrenade: wId === 'grenade',
            spawnTime: now,
            fuseMs: wId === 'grenade' ? 780 : undefined,
        });
    }
}
