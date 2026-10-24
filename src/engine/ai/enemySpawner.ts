import type { EnemyKind, RoomSpec } from '@/types/game';
import { circleRectCollide, clamp, dist } from '@/utils/battleGeometry';
import type { BattleEngineState, RoomBounds } from '../battleTypes';
import { ENEMY_SCALING, ENEMY_SPECS } from '../tuning/enemyTuning';
export function spawnEnemyFromNode(
    st: BattleEngineState,
    room: RoomSpec,
    roomBounds: RoomBounds,
    worldW: number,
    diffMult: number,
    kind: EnemyKind,
    waveNum: number,
): void {
    const isDevil = kind === 'devil';
    const spec = ENEMY_SPECS[kind];

    const devilNodes = room.spawnNodes.filter((n) => n.kind === 'D');
    const zombieNodes = room.spawnNodes.filter((n) => n.kind === 'Z');

    const pool =
        isDevil && devilNodes.length > 0
            ? devilNodes
            : zombieNodes.length > 0
              ? zombieNodes
              : [{ kind: 'Z' as const, x: worldW / 2, y: roomBounds.y + 24 }];

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const radius = spec.radius;
    const spawnAng = Math.random() * Math.PI * 2;
    const spawnDist = Math.random() * 8;
    let x = chosen.x + Math.cos(spawnAng) * spawnDist;
    let y = chosen.y + Math.sin(spawnAng) * spawnDist;

    // Nudge newly spawned enemy away from any existing enemy still standing on the spawn node
    for (let i = 0; i < st.enemies.length; i++) {
        const other = st.enemies[i];
        const d = dist(x, y, other.x, other.y);
        const minSep = (radius + other.radius) * 0.75;
        if (d < minSep) {
            const pushAng = d > 0.001 ? Math.atan2(y - other.y, x - other.x) : spawnAng;
            x = other.x + Math.cos(pushAng) * minSep;
            y = other.y + Math.sin(pushAng) * minSep;
        }
    }

    // Ensure spawned enemy is pushed clear of any adjacent room obstacle (using 14px wall footprint so 32px corridors work)
    const spawnWallRadius = Math.min(radius, 14);
    for (const obs of room.obstacles) {
        const col = circleRectCollide(x, y, spawnWallRadius + 1, obs.x, obs.y, obs.w, obs.h);
        if (col.hit) {
            x += col.nx * col.overlap;
            y += col.ny * col.overlap;
        }
    }

    x = clamp(x, roomBounds.x + spawnWallRadius, roomBounds.x + roomBounds.w - spawnWallRadius);
    y = clamp(y, roomBounds.y + spawnWallRadius, roomBounds.y + roomBounds.h - spawnWallRadius);

    const hpMult = (1 + (waveNum - 1) * ENEMY_SCALING.hpPerWave) * diffMult;
    const speedJitter = spec.speedJitter.min + Math.random() * (spec.speedJitter.max - spec.speedJitter.min);
    const maxHp = Math.round(spec.baseHp * hpMult);

    st.enemies.push({
        id: `en-${performance.now()}-${Math.random()}`,
        kind,
        x,
        y,
        vx: 0,
        vy: 0,
        radius,
        angle: 0,
        hp: maxHp,
        maxHp,
        speed:
            spec.baseSpeed *
            Math.min(ENEMY_SCALING.maxSpeedMultiplier, 1 + waveNum * ENEMY_SCALING.speedPerWave) *
            speedJitter,
        damage: Math.round(spec.baseDamage * diffMult),
        scoreValue: spec.scoreValue,
        walkCycle: Math.random() * 10,
        lastAttackTime: 0,
        lastFireballTime: 0,
        hitFlashUntil: 0,
        shirtBloodSeed: Math.floor(Math.random() * 100),
        massKg: spec.massKg,
        hurtUntil: 0,
    });
}
