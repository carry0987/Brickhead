import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/data/gameCatalog';
import type { BattleEngineState, RoomBounds } from '@/engine/battleTypes';
import type { GameMode, RoomSpec } from '@/types/game';

export function drawSideMinimapCanvas(
    st: BattleEngineState,
    room: RoomSpec,
    roomBounds: RoomBounds,
    worldW: number,
    worldH: number,
    targetCanvas: HTMLCanvasElement | null,
    camFocusX: number,
    camFocusY: number,
    camViewW: number,
    camViewH: number,
    badgeTitle: string,
    accentColor: string,
): void {
    if (!targetCanvas) return;
    const mapW = 164;
    const mapH = Math.round(164 * (worldH / worldW));
    const sx = mapW / worldW;
    const sy = mapH / worldH;

    if (targetCanvas.width !== mapW) targetCanvas.width = mapW;
    if (targetCanvas.height !== mapH) targetCanvas.height = mapH;
    const mCtx = targetCanvas.getContext('2d');
    if (!mCtx) return;

    mCtx.clearRect(0, 0, mapW, mapH);

    // Background & Border
    mCtx.fillStyle = '#0c0a09';
    mCtx.fillRect(0, 0, mapW, mapH);
    mCtx.strokeStyle = accentColor;
    mCtx.lineWidth = 2;
    mCtx.strokeRect(1, 1, mapW - 2, mapH - 2);

    // Room Playable Bounds
    mCtx.fillStyle = 'rgba(235, 222, 199, 0.16)';
    mCtx.fillRect(roomBounds.x * sx, roomBounds.y * sy, roomBounds.w * sx, roomBounds.h * sy);

    // Obstacles & Walls
    mCtx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    for (let i = 0; i < room.obstacles.length; i++) {
        const ob = room.obstacles[i];
        mCtx.fillRect(ob.x * sx, ob.y * sy, Math.max(1.8, ob.w * sx), Math.max(1.8, ob.h * sy));
    }

    // Placed Fake Walls, Barrels (Orange Dots) & Mines (Purple Dots)
    for (let i = 0; i < st.placedObjects.length; i++) {
        const obj = st.placedObjects[i];
        if (obj.hp <= 0) continue;
        const ox = obj.x * sx;
        const oy = obj.y * sy;
        if (obj.kind === 'wall') {
            mCtx.fillStyle = '#e7e5e4';
            mCtx.fillRect(ox - 1.5, oy - 1.5, 3, 3);
        } else if (obj.kind === 'barrel') {
            mCtx.fillStyle = '#f59e0b';
            mCtx.beginPath();
            mCtx.arc(ox, oy, 1.9, 0, Math.PI * 2);
            mCtx.fill();
        } else {
            mCtx.fillStyle = '#a855f7';
            mCtx.beginPath();
            mCtx.arc(ox, oy, 1.9, 0, Math.PI * 2);
            mCtx.fill();
        }
    }

    // Red Box Pickups
    mCtx.fillStyle = '#facc15';
    for (let i = 0; i < st.redBoxes.length; i++) {
        const rb = st.redBoxes[i];
        mCtx.fillRect(rb.x * sx - 2.2, rb.y * sy - 2.2, 4.4, 4.4);
    }

    // Optional Debug Pathfinding Lines on Minimap
    if (st.debugPathfinding) {
        mCtx.save();
        for (let i = 0; i < st.enemies.length; i++) {
            const en = st.enemies[i];
            const pts = en.debugPathPoints;
            if (pts && pts.length >= 2) {
                const navMode = en.debugNavMode || 'DIRECT_LOS';
                mCtx.strokeStyle =
                    navMode === 'FALLBACK_NO_PATH'
                        ? 'rgba(239, 68, 68, 0.9)'
                        : navMode === 'DIRECT_LOS'
                          ? 'rgba(34, 197, 94, 0.5)'
                          : en.kind === 'devil'
                            ? 'rgba(245, 158, 11, 0.85)'
                            : 'rgba(56, 189, 248, 0.78)';
                mCtx.lineWidth = 0.9;
                mCtx.beginPath();
                mCtx.moveTo(pts[0].x * sx, pts[0].y * sy);
                for (let k = 1; k < pts.length; k++) {
                    mCtx.lineTo(pts[k].x * sx, pts[k].y * sy);
                }
                mCtx.stroke();
            }
        }
        if (st.aiDebugTelemetry && st.aiDebugTelemetry.pathPoints.length >= 2) {
            const apts = st.aiDebugTelemetry.pathPoints;
            mCtx.strokeStyle = 'rgba(232, 121, 249, 0.9)';
            mCtx.lineWidth = 1.2;
            mCtx.beginPath();
            mCtx.moveTo(apts[0].x * sx, apts[0].y * sy);
            for (let k = 1; k < apts.length; k++) {
                mCtx.lineTo(apts[k].x * sx, apts[k].y * sy);
            }
            mCtx.stroke();
        }
        mCtx.restore();
    }

    // Enemies (Zombies & Red Devils)
    for (let i = 0; i < st.enemies.length; i++) {
        const en = st.enemies[i];
        const ex = en.x * sx;
        const ey = en.y * sy;
        const isDevil = en.kind === 'devil';
        if (isDevil) {
            const r = 3.2;
            mCtx.fillStyle = '#ef4444';
            // Left & Right Devil Horns
            mCtx.beginPath();
            mCtx.moveTo(ex - r * 0.9, ey - r * 0.2);
            mCtx.lineTo(ex - r * 1.35, ey - r * 1.55);
            mCtx.lineTo(ex - r * 0.15, ey - r * 0.85);
            mCtx.closePath();
            mCtx.fill();

            mCtx.beginPath();
            mCtx.moveTo(ex + r * 0.9, ey - r * 0.2);
            mCtx.lineTo(ex + r * 1.35, ey - r * 1.55);
            mCtx.lineTo(ex + r * 0.15, ey - r * 0.85);
            mCtx.closePath();
            mCtx.fill();

            // Red Circle Body
            mCtx.beginPath();
            mCtx.arc(ex, ey, r, 0, Math.PI * 2);
            mCtx.fill();
        } else {
            mCtx.fillStyle = '#ef4444';
            mCtx.beginPath();
            mCtx.arc(ex, ey, 1.9, 0, Math.PI * 2);
            mCtx.fill();
        }
    }

    // Players (P1 & P2)
    st.players.forEach((pl, pIdx) => {
        if (pl.isDowned) return;
        mCtx.fillStyle = pIdx === 0 ? '#22c55e' : '#38bdf8';
        mCtx.strokeStyle = '#ffffff';
        mCtx.lineWidth = 1.1;
        mCtx.beginPath();
        mCtx.arc(pl.x * sx, pl.y * sy, 3.6, 0, Math.PI * 2);
        mCtx.fill();
        mCtx.stroke();
    });

    // Camera Viewport Indicator Box
    mCtx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    mCtx.lineWidth = 1.2;
    mCtx.strokeRect(camFocusX * sx, camFocusY * sy, camViewW * sx, camViewH * sy);

    // Label Tag
    mCtx.fillStyle = 'rgba(9, 9, 11, 0.88)';
    mCtx.fillRect(3, 3, 62, 14);
    mCtx.font = 'bold 9.5px "JetBrains Mono", monospace';
    mCtx.textAlign = 'left';
    mCtx.fillStyle = '#e7e5e4';
    mCtx.fillText(badgeTitle, 6, 13);
}

