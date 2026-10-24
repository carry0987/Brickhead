import type { RoomSpec } from '@/types/game';
import { circleRectCollide, clamp, dist } from '@/utils/battleGeometry';
import type { BattleEngineState, RoomBounds } from '../battleTypes';
import { ENEMY_SPECS } from '../tuning/enemyTuning';

export const FLOW_CELL = 16;
const DYNAMIC_BARREL_OR_WALL_COST = 18;

/**
 * Ensures any spawned or dropped Red Box supply crate (`red_box`) is placed completely clear
 * of all 2.5D wall graphics (including the top roof projection and the south front wall face
 * where tall 3D crates would otherwise be partially occluded) as well as barrels/fake walls.
 */
export function resolveSafeRedBoxPosition(
    room: RoomSpec,
    roomBounds: RoomBounds,
    placedObjects: { kind: string; x: number; y: number; radius: number; hp: number }[],
    rawX: number,
    rawY: number,
): { x: number; y: number } {
    const minX = roomBounds.x + 28;
    const maxX = roomBounds.x + roomBounds.w - 28;
    const minY = roomBounds.y + 34;
    const maxY = roomBounds.y + roomBounds.h - 24;

    let x = clamp(rawX, minX, maxX);
    let y = clamp(rawY, minY, maxY);

    // A 3D red_box centered at (x, y) extends ~22px upward (y - 22) and ~10px downward (y + 10),
    // and ~16px left/right. Expanding each obstacle's south edge by +26px and sides by +18px
    // guarantees the crate is never covered by a wall's 2.5D front face or roof.
    for (let pass = 0; pass < 3; pass++) {
        for (const obs of room.obstacles) {
            const padLeft = 18;
            const padRight = 18;
            const padTop = 16;
            const padBottom = 26;
            const rx = obs.x - padLeft;
            const ry = obs.y - padTop;
            const rw = obs.w + padLeft + padRight;
            const rh = obs.h + padTop + padBottom;
            const col = circleRectCollide(x, y, 4, rx, ry, rw, rh);
            if (col.hit) {
                x += col.nx * (col.overlap + 1);
                y += col.ny * (col.overlap + 1);
            }
        }

        for (const obj of placedObjects) {
            if ((obj.kind === 'wall' || obj.kind === 'barrel') && obj.hp > 0) {
                const minD = obj.radius + 18;
                const d = dist(x, y, obj.x, obj.y);
                if (d < minD) {
                    const pushAng = d > 0.001 ? Math.atan2(y - obj.y, x - obj.x) : 0;
                    x = obj.x + Math.cos(pushAng) * minD;
                    y = obj.y + Math.sin(pushAng) * minD;
                }
            }
        }

        x = clamp(x, minX, maxX);
        y = clamp(y, minY, maxY);
    }

    return { x, y };
}

export function initRoomFlowField(st: BattleEngineState, activeRoom: RoomSpec, actW: number, actH: number): void {
    const fCols = Math.ceil(actW / FLOW_CELL);
    const fRows = Math.ceil(actH / FLOW_CELL);
    const blocked = new Uint8Array(fCols * fRows);
    const devilBlocked = new Uint8Array(fCols * fRows);
    const b = activeRoom.bounds || {
        x: 22,
        y: 80,
        w: actW - 44,
        h: actH - 102,
    };

    for (let r = 0; r < fRows; r++) {
        for (let c = 0; c < fCols; c++) {
            const cx = c * FLOW_CELL + FLOW_CELL * 0.5;
            const cy = r * FLOW_CELL + FLOW_CELL * 0.5;
            const idx = r * fCols + c;

            // Block cells outside playable room bounds (fixes out-of-bounds highway bug along x < bounds.x)
            if (cx < b.x + 5 || cx > b.x + b.w - 5 || cy < b.y + 5 || cy > b.y + b.h - 5) {
                blocked[idx] = 1;
                devilBlocked[idx] = 1;
                continue;
            }

            // Hard wall core (+5px margin): never blocks 32px corridors (32 - 10 = 22px clear width -> 1~2 open 16px cells)
            const hitHardObs = activeRoom.obstacles.some(
                (obs) => cx >= obs.x - 5 && cx <= obs.x + obs.w + 5 && cy >= obs.y - 5 && cy <= obs.y + obs.h + 5,
            );
            if (hitHardObs) {
                blocked[idx] = 1;
                devilBlocked[idx] = 1;
                continue;
            }

            // Soft wall shoulder (+12px margin): traversable with a small step cost (+2) so zombies
            // naturally prefer corridor centers in wide halls, but never lose pathing in 32px passages
            const hitSoftObs = activeRoom.obstacles.some(
                (obs) => cx >= obs.x - 12 && cx <= obs.x + obs.w + 12 && cy >= obs.y - 12 && cy <= obs.y + obs.h + 12,
            );
            if (hitSoftObs) {
                blocked[idx] = 2;
            }

            // Devil has a larger visual/combat body, so use a 14px soft wall shoulder (+2 cost)
            // while keeping 32px corridors smoothly passable
            const hitObsDevil = activeRoom.obstacles.some(
                (obs) => cx >= obs.x - 14 && cx <= obs.x + obs.w + 14 && cy >= obs.y - 14 && cy <= obs.y + obs.h + 14,
            );
            if (hitObsDevil) {
                devilBlocked[idx] = 2;
            }
        }
    }
    st.flowCols = fCols;
    st.flowRows = fRows;
    st.flowBlocked = blocked;
    st.devilFlowBlocked = devilBlocked;
    st.flowField = new Int16Array(fCols * fRows).fill(-1);
    st.devilFlowField = new Int16Array(fCols * fRows).fill(-1);
    st.lastFlowUpdate = 0;
}

