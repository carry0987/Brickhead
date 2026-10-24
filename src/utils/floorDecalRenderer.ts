import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/data/gameCatalog';
import type { BattleEngineState, Particle3D, RoomBounds } from '@/engine/battleTypes';
import type { RoomSpec } from '@/types/game';
import { drawSwfFloorStain } from './rendering/isoObstacleRenderer';
import { drawScorchMarkSvgOnCanvas } from './svgEffectRenderer';

export function initFloorBitmapOnCanvas(
    floorCanvas: HTMLCanvasElement,
    targetRoom: RoomSpec,
    fallbackWorldW: number,
    fallbackWorldH: number,
    fallbackBounds: RoomBounds,
): void {
    const w = targetRoom.worldWidth || fallbackWorldW;
    const h = targetRoom.worldHeight || fallbackWorldH;
    const b = targetRoom.bounds || fallbackBounds;
    floorCanvas.width = w;
    floorCanvas.height = h;
    const fCtx = floorCanvas.getContext('2d');
    if (!fCtx) return;

    // 1. Classic Boxhead Warm Sand-Beige Arena Floor (#sprite0)
    fCtx.fillStyle = targetRoom.floorColor || '#ebdcc7';
    fCtx.fillRect(0, 0, w, h);

    // 2. Authentic SWF Organic Floor Stain (#sprite1 / #shape1)
    drawSwfFloorStain(fCtx, b, targetRoom.patchColor || '#d8cccc', targetRoom.stainTransforms);
}

export function stampBloodOnFloorCanvas(
    floorCanvas: HTMLCanvasElement | null,
    x: number,
    y: number,
    dirAngle: number,
    scale: number = 1,
): void {
    const fCtx = floorCanvas?.getContext('2d');
    if (!fCtx) return;
    fCtx.save();
    fCtx.globalAlpha = 0.72;
    fCtx.fillStyle = '#991b1b';
    fCtx.beginPath();
    fCtx.ellipse(x, y, 8 * scale, 5.5 * scale, 0, 0, Math.PI * 2);
    fCtx.fill();

    // Directional splatter droplets along bullet impact vector
    const cos = Math.cos(dirAngle);
    const sin = Math.sin(dirAngle);
    for (let i = 0; i < 4; i++) {
        const distOut = (4 + Math.random() * 18) * scale;
        const spread = (Math.random() - 0.5) * 14 * scale;
        const bx = x + cos * distOut - sin * spread;
        const by = y + sin * distOut + cos * spread;
        fCtx.fillStyle = i % 2 === 0 ? '#b91c1c' : '#7f1d1d';
        fCtx.beginPath();
        fCtx.ellipse(bx, by, (2 + Math.random() * 4.5) * scale, (1.5 + Math.random() * 3) * scale, 0, 0, Math.PI * 2);
        fCtx.fill();
    }
    fCtx.restore();
}

export function stampScorchOnFloorCanvas(
    floorCanvas: HTMLCanvasElement | null,
    x: number,
    y: number,
    radius: number,
    isMidAir: boolean = false,
): void {
    const fCtx = floorCanvas?.getContext('2d');
    if (!fCtx) return;
    drawScorchMarkSvgOnCanvas(fCtx, x, y, radius, isMidAir);
}

export function stampParticleOnFloorCanvas(
    st: BattleEngineState,
    floorCanvas: HTMLCanvasElement | null,
    pt: Particle3D,
    now: number,
): void {
    // Shell casings stay on the floor for 5s and then disappear to free resources!
    if (pt.kind === 'SHELL') {
        st.shellCasings.push({
            id: `shell-${now}-${Math.random()}`,
            x: pt.x,
            y: pt.y,
            angle: Math.atan2(pt.vy, pt.vx),
            isShotgun: false,
            createdAt: now,
        });
        return;
    }

    const fCtx = floorCanvas?.getContext('2d');
    if (!fCtx) return;
    fCtx.save();
    fCtx.globalAlpha = 0.75;
    fCtx.fillStyle = pt.color;
    fCtx.beginPath();
    fCtx.ellipse(pt.x, pt.y, pt.size, pt.size * 0.7, 0, 0, Math.PI * 2);
    fCtx.fill();
    fCtx.restore();
}

