import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/data/gameCatalog';
import type { CharacterId, GameMode, PlayerEntity, RoomSpec, WeaponId } from '@/types/game';
import { clamp } from '@/utils/battleGeometry';
import { computeObstacleNeighborFlags } from '@/utils/rendering/isoObstacleRenderer';
import type { BattleEngineState } from './battleTypes';
import { enqueueWorldActors } from './rendering/worldActorRenderer';
import { renderWorldDebugOverlay } from './rendering/worldDebugOverlayRenderer';
import { renderWorldFloor } from './rendering/worldFloorRenderer';
import {
    enqueueWorldBottomPerimeter,
    enqueueWorldObstacles,
    renderWorldObstacleBackground,
} from './rendering/worldObstacleRenderer';
import { enqueueWorldProjectiles } from './rendering/worldProjectileRenderer';
import type { WorldRenderItem } from './rendering/worldRenderQueue';

export interface RenderBattleFrameParams {
    ctx: CanvasRenderingContext2D;
    st: BattleEngineState;
    floorCanvas: HTMLCanvasElement | null;
    room: RoomSpec;
    worldW: number;
    worldH: number;
    activeCameraZoom: number;
    gameMode: GameMode;
    isSplitSwapped: boolean;
    deathmatchFragsGoal: number;
    getCharacterName: (characterId: CharacterId) => string;
    getWeaponName: (weaponId: WeaponId) => string;
    now: number;
}

