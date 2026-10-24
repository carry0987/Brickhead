import type { RoomBounds, SpawnNode, WallStyle } from '@/types/game';

export const SWF_FLOOR_STAIN_PATH_D =
    'M96.0 -160.0 Q100.45 -150.5 96.0 -149.5 102.15 -148.8 96.0 -146.95 103.35 -144.45 96.0 -142.05 105.75 -136.3 109.05 -128.0 109.95 -131.0 111.15 -128.0 113.45 -130.0 115.95 -128.0 117.95 -130.0 128.0 -128.0 132.3 -116.75 128.0 -108.05 134.45 -107.0 128.0 -106.0 135.95 -104.0 128.0 -96.0 139.95 -102.0 142.95 -96.0 149.75 -101.7 160.0 -96.0 158.45 -105.0 160.0 -106.75 L174.0 -107.25 Q186.5 -105.85 192.0 -96.0 201.25 -98.65 203.7 -96.0 209.2 -86.2 209.25 -75.0 209.3 -67.3 204.15 -64.0 202.95 -60.5 192.0 -64.0 192.7 -53.75 192.0 -49.0 179.95 -47.5 176.8 -46.35 163.2 -41.3 149.0 -32.0 127.5 -32.6 106.0 -32.0 104.95 -28.5 96.0 -32.0 102.1 -21.75 96.0 -14.9 99.95 -13.0 96.0 -11.1 98.95 -8.5 96.0 0.0 94.25 9.5 96.0 15.05 92.95 16.5 96.0 17.95 91.5 23.05 96.0 32.0 84.95 31.0 80.35 32.0 77.45 36.85 74.0 32.0 68.5 37.0 64.0 32.0 58.3 40.5 64.0 44.05 55.5 45.0 64.0 45.85 51.9 49.3 49.85 52.95 49.0 54.5 47.8 64.0 44.8 59.25 32.0 64.0 19.9 71.75 0.0 85.65 1.3 88.75 0.0 96.0 -5.5 85.0 0.0 83.6 -8.55 78.8 -13.15 74.1 -20.55 66.5 -32.0 64.0 -41.0 70.0 -42.2 64.0 -44.25 71.7 -44.4 75.0 L-44.55 78.0 -45.0 110.0 -44.65 117.95 Q-43.95 125.4 -47.95 128.0 -51.15 135.4 -64.0 139.8 -55.5 141.5 -64.0 143.25 -57.5 144.5 -64.0 145.65 -62.95 151.2 -64.0 160.0 -74.15 173.85 -83.0 192.0 -85.0 187.45 -96.0 192.0 -108.55 186.25 -128.0 192.0 -125.6 182.45 -128.0 177.0 -125.0 158.5 -128.0 140.0 -124.6 130.65 -128.0 128.0 -142.85 118.9 -160.0 128.0 -176.25 133.1 -192.0 128.0 -186.15 120.7 -192.0 110.15 -181.5 107.0 -180.45 96.0 -178.8 98.9 -176.9 96.0 -171.1 79.25 -160.0 64.0 -156.4 46.65 -160.0 32.0 -155.65 22.05 -160.0 13.85 -149.0 12.0 -147.65 10.3 -139.4 0.1 -128.0 -11.05 -132.0 -13.0 -128.0 -15.0 -132.0 -15.5 -128.0 -16.15 -134.0 -17.0 -128.0 -17.5 -136.5 -18.0 -128.0 -18.55 -144.25 -21.3 -160.0 -32.0 -164.7 -22.4 -171.9 -32.0 -183.7 -27.5 -192.0 -32.0 -180.5 -39.0 -178.9 -32.0 -174.15 -40.05 -160.0 -42.65 -167.5 -44.0 -160.0 -44.15 -159.3 -44.45 -160.0 -48.3 -154.5 -49.0 -160.0 -49.9 -151.75 -52.75 -149.25 -64.0 -146.25 -58.25 -143.25 -64.0 -142.0 -62.5 -140.65 -64.0 -134.4 -68.05 -128.0 -64.0 -127.45 -74.55 -128.0 -76.85 -129.85 -80.4 -128.0 -83.0 -137.0 -84.0 -138.65 -85.4 -142.05 -88.3 -146.55 -94.1 L-146.35 -96.0 Q-144.75 -92.95 -142.0 -96.0 -140.5 -93.0 -139.15 -96.0 -137.5 -94.0 -128.0 -96.0 -121.5 -97.5 -117.9 -96.0 -113.5 -100.0 -109.15 -96.0 -106.0 -102.5 -96.0 -96.0 -100.5 -104.5 -96.0 -106.55 -91.45 -107.2 -96.0 -109.0 -91.5 -115.0 -96.0 -128.0 -92.3 -137.95 -95.95 -149.75 -85.25 -149.15 -82.95 -148.15 L-76.85 -145.35 Q-75.0 -144.5 -64.0 -143.55 -68.3 -140.95 -64.0 -139.05 -58.5 -137.5 -64.0 -128.0 -47.5 -132.5 -32.0 -128.0 -23.15 -128.4 -19.25 -128.0 -17.5 -134.0 -15.7 -128.0 -6.4 -144.05 0.0 -149.45 8.0 -151.0 11.25 -160.0 18.3 -155.65 32.0 -160.0 46.75 -152.2 64.0 -160.0 80.7 -152.15 96.0 -160.0';

