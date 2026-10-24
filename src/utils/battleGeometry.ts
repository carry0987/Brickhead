import type { PlacedObject, WallBlock } from '@/types/game';

export function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

export function dist(x1: number, y1: number, x2: number, y2: number): number {
    return Math.hypot(x2 - x1, y2 - y1);
}

export function snapAngleTo8Dir(dx: number, dy: number): { dir8: number; angle: number } {
    const rawAngle = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const dir8 = ((Math.round(rawAngle / step) % 8) + 8) % 8;
    return { dir8, angle: dir8 * step };
}

export function circleRectCollide(
    cx: number,
    cy: number,
    cr: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
): { hit: boolean; nx: number; ny: number; overlap: number } {
    const closestX = clamp(cx, rx, rx + rw);
    const closestY = clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= cr * cr) {
        return { hit: false, nx: 0, ny: 0, overlap: 0 };
    }
    const d = Math.sqrt(d2);
    if (d > 1e-5) {
        return { hit: true, nx: dx / d, ny: dy / d, overlap: cr - d };
    }
    // Center is inside rectangle: push out toward the nearest edge
    const leftPen = cx - rx;
    const rightPen = rx + rw - cx;
    const topPen = cy - ry;
    const bottomPen = ry + rh - cy;
    const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
    if (minPen === leftPen) {
        return { hit: true, nx: -1, ny: 0, overlap: leftPen + cr };
    }
    if (minPen === rightPen) {
        return { hit: true, nx: 1, ny: 0, overlap: rightPen + cr };
    }
    if (minPen === topPen) {
        return { hit: true, nx: 0, ny: -1, overlap: topPen + cr };
    }
    return { hit: true, nx: 0, ny: 1, overlap: bottomPen + cr };
}

export function segmentIntersectsRect(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
): boolean {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let tMin = 0;
    let tMax = 1;
    if (Math.abs(dx) < 1e-6) {
        if (x1 < rx || x1 > rx + rw) return false;
    } else {
        const invDx = 1 / dx;
        let t1 = (rx - x1) * invDx;
        let t2 = (rx + rw - x1) * invDx;
        if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
        }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
    }
    if (Math.abs(dy) < 1e-6) {
        if (y1 < ry || y1 > ry + rh) return false;
    } else {
        const invDy = 1 / dy;
        let t1 = (ry - y1) * invDy;
        let t2 = (ry + rh - y1) * invDy;
        if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
        }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
        if (tMin > tMax) return false;
    }
    return tMin <= tMax && tMax >= 0 && tMin <= 1;
}

export function hasClearLineOfSight(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    obstacles: WallBlock[],
    placedObjects: PlacedObject[],
): boolean {
    for (const obs of obstacles) {
        if (segmentIntersectsRect(x1, y1, x2, y2, obs.x - 4, obs.y - 4, obs.w + 8, obs.h + 8)) {
            return false;
        }
    }
    for (const obj of placedObjects) {
        if (obj.kind === 'wall' && obj.hp > 0) {
            if (
                segmentIntersectsRect(
                    x1,
                    y1,
                    x2,
                    y2,
                    obj.x - obj.radius,
                    obj.y - obj.radius,
                    obj.radius * 2,
                    obj.radius * 2,
                )
            ) {
                return false;
            }
        }
    }
    return true;
}
