/**
 * Converts knockback force and target mass into a 60 FPS velocity impulse.
 */
export function computeKnockbackImpulse(forceNT: number, massKg: number): number {
    if (forceNT <= 0 || massKg <= 0) return 0;
    return (forceNT / massKg) * 0.75;
}

/**
 * Computes the 2D knockback velocity vector (dvx, dvy) from force (NT), mass (KG), and impact angle.
 */
export function calculateKnockbackVelocity(
    forceNT: number,
    targetMassKg: number,
    angleRad: number,
): { dvx: number; dvy: number } {
    const impulse = computeKnockbackImpulse(forceNT, targetMassKg);
    return {
        dvx: Math.cos(angleRad) * impulse,
        dvy: Math.sin(angleRad) * impulse,
    };
}
