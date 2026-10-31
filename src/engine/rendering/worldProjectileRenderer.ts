import { clamp } from '@/utils/battleGeometry';
import { drawBBModelAsset3D } from '@/utils/rendering/isoEquipmentRenderer';
import { ISO_Z_SCALE } from '@/utils/rendering/isoModelRenderer';
import {
    drawBoxheadExplosionDome,
    drawFakeWallSmokeFrameOnCanvas,
    drawRocketSmokeFrameOnCanvas,
} from '@/utils/svgEffectRenderer';
import type { BattleEngineState } from '../battleTypes';
import { splitBeamByDepth } from './beamDepthSegments';
import type { WorldRenderItem, WorldVisibleBounds } from './worldRenderQueue';

export function enqueueWorldProjectiles(
    ctx: CanvasRenderingContext2D,
    st: BattleEngineState,
    visible: WorldVisibleBounds,
    renderQueue: WorldRenderItem[],
    now: number,
): void {
    const { left: visLeft, right: visRight, top: visTop } = visible;
    // Split railgun beams at depth changes so a single wall cannot hide the entire beam.
    const sceneDepths = renderQueue.map((item) => item.sortY);
    st.beams.forEach((bm) => {
        const segments =
            bm.depthStartY !== undefined && bm.depthEndY !== undefined
                ? splitBeamByDepth(bm.depthStartY, bm.depthEndY, sceneDepths)
                : [{ start: 0, end: 1, sortY: bm.sortY ?? Math.max(bm.y1, bm.y2) }];
        for (const segment of segments) {
            const x1 = bm.x1 + (bm.x2 - bm.x1) * segment.start;
            const y1 = bm.y1 + (bm.y2 - bm.y1) * segment.start;
            const x2 = bm.x1 + (bm.x2 - bm.x1) * segment.end;
            const y2 = bm.y1 + (bm.y2 - bm.y1) * segment.end;
            renderQueue.push({
                sortY: segment.sortY,
                draw: () => {
                    const p = (now - bm.createdAt) / bm.durationMs;
                    ctx.save();
                    ctx.globalAlpha = clamp(1 - p, 0, 1);
                    if (bm.isBulletTrail) {
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
                        ctx.lineWidth = bm.width ?? 1.8;
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    } else {
                        ctx.strokeStyle = bm.color;
                        ctx.lineWidth = 10 * (1 - p * 0.5);
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();

                        ctx.strokeStyle = '#ffffff';
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.moveTo(x1, y1);
                        ctx.lineTo(x2, y2);
                        ctx.stroke();
                    }
                    ctx.restore();
                },
            });
        }
    });

    // Authentic 6-Frame Boxhead Smoke Puffs (`DefineSprite_580_Effect.RocketSmoke`) & 15-Frame Fake Wall Collapse Smoke (`DefineSprite_626`) inside 2.5D renderQueue
    st.wallSmokePuffs.forEach((sp) => {
        const smokeSortY = sp.sortY ?? sp.y + 0.5;
        renderQueue.push({
            sortY: smokeSortY,
            draw: () => {
                const p = clamp((now - sp.createdAt) / sp.durationMs, 0, 1);
                const curR = sp.startRadius + (sp.endRadius - sp.startRadius) * p;
                const drawY = sp.y - sp.z * ISO_Z_SCALE;
                const drewSvg =
                    sp.effectId === 'fake_wall_smoke'
                        ? drawFakeWallSmokeFrameOnCanvas(ctx, sp.x, drawY, p, 0.8)
                        : drawRocketSmokeFrameOnCanvas(ctx, sp.x, drawY, p, curR * 1.45, 1.0);
                if (!drewSvg) {
                    ctx.save();
                    ctx.globalAlpha = (1 - p) * 0.72;
                    ctx.fillStyle = sp.shade;
                    ctx.beginPath();
                    ctx.arc(sp.x, drawY, curR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.strokeStyle = 'rgba(87, 83, 78, 0.45)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.restore();
                }
            },
        });
    });

    // Airborne 3D Particles inside 2.5D renderQueue
    st.particles3D.forEach((pt) => {
        renderQueue.push({
            sortY: pt.y,
            draw: () => {
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                ctx.fillRect(pt.x - 1, pt.y - 1, 2.5, 2.5);
                ctx.fillStyle = pt.color;
                ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.z * ISO_Z_SCALE - pt.size / 2, pt.size, pt.size);
            },
        });
    });

    // Projectiles (Rockets, Hand Grenades, Cluster Bombs, Devil Fireballs) inside 2.5D renderQueue (Option A depth occlusion)
    st.bullets.forEach((b) => {
        renderQueue.push({
            sortY: b.sortY ?? b.y,
            draw: () => {
                ctx.fillStyle = 'rgba(0,0,0,0.24)';
                ctx.beginPath();
                ctx.ellipse(b.x, b.y, b.radius * 0.9, b.radius * 0.5, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.save();
                ctx.translate(b.x, b.y - b.z * ISO_Z_SCALE);
                if (b.ownerId === 'DEVIL') {
                    ctx.fillStyle = 'rgba(245, 158, 11, 0.45)';
                    ctx.beginPath();
                    ctx.arc(0, 0, b.radius * 1.65, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#fde047';
                    ctx.strokeStyle = '#ea580c';
                    ctx.lineWidth = 2.2;
                    ctx.beginPath();
                    ctx.arc(0, 0, b.radius * 1.15, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                } else if (b.weaponId === 'grenade') {
                    drawBBModelAsset3D(ctx, 'grenade', 0, 0, now * 0.008, 0, 0.85);
                } else if (b.weaponId === 'rocket') {
                    const flyAng = Math.atan2(b.vy, b.vx);
                    ctx.rotate(flyAng);

                    if (!drawRocketSmokeFrameOnCanvas(ctx, -16, 0, 0.15, 14, 0.9)) {
                        ctx.fillStyle = 'rgba(168, 162, 158, 0.55)';
                        ctx.beginPath();
                        ctx.arc(-14, 0, 5.5, 0, Math.PI * 2);
                        ctx.arc(-21, (Math.random() - 0.5) * 3, 4.2, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.fillStyle = '#f97316';
                    ctx.beginPath();
                    ctx.moveTo(-4, -3.5);
                    ctx.lineTo(-13, 0);
                    ctx.lineTo(-4, 3.5);
                    ctx.closePath();
                    ctx.fill();

                    ctx.fillStyle = '#fef08a';
                    ctx.beginPath();
                    ctx.arc(-5, 0, 2.6, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#3f3f46';
                    ctx.strokeStyle = '#09090b';
                    ctx.lineWidth = 1.6;
                    ctx.fillRect(-5, -2.6, 7, 5.2);
                    ctx.strokeRect(-5, -2.6, 7, 5.2);

                    ctx.fillStyle = '#dc2626';
                    ctx.beginPath();
                    ctx.moveTo(2, -3.2);
                    ctx.lineTo(8.5, 0);
                    ctx.lineTo(2, 3.2);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
                    ctx.fillStyle = '#18181b';
                    ctx.fill();
                }
                ctx.restore();
            },
        });
    });

    // Authentic 18-Frame Boxhead Explosion (DefineSprite_568 Ground & DefineSprite_573 MidAir) inside 2.5D renderQueue (Option A depth occlusion)
    st.explosions.forEach((ex) => {
        const p = (now - ex.createdAt) / ex.durationMs;
        if (p >= 0 && p < 1) {
            renderQueue.push({
                sortY: ex.sortY ?? ex.y + 0.5,
                draw: () => {
                    if (ex.occludeBelowY !== undefined) {
                        ctx.save();
                        ctx.beginPath();
                        ctx.rect(
                            visLeft - 300,
                            visTop - 300,
                            visRight - visLeft + 600,
                            Math.max(0, ex.occludeBelowY - (visTop - 300)),
                        );
                        ctx.clip();
                        drawBoxheadExplosionDome(ctx, ex.x, ex.y, ex.maxRadius, p, Boolean(ex.isMidAir), ex.z ?? 0);
                        ctx.restore();
                    } else {
                        drawBoxheadExplosionDome(ctx, ex.x, ex.y, ex.maxRadius, p, Boolean(ex.isMidAir), ex.z ?? 0);
                    }
                },
            });
        }
    });
}
