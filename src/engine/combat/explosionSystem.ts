import { WEAPON_MAP } from '@/data/weaponCatalog';
import type { BlastDamageMode, PlacedObject, RoomSpec } from '@/types/game';
import { dist } from '@/utils/battleGeometry';
import { spawn3DParticles, stampBloodOnFloorCanvas, stampScorchOnFloorCanvas } from '@/utils/floorDecalRenderer';
import { soundFX } from '@/utils/sound';
import { EXPLOSION_TUNING } from '../tuning/explosionTuning';
import type { CombatContext } from './combatContext';
import { applyKnockbackToEnemy, applyKnockbackToPlayer, incrementPlayerCombo } from './weaponProgression';

function resolveExplosionDepthSort(
    room: RoomSpec,
    placedObjects: PlacedObject[],
    x: number,
    y: number,
    explicitSortY?: number,
    explicitOccludeBelowY?: number,
): { sortY: number; occludeBelowY?: number } {
    let sortY = explicitSortY ?? y + 0.5;
    let occludeBelowY = explicitOccludeBelowY;

    for (const obs of room.obstacles) {
        if (x + 28 >= obs.x && x - 28 <= obs.x + obs.w) {
            if (y <= obs.y + 4 && y >= obs.y - 52) {
                sortY = Math.min(sortY, obs.y - 0.5);
                const wallFrontY = obs.y + obs.h - 1;
                occludeBelowY = occludeBelowY !== undefined ? Math.min(occludeBelowY, wallFrontY) : wallFrontY;
            } else if (explicitSortY === undefined && y >= obs.y + obs.h - 4 && y <= obs.y + obs.h + 44) {
                sortY = Math.max(sortY, obs.y + obs.h + 1.0);
            }
        }
    }

    for (const obj of placedObjects) {
        if (obj.kind === 'wall' && obj.hp > 0) {
            if (Math.abs(x - obj.x) <= obj.w / 2 + 24) {
                const fwSortY = obj.y + obj.h / 2;
                if (y < obj.y && y >= obj.y - 48) {
                    sortY = Math.min(sortY, fwSortY - 1.0);
                    const fwFrontY = obj.y + obj.h / 2 + 4;
                    occludeBelowY = occludeBelowY !== undefined ? Math.min(occludeBelowY, fwFrontY) : fwFrontY;
                } else if (explicitSortY === undefined && y >= obj.y && y <= obj.y + 48) {
                    sortY = Math.max(sortY, fwSortY + 1.0);
                }
            }
        }
    }

    return { sortY, occludeBelowY };
}