function getCellDynamicStepCost(st: BattleEngineState, cx: number, cy: number, extraRadiusPad: number = 8): number {
    for (let i = 0; i < st.placedObjects.length; i++) {
        const obj = st.placedObjects[i];
        if ((obj.kind === 'wall' || obj.kind === 'barrel') && obj.hp > 0) {
            const pad = obj.radius + extraRadiusPad;
            const dx = cx - obj.x;
            const dy = cy - obj.y;
            if (dx * dx + dy * dy <= pad * pad) {
                return DYNAMIC_BARREL_OR_WALL_COST;
            }
        }
    }
    return 1;
}

function computeWeightedFlowGrid(
    st: BattleEngineState,
    blockedGrid: Uint8Array,
    distMap: Int16Array,
    extraRadiusPad: number,
): void {
    const cols = st.flowCols;
    const rows = st.flowRows;
    distMap.fill(-1);

    // Use a lightweight Dijkstra / 0-1-K priority queue so that:
    // 1) Open floor cells have cost 1 -> entities always route around barrels/walls when a gap exists.
    // 2) Barrels & fake walls have finite cost (18) instead of blocking flood-fill completely ->
    //    even when the player completely seals a corridor with barrels, the flow field penetrates
    //    the barrel barricade and floods the rest of the map so zombies behind distant walls
    //    still navigate around map walls toward the player!
    const heapIdx: number[] = [];
    const heapCost: number[] = [];

    const pushHeap = (cellIdx: number, cost: number) => {
        let i = heapIdx.length;
        heapIdx.push(cellIdx);
        heapCost.push(cost);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (heapCost[p] <= cost) break;
            heapIdx[i] = heapIdx[p];
            heapCost[i] = heapCost[p];
            i = p;
        }
        heapIdx[i] = cellIdx;
        heapCost[i] = cost;
    };

    const popHeap = (): { idx: number; cost: number } | null => {
        if (heapIdx.length === 0) return null;
        const topIdx = heapIdx[0];
        const topCost = heapCost[0];
        const lastIdx = heapIdx.pop();
        const lastCost = heapCost.pop();
        if (lastIdx === undefined || lastCost === undefined) return null;
        if (heapIdx.length > 0) {
            let i = 0;
            const n = heapIdx.length;
            while ((i << 1) + 1 < n) {
                let left = (i << 1) + 1;
                const right = left + 1;
                if (right < n && heapCost[right] < heapCost[left]) {
                    left = right;
                }
                if (lastCost <= heapCost[left]) break;
                heapIdx[i] = heapIdx[left];
                heapCost[i] = heapCost[left];
                i = left;
            }
            heapIdx[i] = lastIdx;
            heapCost[i] = lastCost;
        }
        return { idx: topIdx, cost: topCost };
    };

    st.players.forEach((p) => {
        if (!p.isDowned) {
            const gc = clamp(Math.floor(p.x / FLOW_CELL), 0, cols - 1);
            const gr = clamp(Math.floor(p.y / FLOW_CELL), 0, rows - 1);
            const idx = gr * cols + gc;
            let seededCount = 0;

            if (st.flowBlocked[idx] !== 1) {
                distMap[idx] = 0;
                pushHeap(idx, 0);
                seededCount++;
            }

            // Seed 1-cell ring of non-hard-wall cells around the player
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nc = gc + dc;
                    const nr = gr + dr;
                    if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                        const nIdx = nr * cols + nc;
                        if (st.flowBlocked[nIdx] !== 1) {
                            // Avoid diagonal seeding across a hard corner
                            if (
                                Math.abs(dr) === 1 &&
                                Math.abs(dc) === 1 &&
                                st.flowBlocked[gr * cols + nc] === 1 &&
                                st.flowBlocked[nr * cols + gc] === 1
                            ) {
                                continue;
                            }
                            const seedCost = blockedGrid[nIdx] === 0 ? 1 : 2;
                            if (distMap[nIdx] === -1 || seedCost < distMap[nIdx]) {
                                distMap[nIdx] = seedCost;
                                pushHeap(nIdx, seedCost);
                                seededCount++;
                            }
                        }
                    }
                }
            }

            // Fallback 2-cell ring if player is squeezed tightly against a wall/alcove
            if (seededCount === 0) {
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        const nc = gc + dc;
                        const nr = gr + dr;
                        if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                            const nIdx = nr * cols + nc;
                            if (st.flowBlocked[nIdx] !== 1 && distMap[nIdx] === -1) {
                                distMap[nIdx] = 2;
                                pushHeap(nIdx, 2);
                            }
                        }
                    }
                }
            }
        }
    });

    const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ];

    while (heapIdx.length > 0) {
        const item = popHeap();
        if (!item) break;
        const cur = item.idx;
        const curD = item.cost;
        if (curD > distMap[cur]) continue;

        const cr = Math.floor(cur / cols);
        const cc = cur % cols;

        for (let d = 0; d < 4; d++) {
            const nc = cc + dirs[d][0];
            const nr = cr + dirs[d][1];
            if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                const nIdx = nr * cols + nc;
                // Hard wall core (5px margin) is strictly impassable; soft wall margin (2) or devil margin (1)
                // is traversable at a modest penalty so 32px narrow corridors never disconnect the flood-fill.
                const isHardWall = st.flowBlocked[nIdx] === 1;
                if (isHardWall) continue;

                const softWallPenalty = blockedGrid[nIdx] === 1 ? 6 : blockedGrid[nIdx] === 2 ? 2 : 0;
                const cx = nc * FLOW_CELL + FLOW_CELL * 0.5;
                const cy = nr * FLOW_CELL + FLOW_CELL * 0.5;
                const stepCost = getCellDynamicStepCost(st, cx, cy, extraRadiusPad) + softWallPenalty;
                const nextD = curD + stepCost;

                if (distMap[nIdx] === -1 || nextD < distMap[nIdx]) {
                    distMap[nIdx] = nextD;
                    pushHeap(nIdx, nextD);
                }
            }
        }
    }
}

