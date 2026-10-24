import type { RoomSpec } from '@/types/game';
import { drawBBModelAsset3D } from '@/utils/rendering/isoEquipmentRenderer';
import {
    drawExtrudedBlock,
    drawExtrudedBlockShadow,
    type ExtrudedBlockNeighborFlags,
} from '@/utils/rendering/isoObstacleRenderer';
import type { BattleEngineState } from '../battleTypes';
import type { WorldRenderItem, WorldVisibleBounds } from './worldRenderQueue';

export function renderWorldObstacleBackground(
    ctx: CanvasRenderingContext2D,
    room: RoomSpec,
    worldW: number,
    worldH: number,
    visible: WorldVisibleBounds,
): void {
    const { left: visLeft, right: visRight, top: visTop, bottom: visBottom } = visible;
    // 2. Dedicated Floor-Layer Shadow Pass for all Room Obstacles
    // Drawing all obstacle cast shadows on the floor before any 3D wall/pillar bodies ensures
    // floor shadows never overlap or darken adjacent white horizontal walls or neighboring pillars.
    room.obstacles.forEach((obs) => {
        if (obs.x + obs.w < visLeft || obs.x > visRight || obs.y + obs.h < visTop || obs.y > visBottom) {
            return;
        }
        drawExtrudedBlockShadow(ctx, obs.x, obs.y, obs.w, obs.h, obs.style || 'classic_blue');
    });

    // 3. Optional Outer Perimeter 3D Walls (for classic enclosed rooms)
    const doorGapH = 220;
    const doorGapV = 200;
    const topSideW = (worldW - doorGapH) / 2;
    const leftSideH = (worldH - doorGapV) / 2;

    if (room.hasPerimeterWalls) {
        drawExtrudedBlock(
            ctx,
            0,
            0,
            topSideW,
            24,
            34,
            room.wallTopColor,
            room.wallSideColor,
            '#000000',
            true,
            'classic_blue',
            room.wallBevelColor,
        );
        drawExtrudedBlock(
            ctx,
            worldW - topSideW,
            0,
            topSideW,
            24,
            34,
            room.wallTopColor,
            room.wallSideColor,
            '#000000',
            true,
            'classic_blue',
            room.wallBevelColor,
        );
        drawExtrudedBlock(
            ctx,
            0,
            0,
            24,
            leftSideH,
            34,
            room.wallTopColor,
            room.wallSideColor,
            '#000000',
            true,
            'pyramid_pillar',
            room.wallBevelColor,
        );
        drawExtrudedBlock(
            ctx,
            0,
            worldH - leftSideH,
            24,
            leftSideH,
            34,
            room.wallTopColor,
            room.wallSideColor,
            '#000000',
            true,
            'pyramid_pillar',
            room.wallBevelColor,
        );
        drawExtrudedBlock(
            ctx,
            worldW - 24,
            0,
            24,
            leftSideH,
            34,
            room.wallTopColor,
            room.wallSideColor,
            '#000000',
            true,
            'pyramid_pillar',
            room.wallBevelColor,
        );
        drawExtrudedBlock(
            ctx,
            worldW - 24,
            worldH - leftSideH,
            24,
            leftSideH,
            34,
            room.wallTopColor,
            room.wallSideColor,
            '#000000',
            true,
            'pyramid_pillar',
            room.wallBevelColor,
        );
    }
}

