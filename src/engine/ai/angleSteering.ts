import { snapAngleTo8Dir } from '@/utils/battleGeometry';

export function normalizeAngleRad(angle: number): number {
    let normalized = angle % (Math.PI * 2);
    if (normalized > Math.PI) normalized -= Math.PI * 2;
    if (normalized < -Math.PI) normalized += Math.PI * 2;
    return normalized;
}

export function stepAngleTowards(current: number, target: number, maxStep: number): number {
    const difference = normalizeAngleRad(target - current);
    if (Math.abs(difference) <= maxStep) return target;
    return normalizeAngleRad(current + Math.sign(difference) * maxStep);
}

export function snapAngleTo8DirStable(
    dx: number,
    dy: number,
    currentDir8: number,
    deadbandRad = 0.12,
): { dir8: number; angle: number } {
    const rawAngle = Math.atan2(dy, dx);
    const step = Math.PI / 4;
    const currentAngle = currentDir8 * step;
    const difference = Math.abs(normalizeAngleRad(rawAngle - currentAngle));
    if (difference <= step * 0.5 + deadbandRad) {
        return { dir8: currentDir8, angle: currentAngle };
    }
    return snapAngleTo8Dir(dx, dy);
}