export const SWF_FLOOR_STAIN_GLADIATOR_PATH_D =
    'M96.0 -160.0 Q100.45 -150.5 96.0 -149.5 102.15 -148.8 96.0 -146.95 103.35 -144.45 96.0 -142.05 105.75 -136.3 109.05 -128.0 109.95 -131.0 111.15 -128.0 113.45 -130.0 115.95 -128.0 117.95 -130.0 128.0 -128.0 132.3 -116.75 128.0 -108.05 134.45 -107.0 128.0 -106.0 135.95 -104.0 128.0 -96.0 139.95 -102.0 142.95 -96.0 149.75 -101.7 160.0 -96.0 158.45 -105.0 160.0 -106.75 L174.0 -107.25 Q186.5 -105.85 192.0 -96.0 201.25 -98.65 203.7 -96.0 209.2 -86.2 209.25 -75.0 209.3 -67.3 204.15 -64.0 202.95 -60.5 192.0 -64.0 192.7 -53.75 192.0 -49.0 179.95 -47.5 176.8 -46.35 163.2 -41.3 149.0 -32.0 127.5 -32.6 106.0 -32.0 104.95 -28.5 96.0 -32.0 102.1 -21.75 96.0 -14.9 99.95 -13.0 96.0 -11.1 98.95 -8.5 96.0 0.0 L95.4 3.95 95.15 6.9 95.2 6.9 Q97.25 7.55 96.0 8.5 98.95 9.4 96.0 10.3 99.35 11.2 96.0 11.9 102.05 13.65 104.95 15.65 L108.2 17.6 Q110.95 19.05 113.65 19.7 113.9 15.9 118.1 16.2 120.0 16.35 120.7 15.45 L116.45 11.0 Q115.75 8.5 116.75 5.25 117.2 4.9 117.0 0.0 L116.7 -0.15 Q117.15 -1.65 117.65 0.0 118.55 -1.0 119.4 0.0 122.3 0.7 128.0 0.0 128.2 6.95 128.0 11.65 127.8 13.45 128.0 14.45 132.6 17.2 128.0 21.35 130.95 23.05 128.0 24.95 130.3 25.65 128.0 26.15 129.0 27.65 128.0 32.0 127.25 35.65 128.0 37.4 130.0 38.85 128.0 39.35 134.1 40.6 136.25 42.85 136.8 43.4 137.1 45.1 136.25 46.55 137.2 49.45 139.85 51.2 143.25 50.35 L145.8 49.75 147.4 49.25 Q151.7 47.55 159.6 46.9 L159.9 47.05 Q159.7 47.35 160.0 47.65 162.1 47.8 160.0 48.15 L166.95 50.1 167.2 50.2 168.3 50.4 170.0 50.85 Q171.75 51.55 174.25 51.65 175.45 54.15 175.45 56.3 L175.95 64.0 Q176.45 66.2 172.4 68.9 171.05 68.6 170.8 64.0 170.4 65.0 169.75 64.0 168.65 59.4 164.55 57.4 162.4 57.4 160.0 56.3 156.15 56.3 154.9 57.9 L150.8 63.7 Q151.5 62.9 152.85 64.0 153.85 63.4 154.8 64.0 L160.0 64.0 Q159.7 67.95 160.0 71.25 157.8 71.95 160.0 72.7 157.4 74.4 160.0 75.05 155.45 75.65 154.3 78.15 153.45 80.1 155.25 80.7 157.95 81.65 160.0 81.25 163.25 83.2 160.0 85.85 162.35 86.25 160.0 86.55 161.1 88.55 160.0 91.2 159.75 92.7 160.0 96.0 161.75 104.85 160.0 107.55 L155.0 108.1 Q152.6 108.4 150.7 109.2 149.35 109.75 149.2 110.45 148.9 111.6 149.7 112.2 153.75 115.25 160.0 118.25 158.9 119.0 160.0 120.45 158.65 120.35 159.7 120.55 L159.75 120.6 155.05 120.8 Q156.55 122.25 160.0 121.25 158.95 121.1 159.75 120.6 L160.0 120.6 159.8 120.6 160.0 120.45 Q161.8 120.5 160.0 121.8 162.3 122.9 160.0 128.0 159.65 131.9 160.0 133.45 L160.0 135.8 Q156.15 135.8 160.0 136.45 156.45 137.1 160.0 137.8 157.25 139.15 160.0 139.4 153.85 140.3 154.9 143.2 155.35 144.5 160.0 143.95 158.3 147.75 154.9 148.95 154.3 149.5 154.0 151.15 L153.6 152.65 Q152.75 153.75 152.3 153.65 150.0 153.35 149.8 159.35 149.8 157.2 149.75 159.25 L149.8 160.0 Q149.8 162.3 148.9 165.05 148.8 170.25 147.1 173.6 147.45 176.9 146.95 179.15 L144.05 178.95 136.9 174.55 Q136.0 173.95 134.85 172.65 133.3 170.9 128.25 168.95 L128.3 168.8 Q130.85 168.4 129.25 167.95 129.6 167.35 128.0 167.65 L129.25 167.95 128.3 168.8 128.0 168.85 128.05 168.9 128.0 169.0 Q131.7 172.1 128.0 174.6 130.4 175.0 128.0 175.3 129.8 175.5 128.0 175.75 L127.9 176.0 Q124.7 174.25 123.1 172.45 121.8 175.55 119.9 178.55 L119.05 179.9 116.6 177.55 Q116.6 179.55 115.1 179.95 113.45 181.8 112.75 183.6 112.4 184.5 110.75 184.35 L103.3 184.7 Q102.3 183.45 102.25 183.0 101.0 183.4 100.5 184.85 99.25 183.75 96.0 182.95 97.3 180.35 96.0 177.5 96.6 176.8 96.0 176.15 95.45 173.0 96.0 170.75 92.0 169.75 90.3 170.0 L85.15 170.7 82.15 170.7 Q78.8 167.35 76.15 160.0 79.65 161.85 84.2 160.0 84.25 158.95 83.05 160.0 82.75 156.3 82.55 160.0 82.25 154.75 82.65 154.4 82.6 152.65 81.45 152.25 L78.35 152.15 77.15 152.6 Q78.75 149.95 78.7 146.85 L70.9 148.0 64.2 148.4 Q65.75 148.35 64.0 147.25 L69.15 140.25 70.15 139.15 Q71.0 138.45 71.05 137.95 70.85 136.1 69.65 137.1 66.65 138.4 64.0 137.55 65.8 137.25 64.0 136.9 63.3 136.15 64.0 135.85 61.95 134.9 64.0 134.15 L59.25 133.5 Q56.8 132.35 51.95 128.0 50.95 131.35 49.85 128.0 47.1 131.85 45.6 128.0 44.9 129.5 44.0 128.0 43.3 127.45 42.7 128.0 42.25 126.3 41.35 128.0 37.35 126.1 32.0 128.0 26.7 130.8 25.7 128.0 24.8 127.45 24.7 128.0 22.55 127.4 20.0 128.0 18.0 127.8 16.8 128.0 16.25 130.0 15.55 128.0 14.55 129.25 14.75 128.0 14.95 123.65 12.5 122.45 9.45 121.05 7.35 120.65 6.2 120.45 6.15 119.75 6.15 119.1 6.3 118.4 6.95 115.45 9.1 113.2 L10.5 112.7 Q9.35 112.4 8.9 111.65 6.35 108.0 0.0 107.5 L0.0 108.95 Q-1.25 109.35 0.0 109.6 -4.35 111.6 -6.05 116.1 -6.35 116.95 -7.1 117.5 -10.65 118.8 -12.95 117.95 L-15.75 117.65 -17.45 118.9 -18.55 119.85 -21.25 123.15 Q-22.55 124.4 -23.35 126.6 L-23.8 128.0 Q-24.4 130.6 -23.9 133.9 -23.55 136.55 -22.05 138.95 L-21.4 139.85 Q-20.4 143.2 -19.2 144.95 L-18.65 146.5 Q-19.35 147.7 -19.95 148.0 L-21.0 148.65 -23.4 149.9 -26.8 150.0 -25.95 152.95 -25.3 155.1 Q-24.9 156.6 -26.15 160.0 -26.8 156.85 -27.5 160.0 -30.85 157.55 -32.0 160.0 -36.55 161.95 -38.15 165.1 L-41.5 165.25 Q-45.0 163.85 -48.75 160.0 -47.85 156.6 -49.35 155.25 -49.25 154.15 -48.8 153.8 L-45.95 151.65 Q-44.8 150.7 -43.0 150.6 -40.9 147.25 -44.45 145.85 -47.45 144.65 -50.6 144.4 -50.65 140.25 -52.1 137.65 L-53.55 134.65 Q-57.55 137.6 -64.0 139.8 -55.5 141.5 -64.0 143.25 -57.5 144.5 -64.0 145.65 -62.95 151.2 -64.0 160.0 -74.15 173.85 -83.0 192.0 -85.0 187.45 -96.0 192.0 -108.55 186.25 -128.0 192.0 -125.6 182.45 -128.0 177.0 -125.0 158.5 -128.0 140.0 -124.6 130.65 -128.0 128.0 -142.85 118.9 -160.0 128.0 -176.25 133.1 -192.0 128.0 -186.15 120.7 -192.0 110.15 -181.5 107.0 -180.45 96.0 -178.8 98.9 -176.9 96.0 -171.1 79.25 -160.0 64.0 -156.4 46.65 -160.0 32.0 -155.65 22.05 -160.0 13.85 -149.0 12.0 -147.65 10.3 -139.4 0.1 -128.0 -11.05 -132.0 -13.0 -128.0 -15.0 -132.0 -15.5 -128.0 -16.15 -134.0 -17.0 -128.0 -17.5 -136.5 -18.0 -128.0 -18.55 -144.25 -21.3 -160.0 -32.0 -164.7 -22.4 -171.9 -32.0 -183.7 -27.5 -192.0 -32.0 -180.5 -39.0 -178.9 -32.0 -174.15 -40.05 -160.0 -42.65 -167.5 -44.0 -160.0 -44.15 -159.3 -44.45 -160.0 -48.3 -154.5 -49.0 -160.0 -49.9 -151.75 -52.75 -149.25 -64.0 -146.25 -58.25 -143.25 -64.0 -142.0 -62.5 -140.65 -64.0 -134.4 -68.05 -128.0 -64.0 -127.45 -74.55 -128.0 -76.85 -129.85 -80.4 -128.0 -83.0 -137.0 -84.0 -138.65 -85.4 -142.05 -88.3 -146.55 -94.1 L-146.35 -96.0 Q-144.75 -92.95 -142.0 -96.0 -140.5 -93.0 -139.15 -96.0 -137.5 -94.0 -128.0 -96.0 -121.5 -97.5 -117.9 -96.0 -113.5 -100.0 -109.15 -96.0 -106.0 -102.5 -96.0 -96.0 -100.5 -104.5 -96.0 -106.55 -91.45 -107.2 -96.0 -109.0 -91.5 -115.0 -96.0 -128.0 -92.3 -137.95 -95.95 -149.75 -85.25 -149.15 -82.95 -148.15 L-76.85 -145.35 Q-75.0 -144.5 -64.0 -143.55 -68.3 -140.95 -64.0 -139.05 -58.5 -137.5 -64.0 -128.0 -47.5 -132.5 -32.0 -128.0 -23.15 -128.4 -19.25 -128.0 -17.5 -134.0 -15.7 -128.0 -6.4 -144.05 0.0 -149.45 8.0 -151.0 11.25 -160.0 18.3 -155.65 32.0 -160.0 46.75 -152.2 64.0 -160.0 80.7 -152.15 96.0 -160.0';