export function enqueueWorldObstacles(
    ctx: CanvasRenderingContext2D,
    st: BattleEngineState,
    room: RoomSpec,
    visible: WorldVisibleBounds,
    obstacleNeighborMap: Map<number, ExtrudedBlockNeighborFlags>,
    renderQueue: WorldRenderItem[],
    now: number,
): void {
    const { left: visLeft, right: visRight, top: visTop, bottom: visBottom } = visible;
    // Red Pickup Crates (`red_box`) — sorted ahead of north walls so walls above a crate never occlude it,
    // while keeping sortY slightly behind standing entities at the same Y so players/zombies walk over crates
    for (let i = 0; i < st.redBoxes.length; i++) {
        const box = st.redBoxes[i];
        if (box.x < visLeft || box.x > visRight || box.y < visTop || box.y > visBottom) {
            continue;
        }
        renderQueue.push({
            sortY: box.y - 10,
            draw: () => {
                drawBBModelAsset3D(ctx, 'red_box', box.x, box.y, 0, 0, 1.0);
            },
        });
    }

    // Room Inner Pillars & Maze Walls (castShadow = false because floor shadows were drawn in Step 2)
    room.obstacles.forEach((obs, obsIdx) => {
        if (obs.x + obs.w < visLeft || obs.x > visRight || obs.y + obs.h < visTop || obs.y > visBottom) {
            return;
        }
        const neighborFlags = obstacleNeighborMap.get(obsIdx);
        renderQueue.push({
            sortY: obs.y + obs.h - (obs.style === 'pyramid_pillar' ? 0 : 0.5),
            draw: () => {
                drawExtrudedBlock(
                    ctx,
                    obs.x,
                    obs.y,
                    obs.w,
                    obs.h,
                    42,
                    room.wallTopColor,
                    room.wallSideColor,
                    '#000000',
                    false,
                    obs.style || 'classic_blue',
                    room.wallBevelColor,
                    neighborFlags,
                );
            },
        });
    });

    // Placed Equipment: Mines (`mine`), Charge Packs (`charge_pack`), Fake Walls (`wall`), & Barrels (`barrel`)
    st.placedObjects.forEach((obj) => {
        if (obj.x < visLeft || obj.x > visRight || obj.y < visTop || obj.y > visBottom) {
            return;
        }
        if (obj.kind === 'mine') {
            renderQueue.push({
                sortY: obj.y - 6,
                draw: () => {
                    drawBBModelAsset3D(ctx, 'mine', obj.x, obj.y, 0, 0, 1.0, {
                        isTriggered: Boolean(obj.triggeredAt),
                        nowMs: now,
                    });
                },
            });
        } else if (obj.kind === 'charge_pack') {
            renderQueue.push({
                sortY: obj.y - 6,
                draw: () => {
                    drawBBModelAsset3D(ctx, 'charge_pack', obj.x, obj.y, 0, 0, 1.0, {
                        nowMs: now,
                    });
                },
            });
        } else if (obj.kind === 'wall') {
            renderQueue.push({
                sortY: obj.y + obj.h / 2,
                draw: () => {
                    drawBBModelAsset3D(ctx, 'wall', obj.x, obj.y, 0, 0, 1.0, {
                        damageRatio: obj.hp / Math.max(1, obj.maxHp),
                    });
                },
            });
        } else if (obj.kind === 'barrel') {
            renderQueue.push({
                sortY: obj.y + 6,
                draw: () => {
                    drawBBModelAsset3D(ctx, 'barrel', obj.x, obj.y, 0, 0, 1.0);
                },
            });
        }
    });
}

export function enqueueWorldBottomPerimeter(
    ctx: CanvasRenderingContext2D,
    room: RoomSpec,
    worldW: number,
    worldH: number,
    renderQueue: WorldRenderItem[],
): void {
    const doorGapH = 220;
    const topSideW = (worldW - doorGapH) / 2;
    // Optional Bottom Outer Perimeter 3D Walls inside 2.5D renderQueue
    if (room.hasPerimeterWalls) {
        renderQueue.push({
            sortY: worldH - 0.5,
            draw: () => {
                drawExtrudedBlock(
                    ctx,
                    0,
                    worldH - 22,
                    topSideW,
                    22,
                    34,
                    room.wallTopColor,
                    room.wallSideColor,
                    '#000000',
                    true,
                    'classic_blue',
                    room.wallBevelColor,
                );
                drawExtrudedBlock(
                    ctx,
                    worldW - topSideW,
                    worldH - 22,
                    topSideW,
                    22,
                    34,
                    room.wallTopColor,
                    room.wallSideColor,
                    '#000000',
                    true,
                    'classic_blue',
                    room.wallBevelColor,
                );
            },
        });
    }
}