export function triggerExplosion(
    ctx: CombatContext,
    x: number,
    y: number,
    radius: number,
    damage: number,
    knockbackForceNT: number,
    ownerId: 'P1' | 'P2' | 'DEVIL',
    spawnClusters: boolean,
    now: number,
    z = 0,
    explicitSortY?: number,
    explicitOccludeBelowY?: number,
): void {
    const { st, floorCanvas, room, roomId, gameMode, explosionPlayerDamage } = ctx;
    const isMidAir = z > 8;
    soundFX.playExplosion(radius / 100);
    st.screenShake = Math.min(
        EXPLOSION_TUNING.screenShake.maximum,
        st.screenShake + EXPLOSION_TUNING.screenShake.increase,
    );
    // Unify floor scorch mark size to match map barrel base blastRadius (60) even when Big Bang / Bigger Bang perks increase shockwave radius
    stampScorchOnFloorCanvas(floorCanvas, x, y, WEAPON_MAP.barrel.blastRadius, isMidAir);

    const depth = resolveExplosionDepthSort(room, st.placedObjects, x, y, explicitSortY, explicitOccludeBelowY);

    st.explosions.push({
        id: `exp-${now}-${Math.random()}`,
        x,
        y,
        z: isMidAir ? z : 0,
        isMidAir,
        maxRadius: radius,
        createdAt: now,
        durationMs: EXPLOSION_TUNING.durationMs,
        sortY: depth.sortY,
        occludeBelowY: depth.occludeBelowY,
    });

    if (spawnClusters) {
        for (let c = 0; c < EXPLOSION_TUNING.cluster.count; c++) {
            const ang =
                (c * Math.PI * 2) / EXPLOSION_TUNING.cluster.count +
                Math.random() * EXPLOSION_TUNING.cluster.angleJitterRad;
            st.bullets.push({
                id: `clust-${now}-${c}-${Math.random()}`,
                ownerId,
                weaponId: 'grenade',
                x,
                y,
                vx: Math.cos(ang) * EXPLOSION_TUNING.cluster.speed,
                vy: Math.sin(ang) * EXPLOSION_TUNING.cluster.speed,
                z: 12,
                vz: EXPLOSION_TUNING.cluster.verticalSpeed,
                radius: EXPLOSION_TUNING.cluster.radius,
                damage: Math.round(damage * EXPLOSION_TUNING.cluster.damageMultiplier),
                knockback: EXPLOSION_TUNING.cluster.knockback,
                blastRadius: EXPLOSION_TUNING.cluster.blastRadius,
                cluster: false,
                isGrenade: true,
                spawnTime: now,
                fuseMs: EXPLOSION_TUNING.cluster.fuseMs,
            });
        }
    }

    st.enemies.forEach((en) => {
        const d = dist(x, y, en.x, en.y);
        if (d <= radius + en.radius) {
            const ratio = Math.max(
                EXPLOSION_TUNING.falloff.minimumDamageRatio,
                1 - d / (radius + en.radius + EXPLOSION_TUNING.falloff.radiusPadding),
            );
            const dmg = Math.round(damage * ratio);
            en.hp -= dmg;
            if (ownerId === 'P1' || ownerId === 'P2') {
                en.lastAttackerId = ownerId;
            }
            en.hitFlashUntil = now + 100;
            en.hurtUntil = now + 220;
            const ang = d > 0.001 ? Math.atan2(en.y - y, en.x - x) : en.angle + Math.PI;
            applyKnockbackToEnemy(en, ang, knockbackForceNT);
            stampBloodOnFloorCanvas(floorCanvas, en.x, en.y, ang, 1.3);
            spawn3DParticles(st, en.x, en.y, 14, ang, 'GIB', 5);
        }
    });

    const effectiveBlastMode: BlastDamageMode =
        gameMode === 'DEATHMATCH_2P' && explosionPlayerDamage === 'OFF' ? 'TEN_PERCENT' : explosionPlayerDamage;

    const blastAffectsPlayers = effectiveBlastMode !== 'OFF' || ownerId === 'DEVIL';

    if (blastAffectsPlayers) {
        const playerDmgScale =
            effectiveBlastMode === 'TEN_PERCENT'
                ? EXPLOSION_TUNING.playerDamage.tenPercentModeScale
                : EXPLOSION_TUNING.playerDamage.normalScale;
        st.players.forEach((p) => {
            const d = dist(x, y, p.x, p.y);
            if (!p.isDowned && d <= radius + p.radius) {
                const ratio = Math.max(
                    EXPLOSION_TUNING.falloff.minimumDamageRatio,
                    1 - d / (radius + p.radius + EXPLOSION_TUNING.falloff.radiusPadding),
                );
                const dmg =
                    ownerId === 'DEVIL'
                        ? EXPLOSION_TUNING.playerDamage.devilDamage
                        : Math.max(1, Math.round(damage * playerDmgScale * ratio));
                p.hp = Math.max(0, p.hp - dmg);
                p.hurtUntil = now + 240;
                const ang = d > 0.001 ? Math.atan2(p.y - y, p.x - x) : p.angle + Math.PI;
                applyKnockbackToPlayer(p, ang, knockbackForceNT);
                stampBloodOnFloorCanvas(floorCanvas, p.x, p.y, ang, 0.9);
                if (p.hp <= 0) {
                    p.isDowned = true;
                    p.downedAt = now;
                    soundFX.playPlayerDeathScream();
                    soundFX.playCreatureHitFloor();
                    if (gameMode === 'DEATHMATCH_2P') {
                        const killer = st.players.find((other) => other.id !== p.id);
                        if (killer) {
                            killer.frags += 1;
                            incrementPlayerCombo(st, roomId, killer, now);
                        }
                    }
                } else {
                    soundFX.playPlayerScream();
                }
            }
        });
    }

    // Explosions chain-detonate Barrels & Charge Packs, damage Fake Walls, and NEVER detonate Claymore Mines!
    st.placedObjects.forEach((obj) => {
        if (obj.hp <= 0) return;
        const d = dist(x, y, obj.x, obj.y);
        if ((obj.kind === 'barrel' || obj.kind === 'charge_pack') && d <= radius) {
            obj.hp = 0;
        } else if (obj.kind === 'wall' && d <= radius + obj.radius) {
            const ratio = Math.max(
                EXPLOSION_TUNING.falloff.minimumDamageRatio,
                1 - d / (radius + obj.radius + EXPLOSION_TUNING.falloff.radiusPadding),
            );
            obj.hp -= Math.round((damage > 0 ? damage : 65) * ratio);
        }
    });
}