export function spawn3DParticles(
    st: BattleEngineState,
    x: number,
    y: number,
    z: number,
    dirAngle: number,
    kind: 'BLOOD' | 'SHELL' | 'GIB',
    count: number,
): void {
    for (let i = 0; i < count; i++) {
        const ang =
            kind === 'SHELL'
                ? dirAngle + Math.PI / 2 + (Math.random() - 0.5) * 0.5
                : dirAngle + (Math.random() - 0.5) * 1.4;
        const spd = kind === 'SHELL' ? 2 + Math.random() * 2.5 : 1.5 + Math.random() * 5.2;
        st.particles3D.push({
            x,
            y,
            z: z + Math.random() * 6,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            vz: kind === 'SHELL' ? 3 + Math.random() * 2 : 2 + Math.random() * 4.5,
            size: kind === 'GIB' ? 3.8 : kind === 'BLOOD' ? 2.6 : 2.2,
            color: kind === 'SHELL' ? '#facc15' : Math.random() < 0.5 ? '#dc2626' : '#991b1b',
            kind,
            bounces: 0,
        });
    }
    if (st.particles3D.length > 140) {
        st.particles3D.splice(0, st.particles3D.length - 140);
    }
}

export function spawnWallHitSmoke(
    st: BattleEngineState,
    x: number,
    y: number,
    impactAngle: number,
    now: number,
    muzzleZ = 21.6,
    sortY?: number,
    occludedBySouthWall = false,
): void {
    const bounceAng = impactAngle + Math.PI;
    const shades = ['#e7e5e4', '#d6d3d1', '#a8a29e'];
    const puffCount = 2;
    for (let i = 0; i < puffCount; i++) {
        const ang = bounceAng + (Math.random() - 0.5) * 0.9;
        const spd = 0.08 + Math.random() * 0.16;
        // When hitting the north/back face of a southern wall, the impact point is behind the 3D wall roof;
        // raising z slightly lets only the upper wisps of smoke peek above the wall's top edge while the wall occludes the rest.
        const baseZ = occludedBySouthWall
            ? 31.5 + i * 2.2 + (Math.random() - 0.5) * 1.5
            : muzzleZ + (Math.random() - 0.5) * 1.0;
        st.wallSmokePuffs.push({
            id: `wsmoke-${now}-${i}-${Math.random()}`,
            x: x + (Math.random() - 0.5) * 1.5,
            y: y + (Math.random() - 0.5) * 1.5,
            z: baseZ,
            vx: Math.cos(ang) * spd,
            vy: occludedBySouthWall ? -Math.abs(Math.sin(ang)) * spd : Math.sin(ang) * spd,
            vz: occludedBySouthWall ? 0.16 + Math.random() * 0.14 : 0.08 + Math.random() * 0.12,
            startRadius: 3.6 + i * 1.4,
            endRadius: 9.5 + i * 2.5,
            createdAt: now,
            durationMs: 260 + i * 60,
            shade: shades[i % shades.length],
            sortY: sortY ?? (occludedBySouthWall ? y - 0.5 : y + 0.8),
        });
    }
    if (st.wallSmokePuffs.length > 110) {
        st.wallSmokePuffs.splice(0, st.wallSmokePuffs.length - 110);
    }
}

/**
 * Pushes a message to the Bottom Stacked Notification Feed:
 * - New messages appear at the bottom and push older messages upward.
 * - At most three messages remain active; older entries immediately fade upward.
 */
export function addBannerToEngine(
    st: BattleEngineState,
    _x: number,
    _y: number,
    text: string,
    color: string = '#ffffff',
    subText?: string,
): void {
    const now = performance.now();
    const durationMs = 3000;
    const fadeWindowMs = 380;

    st.banners.push({
        id: `bn-${now}-${Math.random()}`,
        x: CANVAS_WIDTH / 2,
        y: CANVAS_HEIGHT - 22,
        text: subText ? `${text} · ${subText}` : text,
        color,
        createdAt: now,
        durationMs,
        isGlobalBanner: true,
    });

    // Enforce max 3 solid messages: any message older than the newest 3 starts fading out upward immediately
    const nonFading = st.banners.filter((b) => now - b.createdAt < b.durationMs - fadeWindowMs);
    if (nonFading.length > 3) {
        const overflowCount = nonFading.length - 3;
        for (let i = 0; i < overflowCount; i++) {
            const oldBanner = nonFading[i];
            oldBanner.createdAt = now - (oldBanner.durationMs - fadeWindowMs);
        }
    }
}
