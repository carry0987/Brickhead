import { clamp } from '@/utils/battleGeometry';
import type { BattleEngineState } from '../battleTypes';

interface VisibleWorldBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export function renderWorldFloor(
    ctx: CanvasRenderingContext2D,
    st: BattleEngineState,
    floorCanvas: HTMLCanvasElement | null,
    now: number,
    bounds: VisibleWorldBounds,
): void {
    if (floorCanvas) {
        ctx.drawImage(floorCanvas, 0, 0);
    }

    if (st.debugPathfinding && st.flowCols > 0 && st.flowRows > 0) {
        const cell = 16;
        const cStart = clamp(Math.floor(bounds.left / cell), 0, st.flowCols - 1);
        const cEnd = clamp(Math.ceil(bounds.right / cell), 0, st.flowCols - 1);
        const rStart = clamp(Math.floor(bounds.top / cell), 0, st.flowRows - 1);
        const rEnd = clamp(Math.ceil(bounds.bottom / cell), 0, st.flowRows - 1);

        ctx.save();
        ctx.font = 'bold 6.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let r = rStart; r <= rEnd; r++) {
            for (let c = cStart; c <= cEnd; c++) {
                const idx = r * st.flowCols + c;
                const bVal = st.flowBlocked[idx];
                const dVal = st.flowField[idx];
                const gx = c * cell;
                const gy = r * cell;

                if (bVal === 1) {
                    ctx.fillStyle = 'rgba(239, 68, 68, 0.14)';
                    ctx.fillRect(gx, gy, cell, cell);
                } else if (dVal === -1) {
                    ctx.fillStyle = 'rgba(244, 63, 94, 0.36)';
                    ctx.fillRect(gx, gy, cell, cell);
                } else {
                    if (bVal === 2) {
                        ctx.fillStyle = 'rgba(245, 158, 11, 0.13)';
                        ctx.fillRect(gx, gy, cell, cell);
                    }
                    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(gx, gy, cell, cell);

                    if ((r + c) % 2 === 0 || bVal === 2) {
                        ctx.fillStyle = bVal === 2 ? 'rgba(253, 224, 71, 0.78)' : 'rgba(186, 230, 253, 0.65)';
                        ctx.fillText(String(dVal), gx + cell * 0.5, gy + cell * 0.5);
                    }
                }
            }
        }
        ctx.restore();
    }

    for (let i = 0; i < st.shellCasings.length; i++) {
        const sc = st.shellCasings[i];
        if (sc.x < bounds.left || sc.x > bounds.right || sc.y < bounds.top || sc.y > bounds.bottom) {
            continue;
        }
        const ageMs = now - sc.createdAt;
        const fadeAlpha = ageMs > 4000 ? clamp(1 - (ageMs - 4000) / 1000, 0, 1) : 1;
        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        ctx.translate(sc.x, sc.y);
        ctx.rotate(sc.angle);
        ctx.fillStyle = '#d97706';
        ctx.fillRect(-2.2, -1.1, 4.4, 2.2);
        ctx.fillStyle = '#fde047';
        ctx.fillRect(-1.5, -0.7, 2.6, 1.2);
        ctx.restore();
    }
}