let cachedSwfFloorStainPath: Path2D | null = null;
let cachedSwfFloorStainGladiatorPath: Path2D | null = null;

/**
 * Draws the authentic Boxhead 2Play SWF floor stain (`#sprite1` / `#shape1` with bevel filter)
 * inside `bounds`.
 */
export function drawSwfFloorStain(
    ctx: CanvasRenderingContext2D,
    bounds: RoomBounds,
    patchColor: string = '#d8cccc',
    stainTransforms?: Array<[number, number, number, number, number, number]>,
) {
    if (typeof Path2D === 'undefined') return;
    if (!cachedSwfFloorStainPath) {
        cachedSwfFloorStainPath = new Path2D(SWF_FLOOR_STAIN_PATH_D);
    }
    if (!cachedSwfFloorStainGladiatorPath) {
        cachedSwfFloorStainGladiatorPath = new Path2D(SWF_FLOOR_STAIN_GLADIATOR_PATH_D);
    }
    const transforms: Array<[number, number, number, number, number, number]> =
        Array.isArray(stainTransforms) && stainTransforms.length > 0
            ? stainTransforms
            : [[-0.5318, 1.1321, -0.6118, -0.9841, 340.8, 303.0]];

    for (const [a, b, c, d, tx, ty] of transforms) {
        const activePath = Math.abs(a) > 1.1 ? cachedSwfFloorStainGladiatorPath : cachedSwfFloorStainPath;
        ctx.save();
        ctx.translate(bounds.x + tx, bounds.y + ty);
        ctx.transform(a, b, c, d, 0, 0);
        ctx.fillStyle = patchColor;
        ctx.fill(activePath);
        ctx.strokeStyle = 'rgba(130, 118, 114, 0.45)';
        ctx.lineWidth = 0.85;
        ctx.stroke(activePath);
        ctx.restore();
    }
}

/**
 * Draws an axis-aligned 2.5D extruded 3D architectural block matching actual Boxhead 2Play SWF graphics:
 * - 'pyramid_pillar' (`#shape2` in Room 1 SWF):
 *   5-sided pointed-top pillar with collision box `[x, y, 64, 64]`,
 *   apex at `y - 49.15`, shoulder at `y - 37.8`, eave at `y + 7.45`, bottom at `y + 64`,
 *   left shadow `16px` (`rgba(0,0,0,0.25)`), white top facets (`#ffffff`),
 *   center roof triangle (`#b2b2b2`), lower vertical shaft (`#888888`), and crisp black outline.
 * - 'beveled_block' (`#shape2` in Room 2 "Buttons" SWF):
 *   Chamfered 8-sided button block with collision box `[x, y, 128, 96]`,
 *   white octagonal top (`#ffffff`), left chamfered side (`#9b9b9b`), center front (`#888888`),
 *   right chamfered side (`#bbbbbb`), left floor shadow (`rgba(0,0,0,0.25)`), and crisp outer black outline.
 * - 'tall_column' (`#shape3` in Room 4 "Gladiator" SWF):
 *   Octagonal stone column with collision box `[x, y, 64, 64]`,
 *   white 8-sided top (`#ffffff`), left chamfered side (`#a4a4a4`), center front (`#888888`),
 *   right chamfered side (`#bbbbbb`), left floor shadow (`rgba(0,0,0,0.25)`), and crisp outer black outline.
 * - 'classic_blue' / 'concrete' (`#shape5` in Room 1 SWF):
 *   Horizontal stone wall with collision box `[x, y, w, 64]`,
 *   white top (`#ffffff`) from `y - 30.55` to `y + 12.75`,
 *   grey front (`#888888`) from `y + 12.75` to `y + 58.0`,
 *   left shadow `12.8px` (`rgba(0,0,0,0.25)`), and crisp black outline.
 */