export function updateFlowField(st: BattleEngineState, now: number): void {
    if (now - st.lastFlowUpdate < 160) return;
    st.lastFlowUpdate = now;

    const cols = st.flowCols;
    const rows = st.flowRows;
    if (cols === 0 || rows === 0) return;

    if (!st.devilFlowBlocked || st.devilFlowBlocked.length !== cols * rows) {
        st.devilFlowBlocked = new Uint8Array(st.flowBlocked);
    }
    if (!st.devilFlowField || st.devilFlowField.length !== cols * rows) {
        st.devilFlowField = new Int16Array(cols * rows).fill(-1);
    }

    // 1. Standard Zombie Flow Field (radius 14 -> extraRadiusPad = 8 => 22px clearance around barrels)
    computeWeightedFlowGrid(st, st.flowBlocked, st.flowField, ENEMY_SPECS.zombie.flowFieldClearancePad);

    // 2. Devil Boss Flow Field (radius 22 -> extraRadiusPad = 22 => 36px clearance around barrels)
    computeWeightedFlowGrid(st, st.devilFlowBlocked, st.devilFlowField, ENEMY_SPECS.devil.flowFieldClearancePad);
}

/**
 * Samples the 16px Flow Field around `(x, y)` using a 2-ring neighborhood and blends
 * candidate cell directions smoothly so entities never jitter when crossing grid lines.
 */
