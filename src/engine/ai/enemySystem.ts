import type { PlayerEntity, RoomId, RoomSpec } from '@/types/game';
import { circleRectCollide, clamp, dist, segmentIntersectsRect } from '@/utils/battleGeometry';
import { spawn3DParticles, stampBloodOnFloorCanvas } from '@/utils/floorDecalRenderer';
import { soundFX } from '@/utils/sound';
import type { BattleEngineState, RoomBounds } from '../battleTypes';
import { applyKnockbackToPlayer, incrementPlayerCombo } from '../combat/weaponProgression';
import {
    FLOW_CELL,
    resolveSafeRedBoxPosition,
    sampleFlowFieldAngle,
    traceFlowFieldPathForDebug,
} from '../pathfinding/flowFieldPathfinding';
import { ENEMY_COMBAT_TUNING, ENEMY_DROP_TUNING, ENEMY_MOVEMENT_TUNING, ENEMY_SPECS } from '../tuning/enemyTuning';
import { stepAngleTowards } from './angleSteering';
export function updateEnemiesAIAndCombat(
    st: BattleEngineState,
    floorCanvas: HTMLCanvasElement | null,
    room: RoomSpec,
    roomBounds: RoomBounds,
    roomId: RoomId,
    objectCollision: boolean,
    gameSpeedMult: number,
    now: number,
): void {
    for (let i = st.enemies.length - 1; i >= 0; i--) {
        const en = st.enemies[i];
        const enemySpec = ENEMY_SPECS[en.kind];
        const isFireballDevil = en.kind === 'devil';
        if (en.hp <= 0) {
            // Spawn the straight-backward falling corpse animation.
            st.corpses.push({
                id: `corpse-${en.id}`,
                kind: en.kind,
                x: en.x,
                y: en.y,
                vx: en.vx,
                vy: en.vy,
                radius: en.radius,
                angle: en.angle,
                diedAt: now,
                durationMs: enemySpec.death.corpseDurationMs,
            });
            st.enemies.splice(i, 1);
            soundFX.playCreatureHitFloor();
            const killer = st.players.find((p) => p.id === en.lastAttackerId);
            if (killer) {
                incrementPlayerCombo(st, roomId, killer, now);
                st.score += en.scoreValue * Math.max(1, st.combo);
            }
            stampBloodOnFloorCanvas(floorCanvas, en.x, en.y, en.angle + Math.PI, enemySpec.death.bloodScale);
            spawn3DParticles(st, en.x, en.y, 16, en.angle + Math.PI, 'GIB', enemySpec.death.gibCount);

            // Dead devils (100%, ignores 200px radius limit) or lucky zombie kills (22%, subject to 200px radius limit)
            // drop a Red Box directly at their death position, independent of map 'P' spawn nodes.
            const isDevilDrop = en.kind === 'devil';
            if (Math.random() < enemySpec.death.redBoxDropChance) {
                const rawX = clamp(
                    en.x,
                    roomBounds.x + ENEMY_DROP_TUNING.roomBoundsPadding,
                    roomBounds.x + roomBounds.w - ENEMY_DROP_TUNING.roomBoundsPadding,
                );
                const rawY = clamp(
                    en.y,
                    roomBounds.y + ENEMY_DROP_TUNING.roomBoundsPadding,
                    roomBounds.y + roomBounds.h - ENEMY_DROP_TUNING.roomBoundsPadding,
                );
                const safePos = resolveSafeRedBoxPosition(room, roomBounds, st.placedObjects, rawX, rawY);

                // Rule B: Never drop if within < 32px of any existing Red Box (map 'P' node box or another drop)
                const overlapsExistingBox = st.redBoxes.some(
                    (rb) => dist(rb.x, rb.y, safePos.x, safePos.y) < ENEMY_DROP_TUNING.minimumBoxSeparation,
                );

                // Rule 1: Standard zombies cannot drop a Red Box if another enemy-dropped Red Box ('DROP') is within 200px;
                // Devils bypass the 200px radius restriction.
                const blockedByNearbyZombieDrop =
                    !isDevilDrop &&
                    st.redBoxes.some(
                        (rb) =>
                            rb.source === 'DROP' &&
                            dist(rb.x, rb.y, safePos.x, safePos.y) <= ENEMY_DROP_TUNING.zombieDropExclusionRadius,
                    );

                if (!overlapsExistingBox && !blockedByNearbyZombieDrop) {
                    st.redBoxes.push({
                        id: `rbox-drop-${now}-${Math.random()}`,
                        x: safePos.x,
                        y: safePos.y,
                        createdAt: now,
                        source: 'DROP',
                    });
                }
            }
            continue;
        }

        let targetP: PlayerEntity | null = null;
        let minD = Infinity;
        st.players.forEach((p) => {
            if (!p.isDowned) {
                const d = dist(en.x, en.y, p.x, p.y);
                if (d < minD) {
                    minD = d;
                    targetP = p;
                }
            }
        });

        let currentDesiredAngle = en.angle;
        let blockedByWallForSlide = false;

        if (targetP) {
            const tp = targetP as PlayerEntity;
            // Use 10px obstacle ray margin for both Zombies and Devils so 32px doorways (32 - 20 = 12px clear center)
            // allow clean line-of-sight transition once aligned with the doorway center
            const obsMargin = 10;
            const objMargin = enemySpec.obstacleClearance;

            // Check if direct line of sight to target player is blocked for this enemy's physical radius
            const blockedByBarrel =
                !isFireballDevil &&
                st.placedObjects.some(
                    (obj) =>
                        obj.kind === 'barrel' &&
                        obj.hp > 0 &&
                        segmentIntersectsRect(
                            en.x,
                            en.y,
                            tp.x,
                            tp.y,
                            obj.x - obj.radius - objMargin,
                            obj.y - obj.radius - objMargin,
                            (obj.radius + objMargin) * 2,
                            (obj.radius + objMargin) * 2,
                        ),
                );
            const blockedByWall =
                room.obstacles.some((obs) =>
                    segmentIntersectsRect(
                        en.x,
                        en.y,
                        tp.x,
                        tp.y,
                        obs.x - obsMargin,
                        obs.y - obsMargin,
                        obs.w + obsMargin * 2,
                        obs.h + obsMargin * 2,
                    ),
                ) ||
                st.placedObjects.some(
                    (obj) =>
                        obj.kind === 'wall' &&
                        obj.hp > 0 &&
                        segmentIntersectsRect(
                            en.x,
                            en.y,
                            tp.x,
                            tp.y,
                            obj.x - obj.radius - objMargin,
                            obj.y - obj.radius - objMargin,
                            (obj.radius + objMargin) * 2,
                            (obj.radius + objMargin) * 2,
                        ),
                ) ||
                blockedByBarrel;

            blockedByWallForSlide = blockedByWall;
            let desiredAngle = Math.atan2(tp.y - en.y, tp.x - en.x);
            let navMode: 'DIRECT_LOS' | 'FLOW_FIELD' | 'FALLBACK_NO_PATH' = 'DIRECT_LOS';

            if (blockedByWall) {
                const flowAngle = sampleFlowFieldAngle(st, en.x, en.y, tp.x, tp.y, isFireballDevil);
                if (flowAngle !== null) {
                    desiredAngle = flowAngle;
                    navMode = 'FLOW_FIELD';
                } else {
                    navMode = 'FALLBACK_NO_PATH';
                }
            }

            // Zombies steer around barrels locally in addition to their flow-field path.
            let avoidVx = Math.cos(desiredAngle);
            let avoidVy = Math.sin(desiredAngle);
            for (let j = 0; j < st.placedObjects.length; j++) {
                const obj = st.placedObjects[j];
                if (!isFireballDevil && obj.kind === 'barrel' && obj.hp > 0) {
                    const dx = obj.x - en.x;
                    const dy = obj.y - en.y;
                    const d = Math.hypot(dx, dy);
                    const clearance = en.radius + obj.radius + enemySpec.obstacleClearance;
                    if (d > 0.001 && d < clearance) {
                        const forwardDot = (dx / d) * avoidVx + (dy / d) * avoidVy;
                        if (forwardDot > 0.15) {
                            // Steer tangentially around whichever side of the barrel aligns better with desiredAngle
                            const cross = (dx / d) * avoidVy - (dy / d) * avoidVx;
                            const tangSign = cross >= 0 ? 1 : -1;
                            const tx = (-dy / d) * tangSign;
                            const ty = (dx / d) * tangSign;
                            const weight = ((clearance - d) / clearance) * 1.15;
                            avoidVx += tx * weight;
                            avoidVy += ty * weight;
                        }
                    }
                }
            }

            // Soft Boids Separation Steering against nearby enemies so hordes naturally fan out
            // into a wide formation instead of converging onto a single pixel line.
            // When touching a wall/doorframe (`en.debugWallHit`), dampen separation so two Devils/Zombies
            // file smoothly through a 32px doorway instead of wedging each other into opposite pillars!
            const myMass = en.massKg ?? enemySpec.massKg;
            const sepDampen = en.debugWallHit ? 0.28 : blockedByWall ? 0.65 : 1.0;
            let sepVx = 0;
            let sepVy = 0;
            for (let j = 0; j < st.enemies.length; j++) {
                const other = st.enemies[j];
                if (other.id === en.id || other.hp <= 0) continue;
                const dx = en.x - other.x;
                const dy = en.y - other.y;
                const d = Math.hypot(dx, dy);
                const effRadA = blockedByWall ? Math.min(en.radius, 14) : en.radius;
                const effRadB = blockedByWall ? Math.min(other.radius, 14) : other.radius;
                const softSepDist = (effRadA + effRadB) * 1.08;
                if (d < softSepDist) {
                    const otherMass = other.massKg ?? ENEMY_SPECS[other.kind].massKg;
                    const massShare = (otherMass / (myMass + otherMass)) * 2;
                    const strength = ((softSepDist - d) / softSepDist) * 0.9 * massShare * sepDampen;
                    if (d > 0.001) {
                        sepVx += (dx / d) * strength;
                        sepVy += (dy / d) * strength;
                    } else {
                        const fallbackAng = (i * 2.39996 + j) % (Math.PI * 2);
                        sepVx += Math.cos(fallbackAng) * strength;
                        sepVy += Math.sin(fallbackAng) * strength;
                    }
                }
            }
            // Cap total soft separation steering magnitude so zombies still advance decisively toward the player
            const maxSepMag = en.debugWallHit ? 0.32 : 0.85;
            const sepMag = Math.hypot(sepVx, sepVy);
            if (sepMag > maxSepMag) {
                sepVx = (sepVx / sepMag) * maxSepMag;
                sepVy = (sepVy / sepMag) * maxSepMag;
            }
            avoidVx += sepVx;
            avoidVy += sepVy;

            if (Math.hypot(avoidVx, avoidVy) > 0.001) {
                desiredAngle = Math.atan2(avoidVy, avoidVx);
            }

            currentDesiredAngle = desiredAngle;
            en.angle = stepAngleTowards(en.angle, desiredAngle, ENEMY_MOVEMENT_TUNING.maxTurnStepRad);
            const shouldHoldAtBarrel = blockedByBarrel && navMode === 'FALLBACK_NO_PATH';
            const targetSpeed = shouldHoldAtBarrel ? 0 : en.speed * gameSpeedMult;
            const targetVx = Math.cos(en.angle) * targetSpeed;
            const targetVy = Math.sin(en.angle) * targetSpeed;
            en.vx = en.vx * ENEMY_MOVEMENT_TUNING.velocityRetention + targetVx * ENEMY_MOVEMENT_TUNING.acceleration;
            en.vy = en.vy * ENEMY_MOVEMENT_TUNING.velocityRetention + targetVy * ENEMY_MOVEMENT_TUNING.acceleration;
            en.x += en.vx;
            en.y += en.vy;
            en.walkCycle += 0.085 * gameSpeedMult;

            if (st.debugPathfinding) {
                const gc = clamp(Math.floor(en.x / FLOW_CELL), 0, Math.max(0, st.flowCols - 1));
                const gr = clamp(Math.floor(en.y / FLOW_CELL), 0, Math.max(0, st.flowRows - 1));
                const activeField =
                    isFireballDevil && st.devilFlowField && st.devilFlowField.length === st.flowCols * st.flowRows
                        ? st.devilFlowField
                        : st.flowField;
                en.debugNavMode = navMode;
                en.debugTargetX = tp.x;
                en.debugTargetY = tp.y;
                en.debugDesiredAngle = desiredAngle;
                en.debugFlowDist = st.flowCols > 0 ? activeField[gr * st.flowCols + gc] : -1;
                en.debugPathPoints =
                    navMode === 'DIRECT_LOS'
                        ? [
                              { x: en.x, y: en.y },
                              { x: tp.x, y: tp.y },
                          ]
                        : traceFlowFieldPathForDebug(st, en.x, en.y, tp.x, tp.y, isFireballDevil);
            } else if (en.debugPathPoints) {
                en.debugPathPoints = undefined;
            }

            const hasFireballLOS = !room.obstacles.some((obs) =>
                segmentIntersectsRect(en.x, en.y, tp.x, tp.y, obs.x - 6, obs.y - 6, obs.w + 12, obs.h + 12),
            );

            const rangedAttack = enemySpec.rangedAttack;
            if (
                rangedAttack &&
                hasFireballLOS &&
                now - en.lastFireballTime > rangedAttack.cooldownMs &&
                minD < rangedAttack.maxRange
            ) {
                en.lastFireballTime = now;
                const aimAng = Math.atan2(tp.y - en.y, tp.x - en.x);
                en.angle = aimAng;
                soundFX.playWeaponFire('devil_fireball');
                st.bullets.push({
                    id: `dfb-${now}-${Math.random()}`,
                    ownerId: 'DEVIL',
                    sourceEnemyId: en.id,
                    weaponId: 'devil_fireball',
                    x: en.x + Math.cos(aimAng) * rangedAttack.spawnOffset,
                    y: en.y + Math.sin(aimAng) * rangedAttack.spawnOffset,
                    vx: Math.cos(aimAng) * rangedAttack.projectileSpeed,
                    vy: Math.sin(aimAng) * rangedAttack.projectileSpeed,
                    z: rangedAttack.initialHeight,
                    vz: rangedAttack.verticalSpeed,
                    radius: rangedAttack.projectileRadius,
                    damage: rangedAttack.damage,
                    knockback: rangedAttack.knockback,
                    blastRadius: rangedAttack.blastRadius,
                    cluster: false,
                    spawnTime: now,
                });
            }

            if (minD <= en.radius + tp.radius) {
                if (objectCollision) {
                    const pushAng = minD > 0.001 ? Math.atan2(en.y - tp.y, en.x - tp.x) : en.angle + Math.PI;
                    const nx = Math.cos(pushAng);
                    const ny = Math.sin(pushAng);
                    en.x = tp.x + nx * (en.radius + tp.radius);
                    en.y = tp.y + ny * (en.radius + tp.radius);
                    const vn = en.vx * nx + en.vy * ny;
                    if (vn < 0) {
                        en.vx -= vn * nx;
                        en.vy -= vn * ny;
                    }
                }
                if (now - en.lastAttackTime > ENEMY_COMBAT_TUNING.meleeCooldownMs && now > tp.invulnerableUntil) {
                    en.lastAttackTime = now;
                    tp.hp = Math.max(0, tp.hp - en.damage);
                    tp.invulnerableUntil = now + ENEMY_COMBAT_TUNING.meleeInvulnerabilityMs;
                    tp.hurtUntil = now + 240;
                    applyKnockbackToPlayer(tp, en.angle, enemySpec.meleeKnockback);
                    st.screenShake = 6;
                    stampBloodOnFloorCanvas(floorCanvas, tp.x, tp.y, en.angle, 0.9);
                    spawn3DParticles(st, tp.x, tp.y, 14, en.angle, 'BLOOD', 4);
                    if (tp.hp <= 0) {
                        tp.isDowned = true;
                        tp.downedAt = now;
                        soundFX.playPlayerDeathScream();
                        soundFX.playCreatureHitFloor();
                    } else {
                        soundFX.playPlayerScream();
                    }
                }
            }
        } else {
            // All players are downed! During the delay before the Game Over window appears,
            // zombies stop chasing and energetically wave both hands high overhead in celebration!
            en.vx *= ENEMY_MOVEMENT_TUNING.velocityRetention;
            en.vy *= ENEMY_MOVEMENT_TUNING.velocityRetention;
            en.x += en.vx;
            en.y += en.vy;
            en.walkCycle += 0.14 * gameSpeedMult;
        }

        let triggeredSingleMine = false;
        let hitWallThisTick = false;
        for (let pass = 0; pass < 2; pass++) {
            st.placedObjects.forEach((obj) => {
                const d = dist(en.x, en.y, obj.x, obj.y);
                const minDist = en.radius + obj.radius;
                if (d < minDist) {
                    if (obj.kind === 'mine' && obj.armed) {
                        if (pass === 0 && !obj.triggeredAt && !triggeredSingleMine) {
                            obj.triggeredAt = now;
                            triggeredSingleMine = true;
                            soundFX.playMineDetonate();
                        }
                    } else if (obj.kind === 'barrel' && !isFireballDevil && objectCollision) {
                        const pushAng = d > 0.001 ? Math.atan2(en.y - obj.y, en.x - obj.x) : en.angle + Math.PI;
                        const nx = Math.cos(pushAng);
                        const ny = Math.sin(pushAng);
                        en.x = obj.x + nx * minDist;
                        en.y = obj.y + ny * minDist;
                        const vn = en.vx * nx + en.vy * ny;
                        if (vn < 0) {
                            en.vx -= vn * nx;
                            en.vy -= vn * ny;
                        }
                    } else if (obj.kind === 'wall') {
                        if (objectCollision) {
                            const pushAng = d > 0.001 ? Math.atan2(en.y - obj.y, en.x - obj.x) : en.angle + Math.PI;
                            const nx = Math.cos(pushAng);
                            const ny = Math.sin(pushAng);
                            en.x = obj.x + nx * minDist;
                            en.y = obj.y + ny * minDist;
                            const vn = en.vx * nx + en.vy * ny;
                            if (vn < 0) {
                                en.vx -= vn * nx;
                                en.vy -= vn * ny;
                            }
                        }
                        if (pass === 0 && now - en.lastAttackTime > ENEMY_COMBAT_TUNING.objectAttackCooldownMs) {
                            en.lastAttackTime = now;
                            obj.hp -= en.damage;
                        }
                    }
                }
            });

            // Static map obstacle collision uses a 14px navigation footprint (28px diameter)
            // so Devils (combat hitbox 22px / 44px diameter) can physically pass through 32px corridors in Tight / Tight 2!
            const wallCollideRadius = Math.min(en.radius, 14);
            room.obstacles.forEach((obs) => {
                const col = circleRectCollide(en.x, en.y, wallCollideRadius, obs.x, obs.y, obs.w, obs.h);
                if (col.hit) {
                    hitWallThisTick = true;
                    en.x += col.nx * col.overlap;
                    en.y += col.ny * col.overlap;
                    const vn = en.vx * col.nx + en.vy * col.ny;
                    if (vn < 0) {
                        en.vx -= vn * col.nx;
                        en.vy -= vn * col.ny;
                    }
                    // Corner-slide assistance: when navigating around a wall or 32px doorway corner,
                    // apply tangential slide along the obstacle face in the direction of desiredAngle
                    if (pass === 0 && blockedByWallForSlide) {
                        const t1x = -col.ny;
                        const t1y = col.nx;
                        const desX = Math.cos(currentDesiredAngle);
                        const desY = Math.sin(currentDesiredAngle);
                        const dotT = desX * t1x + desY * t1y;
                        const slideSign = dotT >= 0 ? 1 : -1;
                        const slideStep = en.speed * gameSpeedMult * ENEMY_MOVEMENT_TUNING.wallSlideSpeedMultiplier;
                        en.x += t1x * slideSign * slideStep;
                        en.y += t1y * slideSign * slideStep;
                    }
                }
            });
        }
        en.debugWallHit = hitWallThisTick;

        if (!Number.isFinite(en.x) || !Number.isFinite(en.y)) {
            const zNodes = room.spawnNodes.filter((n) => n.kind === 'Z');
            const fallback = zNodes[0] || {
                x: roomBounds.x + roomBounds.w / 2,
                y: roomBounds.y + 32,
            };
            en.x = fallback.x;
            en.y = fallback.y;
            en.vx = 0;
            en.vy = 0;
        }

        en.x = clamp(en.x, roomBounds.x + 8, roomBounds.x + roomBounds.w - 8);
        en.y = clamp(en.y, roomBounds.y + 8, roomBounds.y + roomBounds.h - 8);
    }

    // Pairwise 75% Radius Enemy-vs-Enemy Physical Separation (mass-weighted) + Obstacle/Wall Re-clamping
    // Prevents enemies from stacking on the same coordinate while allowing smooth squeezing through doorways
    const enemyCount = st.enemies.length;
    if (enemyCount > 1) {
        for (let pass = 0; pass < 2; pass++) {
            for (let i = 0; i < enemyCount; i++) {
                const a = st.enemies[i];
                const massA = a.massKg ?? ENEMY_SPECS[a.kind].massKg;
                for (let j = i + 1; j < enemyCount; j++) {
                    const b = st.enemies[j];
                    // When squeezing past walls/doorways, use 14px navigation radius so two Devils don't wedge each other in a 32px doorway
                    const squeezingWall = Boolean(a.debugWallHit || b.debugWallHit);
                    const radA = squeezingWall ? Math.min(a.radius, 14) : a.radius;
                    const radB = squeezingWall ? Math.min(b.radius, 14) : b.radius;
                    const minSep = (radA + radB) * (squeezingWall ? 0.62 : 0.75);
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < minSep * minSep) {
                        const d = Math.sqrt(d2);
                        let nx: number;
                        let ny: number;
                        if (d > 0.001) {
                            nx = dx / d;
                            ny = dy / d;
                        } else {
                            const fallbackAng = ((i * 1.618034 + j * 0.754877) % 1) * Math.PI * 2;
                            nx = Math.cos(fallbackAng);
                            ny = Math.sin(fallbackAng);
                        }

                        const massB = b.massKg ?? ENEMY_SPECS[b.kind].massKg;
                        const invTotal = 1 / (massA + massB);
                        const shareA = massB * invTotal;
                        const shareB = massA * invTotal;
                        const overlap = (minSep - d) * 0.65;

                        a.x += nx * overlap * shareA;
                        a.y += ny * overlap * shareA;
                        b.x -= nx * overlap * shareB;
                        b.y -= ny * overlap * shareB;

                        const rvx = a.vx - b.vx;
                        const rvy = a.vy - b.vy;
                        const vn = rvx * nx + rvy * ny;
                        if (vn < 0) {
                            const impulse = vn * 0.5;
                            a.vx -= nx * impulse * shareA;
                            a.vy -= ny * impulse * shareA;
                            b.vx += nx * impulse * shareB;
                            b.vy += ny * impulse * shareB;
                        }
                    }
                }
            }

            // Re-clamp against players, barrels/fake walls, room obstacles, and room bounds
            // so enemy-to-enemy pushing can never shove a monster inside a wall or barrel
            for (let i = 0; i < enemyCount; i++) {
                const en = st.enemies[i];
                if (objectCollision) {
                    for (let pIdx = 0; pIdx < st.players.length; pIdx++) {
                        const pl = st.players[pIdx];
                        if (pl.isDowned) continue;
                        const d = dist(en.x, en.y, pl.x, pl.y);
                        const minDist = en.radius + pl.radius;
                        if (d < minDist) {
                            const pushAng = d > 0.001 ? Math.atan2(en.y - pl.y, en.x - pl.x) : en.angle + Math.PI;
                            en.x = pl.x + Math.cos(pushAng) * minDist;
                            en.y = pl.y + Math.sin(pushAng) * minDist;
                        }
                    }

                    for (let oIdx = 0; oIdx < st.placedObjects.length; oIdx++) {
                        const obj = st.placedObjects[oIdx];
                        if ((obj.kind === 'wall' || (en.kind !== 'devil' && obj.kind === 'barrel')) && obj.hp > 0) {
                            const d = dist(en.x, en.y, obj.x, obj.y);
                            const minDist = en.radius + obj.radius;
                            if (d < minDist) {
                                const pushAng = d > 0.001 ? Math.atan2(en.y - obj.y, en.x - obj.x) : en.angle + Math.PI;
                                en.x = obj.x + Math.cos(pushAng) * minDist;
                                en.y = obj.y + Math.sin(pushAng) * minDist;
                            }
                        }
                    }
                }

                const wallCollideRadius = Math.min(en.radius, 14);
                for (let wIdx = 0; wIdx < room.obstacles.length; wIdx++) {
                    const obs = room.obstacles[wIdx];
                    const col = circleRectCollide(en.x, en.y, wallCollideRadius, obs.x, obs.y, obs.w, obs.h);
                    if (col.hit) {
                        en.x += col.nx * col.overlap;
                        en.y += col.ny * col.overlap;
                    }
                }

                en.x = clamp(en.x, roomBounds.x + 8, roomBounds.x + roomBounds.w - 8);
                en.y = clamp(en.y, roomBounds.y + 8, roomBounds.y + roomBounds.h - 8);
            }
        }
    }
}