export interface ExtrudedBlockNeighborFlags {
    hasUpperPillar?: boolean;
    hasLowerPillar?: boolean;
}

/**
 * Precomputes vertical adjacency flags for room obstacles so vertical connectors
 * (`concrete` in Tight 2 / Massive / The Strips and `vertical_wall` in Mazey / Castle)
 * join seamlessly into `pyramid_pillar` roofs without exposing grey corner wedges.
 */
export function computeObstacleNeighborFlags(
    obstacles: Array<{ x: number; y: number; w: number; h: number; style?: WallStyle }>,
): Map<number, ExtrudedBlockNeighborFlags> {
    const map = new Map<number, ExtrudedBlockNeighborFlags>();
    for (let i = 0; i < obstacles.length; i++) {
        const a = obstacles[i];
        const styleA = a.style || 'classic_blue';
        if (styleA !== 'concrete' && styleA !== 'vertical_wall') continue;

        let hasUpperPillar = false;
        let hasLowerPillar = false;

        for (let j = 0; j < obstacles.length; j++) {
            if (i === j) continue;
            const b = obstacles[j];
            if (Math.abs(a.x - b.x) > 4) continue;
            const dy = b.y - a.y;
            if (b.style === 'pyramid_pillar' && Math.abs(dy - a.h) < 4) {
                hasLowerPillar = true;
            }
            if (styleA === 'concrete' && b.style === 'pyramid_pillar' && Math.abs(a.y - (b.y + 32)) < 4) {
                hasUpperPillar = true;
            }
        }

        if (hasUpperPillar || hasLowerPillar) {
            map.set(i, { hasUpperPillar, hasLowerPillar });
        }
    }
    return map;
}

/**
 * Draws ONLY the floor-level cast shadow (`rgba(0, 0, 0, 0.25)`) for an obstacle.
 * Rendering all obstacle floor shadows in a dedicated floor pass before any 3D wall/pillar
 * bodies prevents shadows from ever darkening adjacent horizontal walls or neighboring pillars.
 */