export function sampleFlowFieldAngle(
    st: BattleEngineState,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    isDevil: boolean = false,
): number | null {
    const cols = st.flowCols;
    const rows = st.flowRows;
    if (cols === 0 || rows === 0) return null;

    const activeField =
        isDevil && st.devilFlowField && st.devilFlowField.length === cols * rows ? st.devilFlowField : st.flowField;

    const gc = clamp(Math.floor(x / FLOW_CELL), 0, cols - 1);
    const gr = clamp(Math.floor(y / FLOW_CELL), 0, rows - 1);

    let bestScore = Infinity;
    const candidates: Array<{ vx: number; vy: number; score: number }> = [];

    // Search 1-cell and 2-cell rings for smooth steering around corners and barrels
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = gc + dc;
            const nr = gr + dr;
            if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;

            const nIdx = nr * cols + nc;
            if (st.flowBlocked[nIdx] === 1) continue;

            // Prevent cutting diagonally through blocked wall corners
            if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
                if (st.flowBlocked[gr * cols + nc] === 1 || st.flowBlocked[nr * cols + gc] === 1) {
                    continue;
                }
            } else if (Math.abs(dr) === 2 || Math.abs(dc) === 2) {
                const midC = gc + Math.trunc(dc / 2);
                const midR = gr + Math.trunc(dr / 2);
                if (st.flowBlocked[midR * cols + midC] === 1) continue;
            }

            const dVal = activeField[nIdx];
            if (dVal >= 0) {
                const cellX = nc * FLOW_CELL + FLOW_CELL * 0.5;
                const cellY = nr * FLOW_CELL + FLOW_CELL * 0.5;
                const tieBreak = Math.hypot(targetX - cellX, targetY - cellY) * 0.0005;
                const score = dVal + tieBreak;
                if (score < bestScore) {
                    bestScore = score;
                }
                const dx = cellX - x;
                const dy = cellY - y;
                const len = Math.hypot(dx, dy);
                if (len > 0.001) {
                    candidates.push({ vx: dx / len, vy: dy / len, score });
                }
            }
        }
    }

    if (bestScore < Infinity && candidates.length > 0) {
        let sumX = 0;
        let sumY = 0;
        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            const diff = c.score - bestScore;
            if (diff <= 1.6) {
                const w = Math.exp(-diff * 2.2);
                sumX += c.vx * w;
                sumY += c.vy * w;
            }
        }
        if (Math.hypot(sumX, sumY) > 0.001) {
            return Math.atan2(sumY, sumX);
        }
    }
    return null;
}

/**
 * Traces a multi-step polyline along the Flow Field from `(startX, startY)` toward `(goalX, goalY)`
 * for Debug Pathfinding Visualization Mode.
 */
export function traceFlowFieldPathForDebug(
    st: BattleEngineState,
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
    isDevil: boolean = false,
    maxSteps: number = 28,
): Array<{ x: number; y: number }> {
    const pts: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
    let curX = startX;
    let curY = startY;

    for (let step = 0; step < maxSteps; step++) {
        const rem = Math.hypot(goalX - curX, goalY - curY);
        if (rem <= 22) {
            pts.push({ x: goalX, y: goalY });
            break;
        }
        const ang = sampleFlowFieldAngle(st, curX, curY, goalX, goalY, isDevil);
        if (ang === null) {
            break;
        }
        const stepLen = Math.min(FLOW_CELL, rem);
        curX += Math.cos(ang) * stepLen;
        curY += Math.sin(ang) * stepLen;
        pts.push({ x: curX, y: curY });
    }
    return pts;
}

/**
 * Lightweight on-demand weighted pathfinder on the 16px grid for the AI Partner (`P2`)
 * when navigating around walls to reach a downed P1, pickup crate, or occluded zombie.
 */
