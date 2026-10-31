export interface BeamDepthSegment {
    start: number;
    end: number;
    sortY: number;
}

export function splitBeamByDepth(startY: number, endY: number, depths: readonly number[]): BeamDepthSegment[] {
    const deltaY = endY - startY;
    if (Math.abs(deltaY) < 1e-6) {
        return [{ start: 0, end: 1, sortY: startY }];
    }

    const cuts = [0, 1];
    for (const depth of depths) {
        const t = (depth - startY) / deltaY;
        if (t > 0 && t < 1) cuts.push(t);
    }
    cuts.sort((a, b) => a - b);

    const segments: BeamDepthSegment[] = [];
    for (let i = 1; i < cuts.length; i++) {
        const start = cuts[i - 1];
        const end = cuts[i];
        if (end - start < 1e-9) continue;
        segments.push({ start, end, sortY: startY + deltaY * ((start + end) / 2) });
    }
    return segments;
}
