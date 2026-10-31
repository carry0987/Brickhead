import { expect, test } from 'vitest';
import { splitBeamByDepth } from '../src/engine/rendering/beamDepthSegments';

test('sorts each part of a beam on the correct side of a wall', () => {
    const segments = splitBeamByDepth(120, 20, [70]);
    expect(segments).toEqual([
        { start: 0, end: 0.5, sortY: 95 },
        { start: 0.5, end: 1, sortY: 45 },
    ]);
});

test('handles forward depth, repeated depths, and depths outside the beam', () => {
    const segments = splitBeamByDepth(20, 120, [70, 70, 200, 20, 120, -10]);
    expect(segments).toEqual([
        { start: 0, end: 0.5, sortY: 45 },
        { start: 0.5, end: 1, sortY: 95 },
    ]);
});

test('keeps horizontal and zero-length beams in one segment', () => {
    expect(splitBeamByDepth(50, 50, [40, 50, 60])).toEqual([{ start: 0, end: 1, sortY: 50 }]);
});