export function computeGridPathAngleToGoal(
    st: BattleEngineState,
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
    outDebugPath?: Array<{ x: number; y: number }>,
): number {
    const cols = st.flowCols;
    const rows = st.flowRows;
    if (cols === 0 || rows === 0) {
        if (outDebugPath) {
            outDebugPath.push({ x: startX, y: startY }, { x: goalX, y: goalY });
        }
        return Math.atan2(goalY - startY, goalX - startX);
    }

    const startC = clamp(Math.floor(startX / FLOW_CELL), 0, cols - 1);
    const startR = clamp(Math.floor(startY / FLOW_CELL), 0, rows - 1);
    const goalC = clamp(Math.floor(goalX / FLOW_CELL), 0, cols - 1);
    const goalR = clamp(Math.floor(goalY / FLOW_CELL), 0, rows - 1);

    if (startC === goalC && startR === goalR) {
        if (outDebugPath) {
            outDebugPath.push({ x: startX, y: startY }, { x: goalX, y: goalY });
        }
        return Math.atan2(goalY - startY, goalX - startX);
    }

    const total = cols * rows;
    const distMap = new Int16Array(total).fill(-1);
    const queue: number[] = [];

    const goalIdx = goalR * cols + goalC;
    if (st.flowBlocked[goalIdx] !== 1) {
        distMap[goalIdx] = 0;
        queue.push(goalIdx);
    }

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = goalC + dc;
            const nr = goalR + dr;
            if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                const nIdx = nr * cols + nc;
                if (st.flowBlocked[nIdx] !== 1 && distMap[nIdx] === -1) {
                    distMap[nIdx] = 1;
                    queue.push(nIdx);
                }
            }
        }
    }

    let head = 0;
    const startIdx = startR * cols + startC;
    const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
    ];

    while (head < queue.length) {
        const cur = queue[head++];
        if (cur === startIdx) break;
        const curD = distMap[cur];
        const cr = Math.floor(cur / cols);
        const cc = cur % cols;

        for (let d = 0; d < 4; d++) {
            const nc = cc + dirs[d][0];
            const nr = cr + dirs[d][1];
            if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                const nIdx = nr * cols + nc;
                if (distMap[nIdx] === -1 && st.flowBlocked[nIdx] !== 1) {
                    const cx = nc * FLOW_CELL + FLOW_CELL * 0.5;
                    const cy = nr * FLOW_CELL + FLOW_CELL * 0.5;
                    if (getCellDynamicStepCost(st, cx, cy, 6) === 1) {
                        distMap[nIdx] = curD + (st.flowBlocked[nIdx] === 2 ? 2 : 1);
                        queue.push(nIdx);
                    }
                }
            }
        }
    }

    let bestScore = Infinity;
    let bestX = goalX;
    let bestY = goalY;

    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = startC + dc;
            const nr = startR + dr;
            if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
            const nIdx = nr * cols + nc;
            if (st.flowBlocked[nIdx] === 1) continue;

            if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
                if (st.flowBlocked[startR * cols + nc] === 1 || st.flowBlocked[nr * cols + startC] === 1) {
                    continue;
                }
            } else if (Math.abs(dr) === 2 || Math.abs(dc) === 2) {
                const midC = startC + Math.trunc(dc / 2);
                const midR = startR + Math.trunc(dr / 2);
                if (st.flowBlocked[midR * cols + midC] === 1) continue;
            }

            const dVal = distMap[nIdx];
            if (dVal >= 0) {
                const cx = nc * FLOW_CELL + FLOW_CELL * 0.5;
                const cy = nr * FLOW_CELL + FLOW_CELL * 0.5;
                const score = dVal + Math.hypot(goalX - cx, goalY - cy) * 0.0005;
                if (score < bestScore) {
                    bestScore = score;
                    bestX = cx;
                    bestY = cy;
                }
            }
        }
    }

    if (outDebugPath) {
        outDebugPath.push({ x: startX, y: startY });
        let curC = startC;
        let curR = startR;
        for (let step = 0; step < 32; step++) {
            if (curC === goalC && curR === goalR) {
                outDebugPath.push({ x: goalX, y: goalY });
                break;
            }
            let nextC = curC;
            let nextR = curR;
            let minScore = Infinity;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nc = curC + dc;
                    const nr = curR + dr;
                    if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
                    const nIdx = nr * cols + nc;
                    if (st.flowBlocked[nIdx] === 1) continue;
                    const dVal = distMap[nIdx];
                    if (dVal >= 0) {
                        const cx = nc * FLOW_CELL + FLOW_CELL * 0.5;
                        const cy = nr * FLOW_CELL + FLOW_CELL * 0.5;
                        const s = dVal + Math.hypot(goalX - cx, goalY - cy) * 0.0005;
                        if (s < minScore) {
                            minScore = s;
                            nextC = nc;
                            nextR = nr;
                        }
                    }
                }
            }
            if (nextC === curC && nextR === curR) break;
            curC = nextC;
            curR = nextR;
            outDebugPath.push({
                x: curC * FLOW_CELL + FLOW_CELL * 0.5,
                y: curR * FLOW_CELL + FLOW_CELL * 0.5,
            });
        }
    }

    return Math.atan2(bestY - startY, bestX - startX);
}