export function renderBattleCanvasFrame(params: RenderBattleFrameParams): void {
    const {
        ctx,
        st,
        floorCanvas,
        room,
        worldW,
        worldH,
        activeCameraZoom,
        gameMode,
        isSplitSwapped,
        deathmatchFragsGoal,
        getCharacterName,
        getWeaponName,
        now,
    } = params;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const obstacleNeighborMap = computeObstacleNeighborFlags(room.obstacles);

    const renderWorldViewport = (
        camX: number,
        camY: number,
        viewX: number,
        viewY: number,
        viewW: number,
        viewH: number,
    ) => {
        ctx.save();
        ctx.beginPath();
        ctx.rect(viewX, viewY, viewW, viewH);
        ctx.clip();

        const shakeX = st.screenShake > 0.5 ? (Math.random() - 0.5) * st.screenShake : 0;
        const shakeY = st.screenShake > 0.5 ? (Math.random() - 0.5) * st.screenShake : 0;

        ctx.translate(viewX, viewY);
        ctx.scale(activeCameraZoom, activeCameraZoom);
        ctx.translate(-camX + shakeX, -camY + shakeY);

        const margin = 120;
        const worldViewW = viewW / activeCameraZoom;
        const worldViewH = viewH / activeCameraZoom;
        const visLeft = camX - margin;
        const visRight = camX + worldViewW + margin;
        const visTop = camY - margin;
        const visBottom = camY + worldViewH + margin;

        renderWorldFloor(ctx, st, floorCanvas, now, {
            left: visLeft,
            right: visRight,
            top: visTop,
            bottom: visBottom,
        });

        const visible = { left: visLeft, right: visRight, top: visTop, bottom: visBottom };
        renderWorldObstacleBackground(ctx, room, worldW, worldH, visible);

        const renderQueue: WorldRenderItem[] = [];
        enqueueWorldObstacles(ctx, st, room, visible, obstacleNeighborMap, renderQueue, now);
        enqueueWorldActors(ctx, st, visible, renderQueue, now, getWeaponName);
        enqueueWorldBottomPerimeter(ctx, room, worldW, worldH, renderQueue);
        enqueueWorldProjectiles(ctx, st, visible, renderQueue, now);

        renderQueue.sort((a, b) => a.sortY - b.sortY);
        for (let i = 0; i < renderQueue.length; i++) {
            renderQueue[i].draw();
        }

        renderWorldDebugOverlay(ctx, st);

        ctx.restore();
    };

    if (gameMode === 'DEATHMATCH_2P') {
        const splitW = Math.floor(CANVAS_WIDTH / 2);
        const leftCam = isSplitSwapped ? st.camP2 : st.camP1;
        const rightCam = isSplitSwapped ? st.camP1 : st.camP2;
        const leftPlayer = isSplitSwapped ? st.players[1] : st.players[0];
        const rightPlayer = isSplitSwapped ? st.players[0] : st.players[1];

        renderWorldViewport(leftCam.x, leftCam.y, 0, 0, splitW, CANVAS_HEIGHT);
        renderWorldViewport(rightCam.x, rightCam.y, splitW, 0, splitW, CANVAS_HEIGHT);

        // Center Split-Screen Divider Bar
        ctx.fillStyle = '#09090b';
        ctx.fillRect(splitW - 3, 0, 6, CANVAS_HEIGHT);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(splitW, 0);
        ctx.lineTo(splitW, CANVAS_HEIGHT);
        ctx.stroke();

        const drawSplitHeader = (pl: PlayerEntity | undefined, centerX: number, accentHex: string) => {
            if (!pl) return;
            const charName = getCharacterName(pl.characterId).toUpperCase();
            ctx.save();
            ctx.fillStyle = 'rgba(12, 10, 9, 0.84)';
            ctx.strokeStyle = accentHex;
            ctx.lineWidth = 1.6;
            ctx.fillRect(centerX - 135, 12, 270, 30);
            ctx.strokeRect(centerX - 135, 12, 270, 30);
            ctx.font = 'bold 13px "JetBrains Mono", "Noto Sans TC", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${pl.id} (${charName}) · FRAGS: ${pl.frags} / ${deathmatchFragsGoal}`, centerX, 31);
            ctx.restore();
        };

        drawSplitHeader(leftPlayer, splitW * 0.5, leftPlayer?.id === 'P1' ? '#ef4444' : '#38bdf8');
        drawSplitHeader(rightPlayer, splitW * 1.5, rightPlayer?.id === 'P1' ? '#ef4444' : '#38bdf8');
    } else {
        renderWorldViewport(st.camShared.x, st.camShared.y, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Top-Center Boxhead Red Combo Multiplier (Screen-Space Overlay)
    if (st.combo > 0) {
        const comboRatio = clamp((st.comboExpiresAt - now) / 3800, 0, 1);
        ctx.save();
        ctx.translate(CANVAS_WIDTH / 2, 42);
        ctx.font = '900 28px "Outfit", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#18181b';
        ctx.fillText(`${st.combo}x`, 2, 2);
        ctx.fillStyle = '#dc2626';
        ctx.fillText(`${st.combo}x`, 0, 0);

        ctx.fillStyle = 'rgba(24,24,27,0.75)';
        ctx.fillRect(-75, 8, 150, 7);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-73, 9.5, 146 * comboRatio, 4);
        ctx.restore();
    }

    // Center-Screen Seamless Wave Announcement ("WAVE 1", "WAVE 2", etc.)
    if (st.waveBanner && now - st.waveBanner.createdAt < st.waveBanner.durationMs) {
        const elapsed = now - st.waveBanner.createdAt;
        const progress = elapsed / st.waveBanner.durationMs;
        const alpha = progress < 0.15 ? progress / 0.15 : progress > 0.72 ? (1 - progress) / 0.28 : 1;
        const scale = progress < 0.15 ? 0.85 + (progress / 0.15) * 0.15 : 1;

        ctx.save();
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        ctx.scale(scale, scale);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.font = '900 64px "Outfit", "JetBrains Mono", sans-serif';
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#09090b';
        ctx.strokeText(st.waveBanner.text, 0, 0);
        ctx.fillStyle = '#dc2626';
        ctx.fillText(st.waveBanner.text, 0, 0);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText(st.waveBanner.text, 0, 0);
        ctx.restore();
    }

    // Bottom message feed: show up to three entries, stack new entries upward, and fade overflow.
    if (st.banners.length > 0) {
        const fadeWindowMs = 380;
        const rowHeight = 28;
        const baseBottomY = CANVAS_HEIGHT - 22;
        const bottomToTop = [...st.banners].reverse();

        bottomToTop.forEach((bn, slotIdx) => {
            const elapsed = now - bn.createdAt;
            const remaining = bn.durationMs - elapsed;
            const isFadingOut = remaining < fadeWindowMs || slotIdx >= 3;
            const fadeProgress = isFadingOut ? clamp(1 - remaining / fadeWindowMs, 0, 1) : 0;
            const alpha = clamp(1 - fadeProgress, 0, 1);
            if (alpha <= 0.01) return;

            const entrySlideY = elapsed < 120 ? (1 - elapsed / 120) * 10 : 0;
            const upwardFadeDriftY = fadeProgress * 18;
            const drawY = baseBottomY - Math.min(slotIdx, 3) * rowHeight + entrySlideY - upwardFadeDriftY;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 13px "JetBrains Mono", "Noto Sans TC", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const textMetrics = ctx.measureText(bn.text);
            const padX = 14;
            const boxW = Math.max(200, textMetrics.width + padX * 2);
            const boxH = 24;

            ctx.fillStyle = 'rgba(12, 10, 9, 0.86)';
            ctx.fillRect(CANVAS_WIDTH / 2 - boxW / 2, drawY - boxH / 2, boxW, boxH);
            ctx.strokeStyle = bn.color === '#ffffff' ? '#dc2626' : bn.color;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(CANVAS_WIDTH / 2 - boxW / 2, drawY - boxH / 2, boxW, boxH);

            ctx.fillStyle = bn.color;
            ctx.fillText(bn.text, CANVAS_WIDTH / 2, drawY + 0.5);
            ctx.restore();
        });
    }
}