export function drawExtrudedBlockShadow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    style: WallStyle = 'classic_blue',
) {
    const scaleH = h / 64;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';

    if (style === 'tall_column') {
        const sx = w / 64;
        const sy = h / 64;
        const tx = x + 32.0 * sx;
        const ty = y + 32.0 * sy;
        ctx.beginPath();
        ctx.moveTo(tx - 57.55 * sx, ty - 27.75 * sy);
        ctx.lineTo(tx - 57.55 * sx, ty - 43.15 * sy);
        ctx.lineTo(tx - 41.55 * sx, ty - 58.5 * sy);
        ctx.lineTo(tx - 9.6 * sx, ty - 58.5 * sy);
        ctx.lineTo(tx + 6.4 * sx, ty - 43.15 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty + 2.1 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty + 20.7 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 31.95 * sx, ty + 17.5 * sy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
    }

    if (style === 'strip_pillar') {
        const sx = w / 64;
        const sy = h / 96;
        const tx = x + 32.0 * sx;
        const ty = y + 64.0 * sy;
        ctx.beginPath();
        ctx.moveTo(tx - 33.7 * sx, ty - 62.5 * sy);
        ctx.lineTo(tx - 29.35 * sx, ty - 66.15 * sy);
        ctx.lineTo(tx - 29.85 * sx, ty + 5.25 * sy);
        ctx.lineTo(tx - 26.7 * sx, ty + 18.75 * sy);
        ctx.lineTo(tx - 9.65 * sx, ty + 29.85 * sy);
        ctx.lineTo(tx - 28.9 * sx, ty + 25.85 * sy);
        ctx.lineTo(tx - 34.25 * sx, ty + 20.05 * sy);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(tx + 29.1 * sx, ty + 16.95 * sy);
        ctx.lineTo(tx + 29.05 * sx, ty + 20.9 * sy);
        ctx.lineTo(tx + 19.05 * sx, ty + 26.6 * sy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
    }

    if (style === 'tight_column') {
        const sx = w / 64;
        const sy = h / 64;
        const tx = x + 32.0 * sx;
        const ty = y + 32.0 * sy;
        ctx.beginPath();
        ctx.moveTo(tx + 5.2 * sx, ty - 44.3 * sy);
        ctx.lineTo(tx + 6.4 * sx, ty - 43.15 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty + 2.1 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty + 20.7 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 31.95 * sx, ty + 17.5 * sy);
        ctx.lineTo(tx - 57.5 * sx, ty - 27.65 * sy);
        ctx.lineTo(tx - 81.25 * sx, ty - 69.5 * sy);
        ctx.lineTo(tx - 81.25 * sx, ty - 84.9 * sy);
        ctx.lineTo(tx - 65.25 * sx, ty - 100.25 * sy);
        ctx.lineTo(tx - 33.3 * sx, ty - 100.25 * sy);
        ctx.lineTo(tx - 18.4 * sx, ty - 86.0 * sy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
    }

    if (style === 'beveled_block') {
        if (w >= 200) {
            const sx = w / 256;
            const sy = h / 192;
            const tx = x + 128.0 * sx;
            const ty = y + 64.0 * sy;
            ctx.beginPath();
            ctx.moveTo(tx - 128.0 * sx, ty - 78.8 * sy);
            ctx.lineTo(tx - 128.0 * sx, ty + 116.7 * sy);
            ctx.lineTo(tx - 140.8 * sx, ty + 94.1 * sy);
            ctx.lineTo(tx - 140.8 * sx, ty - 69.75 * sy);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            return;
        }
        const sx = w / 128;
        const sy = h / 96;
        const tx = x + 64.0 * sx;
        const ty = y + 64.0 * sy;
        ctx.beginPath();
        ctx.moveTo(tx - 64.0 * sx, ty - 78.85 * sy);
        ctx.lineTo(tx - 64.0 * sx, ty + 20.65 * sy);
        ctx.lineTo(tx - 76.8 * sx, ty - 1.95 * sy);
        ctx.lineTo(tx - 76.8 * sx, ty - 69.8 * sy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
    }

    if (style === 'pyramid_pillar') {
        const bottomY = y + h;
        const shadowW = 16 * (w / 64);
        const shadowTopY = y - 9.55 * scaleH;
        const shadowLeftBottomY = y + 35.7 * scaleH;
        ctx.beginPath();
        ctx.moveTo(x, shadowTopY);
        ctx.lineTo(x - shadowW, shadowTopY);
        ctx.lineTo(x - shadowW, shadowLeftBottomY);
        ctx.lineTo(x, bottomY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
    }

    if (style === 'vertical_wall') {
        const sx = w / 64;
        const sy = h / 128;
        const refX = x;
        const refY = y + 64.0 * sy;
        ctx.beginPath();
        ctx.moveTo(refX + 9.6 * sx, refY - 94.35 * sy);
        ctx.lineTo(refX + 22.4 * sx, refY - 71.75 * sy);
        ctx.lineTo(refX + 22.4 * sx, refY + 64.0 * sy);
        ctx.lineTo(refX + 6.4 * sx, refY + 64.0 * sy);
        ctx.lineTo(refX - 6.4 * sx, refY + 41.4 * sy);
        ctx.lineTo(refX - 6.4 * sx, refY - 94.35 * sy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
    }

    if (style === 'concrete') {
        const bottomY = y + 64.0 * scaleH;
        const shadowW = 12.8 * (w / 64);
        const shadowTopY = y - 3.85 * scaleH;
        const shadowLeftBottomY = y + 41.4 * scaleH;
        ctx.beginPath();
        ctx.moveTo(x, shadowTopY);
        ctx.lineTo(x - shadowW, shadowTopY);
        ctx.lineTo(x - shadowW, shadowLeftBottomY);
        ctx.lineTo(x, bottomY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        return;
    }

    // Standard Horizontal Wall ('classic_blue')
    const bottomY = y + 58.0 * scaleH;
    const shadowW = 12.8 * scaleH;
    const shadowTopY = y - 7.95 * scaleH;
    const shadowLeftBottomY = y + 35.35 * scaleH;
    ctx.beginPath();
    ctx.moveTo(x, shadowTopY);
    ctx.lineTo(x - shadowW, shadowTopY);
    ctx.lineTo(x - shadowW, shadowLeftBottomY);
    ctx.lineTo(x, bottomY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

export function drawExtrudedBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    _heightZ: number,
    _topColor: string = '#ffffff',
    _frontColor: string = '#888888',
    outlineColor: string = '#000000',
    castShadow: boolean = true,
    style: WallStyle = 'classic_blue',
    _bevelColor: string = '#b2b2b2',
    neighbors?: ExtrudedBlockNeighborFlags,
) {
    if (castShadow) {
        drawExtrudedBlockShadow(ctx, x, y, w, h, style);
    }

    const scaleH = h / 64;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    if (style === 'tall_column') {
        const sx = w / 64;
        const sy = h / 64;
        const tx = x + 32.0 * sx;
        const ty = y + 32.0 * sy;

        // 1. Pure White 8-Sided Octagonal Top Face (#ffffff)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(tx - 32.0 * sx, ty - 43.8 * sy);
        ctx.lineTo(tx - 32.0 * sx, ty - 59.15 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty - 74.5 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty - 74.5 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty - 59.15 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty - 40.55 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty - 29.25 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty - 29.25 * sy);
        ctx.closePath();
        ctx.fill();

        // 2. Left Chamfered Front-Side Face (#a4a4a4)
        ctx.fillStyle = '#a4a4a4';
        ctx.beginPath();
        ctx.moveTo(tx - 32.0 * sx, ty - 43.8 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty - 29.25 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 32.0 * sx, ty + 17.5 * sy);
        ctx.closePath();
        ctx.fill();

        // 3. Center Front Vertical Face (#888888)
        ctx.fillStyle = '#888888';
        ctx.beginPath();
        ctx.moveTo(tx - 16.0 * sx, ty - 29.25 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty - 29.25 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty + 32.0 * sy);
        ctx.closePath();
        ctx.fill();

        // 4. Right Chamfered Front-Side Face (#bbbbbb)
        ctx.fillStyle = '#bbbbbb';
        ctx.beginPath();
        ctx.moveTo(tx + 16.0 * sx, ty - 29.25 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty - 40.55 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty + 20.7 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty + 32.0 * sy);
        ctx.closePath();
        ctx.fill();

        // 5. Crisp Outer Black Silhouette Outline (#000000)
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(tx + 16.0 * sx, ty - 74.5 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty - 74.5 * sy);
        ctx.lineTo(tx - 32.0 * sx, ty - 59.15 * sy);
        ctx.lineTo(tx - 32.0 * sx, ty + 17.5 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty + 20.7 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty - 59.15 * sy);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
        return;
    }

    if (style === 'strip_pillar') {
        // cid=138: 64x96 horizontal/tilted octagonal column in Strip, Columns, Big One (origin at x+32, y+64)
        const sx = w / 64;
        const sy = h / 96;
        const tx = x + 32.0 * sx;
        const ty = y + 64.0 * sy;

        // 1. Four longitudinal octagonal prism facets along the fallen column body:
        // 1a. Left sloped longitudinal facet (#e4e4e7)
        ctx.fillStyle = '#e4e4e7';
        ctx.beginPath();
        ctx.moveTo(tx - 29.85 * sx, ty + 5.25 * sy);
        ctx.lineTo(tx - 29.25 * sx, ty - 77.25 * sy);
        ctx.lineTo(tx - 18.2 * sx, ty - 92.25 * sy);
        ctx.lineTo(tx - 18.75 * sx, ty - 9.75 * sy);
        ctx.closePath();
        ctx.fill();

        // 1b. Center-top flat longitudinal facet (#ffffff)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(tx - 18.75 * sx, ty - 9.75 * sy);
        ctx.lineTo(tx - 18.2 * sx, ty - 92.25 * sy);
        ctx.lineTo(tx + 10.2 * sx, ty - 95.35 * sy);
        ctx.lineTo(tx + 9.65 * sx, ty - 12.85 * sy);
        ctx.closePath();
        ctx.fill();

        // 1c. Right-upper sloped longitudinal facet (#f0f0f2)
        ctx.fillStyle = '#f0f0f2';
        ctx.beginPath();
        ctx.moveTo(tx + 9.65 * sx, ty - 12.85 * sy);
        ctx.lineTo(tx + 10.2 * sx, ty - 95.35 * sy);
        ctx.lineTo(tx + 27.55 * sx, ty - 83.45 * sy);
        ctx.lineTo(tx + 27.0 * sx, ty - 0.95 * sy);
        ctx.closePath();
        ctx.fill();

        // 1d. Rightmost steep side longitudinal facet (#d4d4d8)
        ctx.fillStyle = '#d4d4d8';
        ctx.beginPath();
        ctx.moveTo(tx + 27.0 * sx, ty - 0.95 * sy);
        ctx.lineTo(tx + 27.55 * sx, ty - 83.45 * sy);
        ctx.lineTo(tx + 31.3 * sx, ty - 67.2 * sy);
        ctx.lineTo(tx + 30.75 * sx, ty + 15.3 * sy);
        ctx.closePath();
        ctx.fill();

        // Crisp longitudinal ridge lines separating the 4 octagonal facets
        ctx.strokeStyle = '#c4c4cc';
        ctx.lineWidth = 0.95;
        ctx.beginPath();
        ctx.moveTo(tx - 18.2 * sx, ty - 92.25 * sy);
        ctx.lineTo(tx - 18.75 * sx, ty - 9.75 * sy);
        ctx.moveTo(tx + 10.2 * sx, ty - 95.35 * sy);
        ctx.lineTo(tx + 9.65 * sx, ty - 12.85 * sy);
        ctx.moveTo(tx + 27.55 * sx, ty - 83.45 * sy);
        ctx.lineTo(tx + 27.0 * sx, ty - 0.95 * sy);
        ctx.stroke();

        // 2. Front Octagonal End-Cap Cross-Section (#868686 with subtle bevel highlight)
        ctx.fillStyle = '#868686';
        ctx.beginPath();
        ctx.moveTo(tx - 29.85 * sx, ty + 5.25 * sy);
        ctx.lineTo(tx - 18.75 * sx, ty - 9.75 * sy);
        ctx.lineTo(tx + 9.65 * sx, ty - 12.85 * sy);
        ctx.lineTo(tx + 27.0 * sx, ty - 0.95 * sy);
        ctx.lineTo(tx + 30.75 * sx, ty + 15.3 * sy);
        ctx.lineTo(tx + 29.1 * sx, ty + 16.95 * sy);
        ctx.lineTo(tx + 19.05 * sx, ty + 26.6 * sy);
        ctx.lineTo(tx + 18.85 * sx, ty + 26.8 * sy);
        ctx.lineTo(tx - 9.55 * sx, ty + 29.9 * sy);
        ctx.lineTo(tx - 9.65 * sx, ty + 29.85 * sy);
        ctx.lineTo(tx - 26.7 * sx, ty + 18.75 * sy);
        ctx.closePath();
        ctx.fill();

        // Octagonal front eave ridge highlight between the longitudinal body and the #868686 end-cap
        ctx.strokeStyle = '#bdbdc4';
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(tx - 29.85 * sx, ty + 5.25 * sy);
        ctx.lineTo(tx - 18.75 * sx, ty - 9.75 * sy);
        ctx.lineTo(tx + 9.65 * sx, ty - 12.85 * sy);
        ctx.lineTo(tx + 27.0 * sx, ty - 0.95 * sy);
        ctx.lineTo(tx + 30.75 * sx, ty + 15.3 * sy);
        ctx.stroke();

        // 3. Crisp Outer Black Silhouette Outline
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(tx + 10.2 * sx, ty - 95.35 * sy);
        ctx.lineTo(tx - 18.2 * sx, ty - 92.25 * sy);
        ctx.lineTo(tx - 29.25 * sx, ty - 77.25 * sy);
        ctx.lineTo(tx - 29.85 * sx, ty + 5.25 * sy);
        ctx.lineTo(tx - 26.7 * sx, ty + 18.75 * sy);
        ctx.lineTo(tx - 9.65 * sx, ty + 29.85 * sy);
        ctx.lineTo(tx - 9.55 * sx, ty + 29.9 * sy);
        ctx.lineTo(tx + 18.85 * sx, ty + 26.8 * sy);
        ctx.lineTo(tx + 30.75 * sx, ty + 15.3 * sy);
        ctx.lineTo(tx + 31.3 * sx, ty - 67.2 * sy);
        ctx.lineTo(tx + 27.55 * sx, ty - 83.45 * sy);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
        return;
    }

    if (style === 'tight_column') {
        // cid=149: 64x64 extra-tall octagonal column in Tight (origin at x+32, y+32)
        const sx = w / 64;
        const sy = h / 64;
        const tx = x + 32.0 * sx;
        const ty = y + 32.0 * sy;

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(tx - 32.0 * sx, ty - 107.8 * sy);
        ctx.lineTo(tx - 32.0 * sx, ty - 123.15 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty - 138.5 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty - 138.5 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty - 123.15 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty - 104.55 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty - 93.25 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty - 93.25 * sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#a4a4a4';
        ctx.beginPath();
        ctx.moveTo(tx - 32.0 * sx, ty - 107.8 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty - 93.25 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 32.0 * sx, ty + 17.5 * sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#888888';
        ctx.beginPath();
        ctx.moveTo(tx - 16.0 * sx, ty - 93.25 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty - 93.25 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty + 32.0 * sy);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#bbbbbb';
        ctx.beginPath();
        ctx.moveTo(tx + 16.0 * sx, ty - 93.25 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty - 104.55 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty + 20.7 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty + 32.0 * sy);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(tx + 16.0 * sx, ty - 138.5 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty - 138.5 * sy);
        ctx.lineTo(tx - 32.0 * sx, ty - 123.15 * sy);
        ctx.lineTo(tx - 32.0 * sx, ty + 17.5 * sy);
        ctx.lineTo(tx - 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx + 16.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty + 20.7 * sy);
        ctx.lineTo(tx + 32.0 * sx, ty - 123.15 * sy);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
        return;
    }

    if (style === 'beveled_block') {
        if (w >= 200) {
            // cid=119: 256x192 large chamfered block in Patchy & Big One (origin at x+128, y+64)
            const sx = w / 256;
            const sy = h / 192;
            const tx = x + 128.0 * sx;
            const ty = y + 64.0 * sy;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(tx - 128.0 * sx, ty + 71.45 * sy);
            ctx.lineTo(tx - 128.0 * sx, ty - 92.45 * sy);
            ctx.lineTo(tx - 112.0 * sx, ty - 103.75 * sy);
            ctx.lineTo(tx + 112.0 * sx, ty - 103.75 * sy);
            ctx.lineTo(tx + 128.0 * sx, ty - 92.45 * sy);
            ctx.lineTo(tx + 128.0 * sx, ty + 71.45 * sy);
            ctx.lineTo(tx + 112.0 * sx, ty + 82.75 * sy);
            ctx.lineTo(tx - 112.0 * sx, ty + 82.75 * sy);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#888888';
            ctx.beginPath();
            ctx.moveTo(tx + 112.0 * sx, ty + 82.75 * sy);
            ctx.lineTo(tx + 112.0 * sx, ty + 128.0 * sy);
            ctx.lineTo(tx - 112.0 * sx, ty + 128.0 * sy);
            ctx.lineTo(tx - 112.0 * sx, ty + 82.75 * sy);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#bbbbbb';
            ctx.beginPath();
            ctx.moveTo(tx + 128.0 * sx, ty + 71.45 * sy);
            ctx.lineTo(tx + 128.0 * sx, ty + 116.7 * sy);
            ctx.lineTo(tx + 112.0 * sx, ty + 128.0 * sy);
            ctx.lineTo(tx + 112.0 * sx, ty + 82.75 * sy);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#9b9b9b';
            ctx.beginPath();
            ctx.moveTo(tx - 112.0 * sx, ty + 128.0 * sy);
            ctx.lineTo(tx - 128.0 * sx, ty + 116.7 * sy);
            ctx.lineTo(tx - 128.0 * sx, ty + 71.45 * sy);
            ctx.lineTo(tx - 112.0 * sx, ty + 82.75 * sy);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = 1.1;
            ctx.beginPath();
            ctx.moveTo(tx + 128.0 * sx, ty - 92.45 * sy);
            ctx.lineTo(tx + 112.0 * sx, ty - 103.75 * sy);
            ctx.lineTo(tx - 112.0 * sx, ty - 103.75 * sy);
            ctx.lineTo(tx - 128.0 * sx, ty - 92.45 * sy);
            ctx.lineTo(tx - 128.0 * sx, ty + 116.7 * sy);
            ctx.lineTo(tx - 112.0 * sx, ty + 128.0 * sy);
            ctx.lineTo(tx + 112.0 * sx, ty + 128.0 * sy);
            ctx.lineTo(tx + 128.0 * sx, ty + 116.7 * sy);
            ctx.closePath();
            ctx.stroke();

            ctx.restore();
            return;
        }

        const sx = w / 128;
        const sy = h / 96;
        const tx = x + 64.0 * sx;
        const ty = y + 64.0 * sy;

        // 1. Pure White 8-Sided Chamfered Top Face (#ffffff)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(tx + 64.0 * sx, ty - 24.55 * sy);
        ctx.lineTo(tx + 48.0 * sx, ty - 13.25 * sy);
        ctx.lineTo(tx - 48.0 * sx, ty - 13.25 * sy);
        ctx.lineTo(tx - 64.0 * sx, ty - 24.55 * sy);
        ctx.lineTo(tx - 64.0 * sx, ty - 92.45 * sy);
        ctx.lineTo(tx - 48.0 * sx, ty - 103.75 * sy);
        ctx.lineTo(tx + 48.0 * sx, ty - 103.75 * sy);
        ctx.lineTo(tx + 64.0 * sx, ty - 92.45 * sy);
        ctx.closePath();
        ctx.fill();

        // 2. Center Front Vertical Face (#888888)
        ctx.fillStyle = '#888888';
        ctx.beginPath();
        ctx.moveTo(tx + 48.0 * sx, ty - 13.25 * sy);
        ctx.lineTo(tx + 48.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 48.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 48.0 * sx, ty - 13.25 * sy);
        ctx.closePath();
        ctx.fill();

        // 3. Right Chamfered Front-Side Face (#bbbbbb)
        ctx.fillStyle = '#bbbbbb';
        ctx.beginPath();
        ctx.moveTo(tx + 48.0 * sx, ty - 13.25 * sy);
        ctx.lineTo(tx + 64.0 * sx, ty - 24.55 * sy);
        ctx.lineTo(tx + 64.0 * sx, ty + 20.7 * sy);
        ctx.lineTo(tx + 48.0 * sx, ty + 32.0 * sy);
        ctx.closePath();
        ctx.fill();

        // 4. Left Chamfered Front-Side Face (#9b9b9b)
        ctx.fillStyle = '#9b9b9b';
        ctx.beginPath();
        ctx.moveTo(tx - 64.0 * sx, ty - 24.55 * sy);
        ctx.lineTo(tx - 48.0 * sx, ty - 13.25 * sy);
        ctx.lineTo(tx - 48.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx - 64.0 * sx, ty + 20.7 * sy);
        ctx.closePath();
        ctx.fill();

        // 5. Crisp Outer Black Silhouette Outline (#000000)
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(tx + 48.0 * sx, ty - 103.75 * sy);
        ctx.lineTo(tx - 48.0 * sx, ty - 103.75 * sy);
        ctx.lineTo(tx - 64.0 * sx, ty - 92.45 * sy);
        ctx.lineTo(tx - 64.0 * sx, ty + 20.7 * sy);
        ctx.lineTo(tx - 48.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx + 48.0 * sx, ty + 32.0 * sy);
        ctx.lineTo(tx + 64.0 * sx, ty + 20.7 * sy);
        ctx.lineTo(tx + 64.0 * sx, ty - 92.45 * sy);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
        return;
    }

    if (style === 'pyramid_pillar') {
        const bottomY = y + h;
        const eaveY = y + 7.45 * scaleH;
        const shoulderY = y - 37.8 * scaleH;
        const apexX = x + w * 0.5;
        const apexY = y - 49.15 * scaleH;

        // 1. Pure White Base Fill for the 5-sided Pointed-Top Pillar (#ffffff)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x, bottomY);
        ctx.lineTo(x, shoulderY);
        ctx.lineTo(apexX, apexY);
        ctx.lineTo(x + w, shoulderY);
        ctx.lineTo(x + w, bottomY);
        ctx.closePath();
        ctx.fill();

        // 2. Center Pyramid Roof Triangle (#b2b2b2 in SWF)
        ctx.fillStyle = '#b2b2b2';
        ctx.beginPath();
        ctx.moveTo(apexX, apexY);
        ctx.lineTo(x + w, eaveY);
        ctx.lineTo(x, eaveY);
        ctx.closePath();
        ctx.fill();

        // 3. Lower Front Vertical Shaft (#888888 in SWF)
        ctx.fillStyle = '#888888';
        ctx.fillRect(x, eaveY, w, Math.max(2, bottomY - eaveY));

        // Subtle eave ridge highlight between the #b2b2b2 roof triangle and #888888 vertical shaft
        ctx.strokeStyle = '#9e9e9e';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(x, eaveY);
        ctx.lineTo(x + w, eaveY);
        ctx.stroke();

        // 4. Crisp Outer 5-Sided Black Outline
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(x, bottomY);
        ctx.lineTo(x, shoulderY);
        ctx.lineTo(apexX, apexY);
        ctx.lineTo(x + w, shoulderY);
        ctx.lineTo(x + w, bottomY);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
        return;
    }

    if (style === 'vertical_wall') {
        const sx = w / 64;
        const sy = h / 128;
        const refX = x;
        const refY = y + 64.0 * sy;
        const whiteBottomY = neighbors?.hasLowerPillar ? refY + 26.5 * sy : refY + 18.75 * sy;

        // 1. Pure White Vertical Top Slab (#ffffff)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(refX + 8.0 * sx, refY - 117.0 * sy, 48.0 * sx, whiteBottomY - (refY - 117.0 * sy));

        // 2. Lower Front Grey Face (#888888)
        ctx.fillStyle = '#888888';
        ctx.fillRect(refX + 8.0 * sx, whiteBottomY, 48.0 * sx, refY + 64.0 * sy - whiteBottomY);

        if (!neighbors?.hasLowerPillar) {
            ctx.fillStyle = '#d4d4d8';
            ctx.fillRect(refX + 8.0 * sx, whiteBottomY - 1.2, 48.0 * sx, 2.2);
        }

        // 3. Crisp Outer Black Outline (#000000)
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.1;
        ctx.strokeRect(refX + 8.0 * sx, refY - 117.0 * sy, 48.0 * sx, 181.0 * sy);

        ctx.restore();
        return;
    }

    if (style === 'concrete') {
        // cid=124: 64x64 square concrete block in Forest Box & Tight 2 (origin at x+32, y+32)
        const topY = neighbors?.hasUpperPillar ? y - 24.55 * scaleH : y - 26.5 * scaleH;
        const eaveY = neighbors?.hasLowerPillar ? y + 26.5 * scaleH : y + 18.75 * scaleH;
        const bottomY = y + 64.0 * scaleH;
        const totalVisualH = bottomY - topY;

        // 1. Pure White Top Face (#ffffff)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, topY, w, eaveY - topY);

        // 2. Lower Front Vertical Face (#888888 with subtle vertical shading & 3D eave bevel)
        const frontH = Math.max(2, bottomY - eaveY);
        const frontGrad = ctx.createLinearGradient(x, eaveY, x, bottomY);
        frontGrad.addColorStop(0.0, '#969696');
        frontGrad.addColorStop(0.25, '#888888');
        frontGrad.addColorStop(1.0, '#7c7c7c');
        ctx.fillStyle = frontGrad;
        ctx.fillRect(x, eaveY, w, frontH);

        if (!neighbors?.hasLowerPillar) {
            // 3D chamfered eave highlight strip between the white roof and grey front face
            ctx.fillStyle = '#d4d4d8';
            ctx.fillRect(x, eaveY - 1.2 * scaleH, w, 2.2 * scaleH);
            ctx.strokeStyle = '#a8a8b0';
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(x, eaveY + 1.0 * scaleH);
            ctx.lineTo(x + w, eaveY + 1.0 * scaleH);
            ctx.stroke();
        }

        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = 1.1;
        ctx.strokeRect(x, topY, w, totalVisualH);

        ctx.restore();
        return;
    }

    // Standard Horizontal Wall / Block ('classic_blue' — exact #shape5 in SWF):
    const topY = y - 30.55 * scaleH;
    const eaveY = y + 12.75 * scaleH;
    const bottomY = y + 58.0 * scaleH;
    const totalVisualH = bottomY - topY;

    // 1. Pure White Top Face (#ffffff)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, topY, w, eaveY - topY);

    // 2. Lower Front Vertical Face (#888888 with subtle vertical depth gradient)
    const frontH = Math.max(2, bottomY - eaveY);
    const wallGrad = ctx.createLinearGradient(x, eaveY, x, bottomY);
    wallGrad.addColorStop(0.0, '#969696');
    wallGrad.addColorStop(0.25, '#888888');
    wallGrad.addColorStop(1.0, '#7c7c7c');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(x, eaveY, w, frontH);

    // 3. 3D Chamfered Eave Bevel Strip along the roof-to-wall corner
    ctx.fillStyle = '#d4d4d8';
    ctx.fillRect(x, eaveY - 1.2 * scaleH, w, 2.2 * scaleH);
    ctx.strokeStyle = '#a8a8b0';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, eaveY + 1.0 * scaleH);
    ctx.lineTo(x + w, eaveY + 1.0 * scaleH);
    ctx.stroke();

    // 4. Crisp Outer Black Outline
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = 1.1;
    ctx.strokeRect(x, topY, w, totalVisualH);

    ctx.restore();
}

/**
 * Draws the SWF Editor Map Parameters (for MapViewerModal inspection only):
 * - Optional SWF `#sprite4` blue collision boxes (`rgba(0, 0, 255, 0.5)`)
 * - Outer Red Camera Visible Limit Rectangle (`bounds` — `_Size`) + diagonal X lines
 * - All 1 / 2 / P / Z / D / B / W spawn markers matching the SWF colors
 */
export function drawRoomBoundsAndSpawnNodes(
    ctx: CanvasRenderingContext2D,
    bounds: RoomBounds,
    spawnNodes: SpawnNode[],
    obstacles?: Array<{ x: number; y: number; w: number; h: number }>,
    showSwfCollisionGizmos: boolean = false,
) {
    ctx.save();

    // 0. Optional SWF `#sprite4` Blue Collision Overlay (`#0000ff` at 0.5 opacity)
    if (showSwfCollisionGizmos && obstacles) {
        obstacles.forEach((ob) => {
            ctx.fillStyle = 'rgba(0, 0, 255, 0.50)';
            ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
        });
    }

    // 1. Red camera visibility-limit rectangle (`_Size`) and diagonal X crosshairs.
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2.0;
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);

    ctx.beginPath();
    ctx.moveTo(bounds.x, bounds.y);
    ctx.lineTo(bounds.x + bounds.w, bounds.y + bounds.h);
    ctx.moveTo(bounds.x + bounds.w, bounds.y);
    ctx.lineTo(bounds.x, bounds.y + bounds.h);
    ctx.stroke();

    // 2. Spawn Node Circles ('1', '2' with arrow, 'P', 'Z', 'D', 'B', 'W')
    ctx.font = 'bold 12px Calibri, "JetBrains Mono", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    spawnNodes.forEach((node) => {
        const r = 13;
        let fill = '#999999';
        const border = 'rgba(0, 0, 255, 0.50)';

        if (node.kind === '1' || node.kind === '2') {
            fill = 'rgba(0, 0, 255, 0.50)';
        } else if (node.kind === 'P') {
            fill = '#ff3300';
        } else if (node.kind === 'D') {
            fill = '#ff0000';
        } else if (node.kind === 'Z') {
            fill = '#999999';
        } else if (node.kind === 'B') {
            fill = '#ff6600';
        } else if (node.kind === 'W') {
            fill = '#cccccc';
        }

        ctx.fillStyle = fill;
        ctx.strokeStyle = border;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Directional arrow inside '1' and '2' nodes (matching SWF #shape27 / #shape42)
        if ((node.kind === '1' || node.kind === '2') && node.angle !== undefined) {
            ctx.save();
            ctx.translate(node.x, node.y);
            ctx.rotate(node.angle);
            ctx.fillStyle = '#0000cc';
            ctx.strokeStyle = '#0000cc';
            ctx.lineWidth = 1.0;
            ctx.beginPath();
            ctx.moveTo(5.95, -1.6);
            ctx.lineTo(-7.75, -1.6);
            ctx.lineTo(-7.75, 1.6);
            ctx.lineTo(5.95, 1.6);
            ctx.lineTo(5.95, 4.6);
            ctx.lineTo(10.55, 0.0);
            ctx.lineTo(5.95, -4.55);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = '#000000';
        ctx.fillText(node.kind, node.x, node.y + 0.5);
    });

    ctx.restore();
}
