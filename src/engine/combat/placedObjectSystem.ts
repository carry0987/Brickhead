import { WEAPON_MAP } from '@/data/weaponCatalog';
import { dist } from '@/utils/battleGeometry';
import { soundFX } from '@/utils/sound';
import { PLACEABLE_SPECS } from '../tuning/placeableTuning';
import type { CombatContext } from './combatContext';
import { triggerExplosion } from './explosionSystem';

export function updatePlacedObjects(ctx: CombatContext, now: number): void {
    const { st, gameMode } = ctx;
    for (let i = st.placedObjects.length - 1; i >= 0; i--) {
        const obj = st.placedObjects[i];
        if (obj.kind === 'mine' && !obj.armed && now - obj.createdAt >= PLACEABLE_SPECS.mine.armDelayMs) {
            obj.armed = true;
        }

        if (obj.kind === 'mine' && obj.triggeredAt && now - obj.triggeredAt >= PLACEABLE_SPECS.mine.triggerDelayMs) {
            obj.hp = 0;
        }

        if (gameMode === 'DEATHMATCH_2P' && obj.kind === 'mine' && obj.armed && !obj.triggeredAt) {
            st.players.forEach((p) => {
                if (p.id !== obj.ownerId && !p.isDowned && dist(p.x, p.y, obj.x, obj.y) < 34) {
                    obj.triggeredAt = now;
                    soundFX.playMineDetonate();
                }
            });
        }

        if (obj.hp <= 0) {
            st.placedObjects.splice(i, 1);
            if (obj.kind === 'barrel' || obj.kind === 'mine' || obj.kind === 'charge_pack') {
                triggerExplosion(
                    ctx,
                    obj.x,
                    obj.y,
                    obj.blastRadius,
                    obj.damage,
                    WEAPON_MAP[obj.kind]?.knockback ?? 50,
                    obj.ownerId,
                    obj.cluster,
                    now,
                );
            } else if (obj.kind === 'wall') {
                soundFX.playHitWall();
                st.wallSmokePuffs.push({
                    id: `fwsmoke-${now}-${i}-${Math.random()}`,
                    x: obj.x,
                    y: obj.y,
                    z: 0,
                    vx: 0,
                    vy: 0,
                    vz: 0,
                    startRadius: 19.2,
                    endRadius: 38.4,
                    createdAt: now,
                    durationMs: 500,
                    shade: '#999999',
                    sortY: obj.y + obj.h / 2,
                    effectId: 'fake_wall_smoke',
                });
            }
        }
    }
}
