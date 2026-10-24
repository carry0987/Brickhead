import type { RoomSpec } from '@/types/game';
import { clamp, dist } from '@/utils/battleGeometry';
import { spawn3DParticles, spawnWallHitSmoke, stampBloodOnFloorCanvas } from '@/utils/floorDecalRenderer';
import { soundFX } from '@/utils/sound';
import type { CombatContext } from './combatContext';
import { triggerExplosion } from './explosionSystem';
import { applyKnockbackToEnemy, applyKnockbackToPlayer, incrementPlayerCombo } from './weaponProgression';

export function updateBulletsAndGrenades(ctx: CombatContext, now: number): void {
    const { st, floorCanvas, room, roomBounds, roomId, gameMode, friendlyFire, gameSpeedMult } = ctx;

    for (let i = st.bullets.length - 1; i >= 0; i--) {
        const b = st.bullets[i];
        const prevX = b.x;
        const prevY = b.y;
        b.x += b.vx * (b.isGrenade ? 1 : gameSpeedMult);
        b.y += b.vy * (b.isGrenade ? 1 : gameSpeedMult);
        b.sortY = b.y;

        if (b.weaponId === 'rocket') {
            const flyAng = Math.atan2(b.vy, b.vx);
            const smokeY = prevY - Math.sin(flyAng) * 6;
            st.wallSmokePuffs.push({
                id: `rsmoke-${now}-${i}-${Math.random()}`,
                x: prevX - Math.cos(flyAng) * 6,
                y: smokeY,
                z: b.z,
                vx: -Math.cos(flyAng) * 0.25 + (Math.random() - 0.5) * 0.2,
                vy: -Math.sin(flyAng) * 0.25 + (Math.random() - 0.5) * 0.2,
                vz: 0.12,
                startRadius: 8.5,
                endRadius: 24.0,
                createdAt: now,
                durationMs: 310,
                shade: '#999999',
                sortY: smokeY - 0.5,
            });
            if (st.wallSmokePuffs.length > 110) {
                st.wallSmokePuffs.splice(0, st.wallSmokePuffs.length - 110);
            }
        }

        if (b.isGrenade) {
            b.vx *= 0.96;
            b.vy *= 0.96;
            b.z += b.vz;
            b.vz -= 0.36;
            if (b.z <= 0) {
                if (Math.abs(b.vz) > 0.8) {
                    soundFX.playGrenadeBounce();
                }
                b.z = 0;
                b.vz = Math.abs(b.vz) * 0.52;
            }
            if (b.fuseMs && now - b.spawnTime >= b.fuseMs) {
                triggerExplosion(ctx, b.x, b.y, b.blastRadius, b.damage, b.knockback, b.ownerId, b.cluster, now, b.z);
                st.bullets.splice(i, 1);
                continue;
            }
        }

        // Continuous segment-AABB intersection from (prevX, prevY) to (b.x, b.y) so rockets/grenades/fireballs
        // detonate on the exact outer wall surface and receive accurate 2.5D depth occlusion sortY.
        const segDx = b.x - prevX;
        const segDy = b.y - prevY;
        let wallT = 1.0001;
        let hitWall = false;
        let hitWallFace: 'NONE' | 'NORTH' | 'SOUTH' | 'WEST' | 'EAST' = 'NONE';
        let hitObstacle: RoomSpec['obstacles'][number] | null = null;

        const minWX = roomBounds.x;
        const maxWX = roomBounds.x + roomBounds.w;
        const minWY = roomBounds.y;
        const maxWY = roomBounds.y + roomBounds.h;

        if (b.x < minWX && segDx < -1e-6) {
            const t = clamp((minWX - prevX) / segDx, 0, 1);
            if (t < wallT) {
                wallT = t;
                hitWall = true;
                hitWallFace = 'EAST';
                hitObstacle = null;
            }
        } else if (b.x > maxWX && segDx > 1e-6) {
            const t = clamp((maxWX - prevX) / segDx, 0, 1);
            if (t < wallT) {
                wallT = t;
                hitWall = true;
                hitWallFace = 'WEST';
                hitObstacle = null;
            }
        }
        if (b.y < minWY && segDy < -1e-6) {
            const t = clamp((minWY - prevY) / segDy, 0, 1);
            if (t < wallT) {
                wallT = t;
                hitWall = true;
                hitWallFace = 'SOUTH';
                hitObstacle = null;
            }
        } else if (b.y > maxWY && segDy > 1e-6) {
            const t = clamp((maxWY - prevY) / segDy, 0, 1);
            if (t < wallT) {
                wallT = t;
                hitWall = true;
                hitWallFace = 'NORTH';
                hitObstacle = null;
            }
        }

        for (const obs of room.obstacles) {
            if (prevX >= obs.x && prevX <= obs.x + obs.w && prevY >= obs.y && prevY <= obs.y + obs.h) {
                wallT = 0;
                hitWall = true;
                hitObstacle = obs;
                hitWallFace = segDy >= 0 ? 'NORTH' : 'SOUTH';
                break;
            }
            let tMinX = -Infinity;
            let tMaxX = Infinity;
            if (Math.abs(segDx) < 1e-6) {
                if (prevX < obs.x || prevX > obs.x + obs.w) continue;
            } else {
                const invDx = 1 / segDx;
                let t1 = (obs.x - prevX) * invDx;
                let t2 = (obs.x + obs.w - prevX) * invDx;
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
            if (Math.abs(segDy) < 1e-6) {
                if (prevY < obs.y || prevY > obs.y + obs.h) continue;
            } else {
                const invDy = 1 / segDy;
                let t1 = (obs.y - prevY) * invDy;
                let t2 = (obs.y + obs.h - prevY) * invDy;
                if (t1 > t2) {
                    const tmp = t1;
                    t1 = t2;
                    t2 = tmp;
                }
                tMinY = t1;
                tMaxY = t2;
            }

            const tEnter = Math.max(tMinX, tMinY);
            const tExit = Math.min(1, tMaxX, tMaxY);
            if (tEnter > tExit || tExit < 0) continue;

            const tHit = Math.max(0, tEnter);
            if (tHit >= 0 && tHit < wallT) {
                wallT = tHit;
                hitWall = true;
                hitObstacle = obs;
                if (tMinY >= tMinX) {
                    hitWallFace = segDy >= 0 ? 'NORTH' : 'SOUTH';
                } else {
                    hitWallFace = segDx >= 0 ? 'WEST' : 'EAST';
                }
            }
        }

        if (hitWall) {
            const hitX = prevX + segDx * clamp(wallT, 0, 1);
            const hitY = prevY + segDy * clamp(wallT, 0, 1);
            let explosionSortY: number | undefined;
            let occludeBelowY: number | undefined;
            if (hitObstacle) {
                if (hitWallFace === 'NORTH') {
                    explosionSortY = hitObstacle.y - 0.5;
                    occludeBelowY = hitObstacle.y + hitObstacle.h - 1;
                } else if (hitWallFace === 'SOUTH') {
                    explosionSortY = hitObstacle.y + hitObstacle.h + 1.0;
                } else {
                    explosionSortY = Math.min(hitY, hitObstacle.y + hitObstacle.h - 1.0);
                }
            } else if (hitWallFace === 'NORTH') {
                explosionSortY = hitY - 0.5;
            } else if (hitWallFace === 'SOUTH') {
                explosionSortY = hitY + 1.0;
            }

            if (b.blastRadius > 0) {
                triggerExplosion(
                    ctx,
                    hitX,
                    hitY,
                    b.blastRadius,
                    b.damage,
                    b.knockback,
                    b.ownerId,
                    b.cluster,
                    now,
                    b.isGrenade ? b.z : 0,
                    explosionSortY,
                    occludeBelowY,
                );
            } else if (b.ownerId !== 'DEVIL') {
                soundFX.playHitWall();
            }
            st.bullets.splice(i, 1);
            continue;
        }

        let hitPlacedObj = false;
        for (const obj of st.placedObjects) {
            if (obj.kind === 'barrel' && obj.hp > 0 && dist(b.x, b.y, obj.x, obj.y) <= obj.radius + b.radius) {
                obj.hp = 0;
                hitPlacedObj = true;
                break;
            } else if (obj.kind === 'wall' && obj.hp > 0 && dist(b.x, b.y, obj.x, obj.y) <= obj.radius + b.radius) {
                const fwSortY = obj.y + obj.h / 2;
                const hitNorthOfFakeWall = prevY < obj.y - 2 || b.y < obj.y - 2;
                const expSortY = hitNorthOfFakeWall ? fwSortY - 1.0 : fwSortY + 1.0;
                const expOccludeBelowY = hitNorthOfFakeWall ? obj.y + obj.h / 2 + 4 : undefined;
                if (b.blastRadius > 0) {
                    triggerExplosion(
                        ctx,
                        b.x,
                        b.y,
                        b.blastRadius,
                        b.damage,
                        b.knockback,
                        b.ownerId,
                        b.cluster,
                        now,
                        b.isGrenade ? b.z : 0,
                        expSortY,
                        expOccludeBelowY,
                    );
                } else {
                    const wallDamage = b.ownerId === 'DEVIL' ? 28 : b.damage;
                    obj.hp -= wallDamage;
                    spawnWallHitSmoke(st, b.x, b.y, Math.atan2(b.vy, b.vx), now, b.z, expSortY, hitNorthOfFakeWall);
                    soundFX.playHitWall();
                }
                hitPlacedObj = true;
                break;
            }
        }
        if (hitPlacedObj) {
            st.bullets.splice(i, 1);
            continue;
        }

        if (b.ownerId === 'DEVIL' || gameMode === 'DEATHMATCH_2P' || friendlyFire) {
            let hitPl = false;
            for (const p of st.players) {
                if (!p.isDowned && p.id !== b.ownerId && dist(b.x, b.y, p.x, p.y) <= p.radius + b.radius) {
                    hitPl = true;
                    if (b.blastRadius > 0) {
                        triggerExplosion(
                            ctx,
                            b.x,
                            b.y,
                            b.blastRadius,
                            b.damage,
                            b.knockback,
                            b.ownerId,
                            b.cluster,
                            now,
                            b.isGrenade ? b.z : 0,
                        );
                    } else {
                        const dmg = b.ownerId === 'DEVIL' ? b.damage : Math.round(b.damage * 0.45);
                        p.hp = Math.max(0, p.hp - dmg);
                        p.hurtUntil = now + 240;
                        const ang = Math.atan2(b.vy, b.vx);
                        applyKnockbackToPlayer(p, ang, b.knockback);
                        stampBloodOnFloorCanvas(floorCanvas, p.x, p.y, ang, 0.85);
                        spawn3DParticles(st, p.x, p.y, 14, ang, 'BLOOD', 3);
                        if (p.hp <= 0) {
                            p.isDowned = true;
                            p.downedAt = now;
                            soundFX.playPlayerDeathScream();
                            soundFX.playCreatureHitFloor();
                            if (gameMode === 'DEATHMATCH_2P') {
                                const killer = st.players.find((other) => other.id === b.ownerId);
                                if (killer) {
                                    killer.frags += 1;
                                    incrementPlayerCombo(st, roomId, killer, now);
                                }
                            }
                        } else {
                            soundFX.playPlayerScream();
                        }
                    }
                    break;
                }
            }
            if (hitPl) {
                st.bullets.splice(i, 1);
                continue;
            }
        }

        let hitEn = false;
        for (const en of st.enemies) {
            if (b.sourceEnemyId && en.id === b.sourceEnemyId) {
                continue;
            }
            if (dist(b.x, b.y, en.x, en.y) <= en.radius + b.radius) {
                hitEn = true;
                if (b.blastRadius > 0) {
                    triggerExplosion(
                        ctx,
                        b.x,
                        b.y,
                        b.blastRadius,
                        b.damage,
                        b.knockback,
                        b.ownerId,
                        b.cluster,
                        now,
                        b.isGrenade ? b.z : 0,
                    );
                } else {
                    const enemyDmg = b.ownerId === 'DEVIL' ? Math.max(b.damage, 14) : b.damage;
                    en.hp -= enemyDmg;
                    if (b.ownerId === 'P1' || b.ownerId === 'P2') {
                        en.lastAttackerId = b.ownerId;
                    }
                    en.hitFlashUntil = now + 75;
                    en.hurtUntil = now + 220;
                    const ang = Math.atan2(b.vy, b.vx);
                    applyKnockbackToEnemy(en, ang, b.knockback);
                    stampBloodOnFloorCanvas(floorCanvas, en.x, en.y, ang, 0.85);
                    spawn3DParticles(st, en.x, en.y, 15, ang, 'BLOOD', 3);
                }
                break;
            }
        }
        if (hitEn) {
            st.bullets.splice(i, 1);
        }
    }
}