export function renderBattleMinimaps(
    st: BattleEngineState,
    room: RoomSpec,
    roomBounds: RoomBounds,
    worldW: number,
    worldH: number,
    activeCameraZoom: number,
    gameMode: GameMode,
    isSplitSwapped: boolean,
    leftCanvas: HTMLCanvasElement | null,
    rightCanvas: HTMLCanvasElement | null,
): void {
    const fullWorldViewW = CANVAS_WIDTH / activeCameraZoom;
    const fullWorldViewH = CANVAS_HEIGHT / activeCameraZoom;

    if (gameMode === 'DEATHMATCH_2P') {
        const splitWorldW = Math.floor(CANVAS_WIDTH / 2) / activeCameraZoom;
        const leftCam = isSplitSwapped ? st.camP2 : st.camP1;
        const rightCam = isSplitSwapped ? st.camP1 : st.camP2;
        const leftId = isSplitSwapped ? 'P2 MAP' : 'P1 MAP';
        const rightId = isSplitSwapped ? 'P1 MAP' : 'P2 MAP';
        drawSideMinimapCanvas(
            st,
            room,
            roomBounds,
            worldW,
            worldH,
            leftCanvas,
            leftCam.x,
            leftCam.y,
            splitWorldW,
            fullWorldViewH,
            leftId,
            isSplitSwapped ? '#38bdf8' : '#ef4444',
        );
        drawSideMinimapCanvas(
            st,
            room,
            roomBounds,
            worldW,
            worldH,
            rightCanvas,
            rightCam.x,
            rightCam.y,
            splitWorldW,
            fullWorldViewH,
            rightId,
            isSplitSwapped ? '#ef4444' : '#38bdf8',
        );
    } else if (gameMode === 'SOLO' || gameMode === 'COOP_AI') {
        drawSideMinimapCanvas(
            st,
            room,
            roomBounds,
            worldW,
            worldH,
            leftCanvas,
            st.camShared.x,
            st.camShared.y,
            fullWorldViewW,
            fullWorldViewH,
            'P1 RADAR',
            '#ef4444',
        );
    } else {
        drawSideMinimapCanvas(
            st,
            room,
            roomBounds,
            worldW,
            worldH,
            leftCanvas,
            st.camShared.x,
            st.camShared.y,
            fullWorldViewW,
            fullWorldViewH,
            'P1 RADAR',
            '#ef4444',
        );
        drawSideMinimapCanvas(
            st,
            room,
            roomBounds,
            worldW,
            worldH,
            rightCanvas,
            st.camShared.x,
            st.camShared.y,
            fullWorldViewW,
            fullWorldViewH,
            'P2 RADAR',
            '#38bdf8',
        );
    }
}
