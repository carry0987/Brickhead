import type { BBBoneName, CompiledBBModel } from '@/data/bbmodelCatalog';
import { type CustomAssetSlot, customAssetStore } from '../customAssetStore';

export const ISO_Z_SCALE = 0.88; // Vertical Z extrusion factor for 2.5D camera tilt (~60 deg)
const Y_PERSP = 0.86;

const shadeCache = new Map<string, string>();

export function shadeHex(hex: string, factor: number): string {
    const key = `${hex}_${factor.toFixed(2)}`;
    const cached = shadeCache.get(key);
    if (cached) return cached;

    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * factor)));
    const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * factor)));
    const b = Math.min(255, Math.max(0, Math.round((num & 255) * factor)));
    const res = `rgb(${r},${g},${b})`;
    shadeCache.set(key, res);
    return res;
}

export function tryDrawCustomSprite(
    ctx: CanvasRenderingContext2D,
    slot: CustomAssetSlot,
    x: number,
    y: number,
    angle: number,
    _walkCycle: number,
    _isMoving: boolean,
    baseSize: number,
    isFlashing: boolean = false,
): boolean {
    const img = customAssetStore.getImage(slot);
    const entry = customAssetStore.getEntry(slot);
    if (!img || !entry) return false;

    const scale = entry.scale || 1;
    const drawSize = baseSize * scale;
    const bobY = 0;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 3, drawSize * 0.28, drawSize * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (isFlashing) {
        ctx.filter = 'brightness(2.5) contrast(1.2)';
    }

    if (entry.mode === 'sheet_8dir') {
        const step = Math.PI / 4;
        const dir8 = ((Math.round(angle / step) % 8) + 8) % 8;
        const frameW = img.naturalWidth / 8;
        const frameH = img.naturalHeight;
        ctx.drawImage(
            img,
            dir8 * frameW,
            0,
            frameW,
            frameH,
            x - drawSize / 2,
            y - drawSize * 0.82 - bobY,
            drawSize,
            drawSize,
        );
    } else if (entry.mode === 'single_rotatable') {
        ctx.translate(x, y - drawSize * 0.35 - bobY);
        ctx.rotate(angle);
        ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    } else {
        ctx.translate(x, y - drawSize * 0.42 - bobY);
        if (Math.cos(angle) < -0.25) {
            ctx.scale(-1, 1);
        }
        ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    }

    ctx.restore();
    return true;
}

export interface BoneTransform3D {
    pitchX: number; // radians around X (forward/backward swing in Y-Z plane)
    yawY: number; // radians around Y (twist in X-Z plane)
    rollZ: number; // radians around Z (side tilt in X-Y plane)
    tx: number;
    ty: number;
    tz: number;
}

export type SkeletalPoseMap = Partial<Record<BBBoneName, BoneTransform3D>>;

function rotatePointAroundOrigin(
    px: number,
    py: number,
    pz: number,
    ox: number,
    oy: number,
    oz: number,
    pitchX: number,
    yawY: number,
    rollZ: number,
    tx: number = 0,
    ty: number = 0,
    tz: number = 0,
): [number, number, number] {
    let x = px - ox;
    let y = py - oy;
    let z = pz - oz;

    // 1. Pitch around X axis (tilts Y and Z: positive pitch swings lower limb forward +Z)
    if (pitchX !== 0) {
        const c = Math.cos(pitchX);
        const s = Math.sin(pitchX);
        const ny = y * c - z * s;
        const nz = y * s + z * c;
        y = ny;
        z = nz;
    }

    // 2. Roll around Z axis (tilts X and Y)
    if (rollZ !== 0) {
        const c = Math.cos(rollZ);
        const s = Math.sin(rollZ);
        const nx = x * c - y * s;
        const ny = x * s + y * c;
        x = nx;
        y = ny;
    }

    // 3. Yaw around Y axis (twists X and Z)
    if (yawY !== 0) {
        const c = Math.cos(yawY);
        const s = Math.sin(yawY);
        const nx = x * c + z * s;
        const nz = -x * s + z * c;
        x = nx;
        z = nz;
    }

    return [x + ox + tx, y + oy + ty, z + oz + tz];
}

const CUBE_FACES: Array<{ indices: [number, number, number, number]; baseShade: number }> = [
    { indices: [4, 5, 6, 7], baseShade: 1.08 }, // Up (+Y)
    { indices: [0, 3, 2, 1], baseShade: 0.58 }, // Down (-Y)
    { indices: [3, 2, 6, 7], baseShade: 0.92 }, // Front (+Z)
    { indices: [1, 0, 4, 5], baseShade: 0.72 }, // Back (-Z)
    { indices: [2, 1, 5, 6], baseShade: 0.86 }, // Right (+X)
    { indices: [0, 3, 7, 4], baseShade: 0.78 }, // Left (-X)
];

/**
 * Core 3D Skeletal .bbmodel Renderer
 * Traverses the bone hierarchy, applies 3D joint rotations around each bone's `origin`,
 * attaches optional child .bbmodel (such as the active weapon in `weapon_mount_bone`),
 * depth-sorts posed cubes, and renders visible 3D faces with Boxhead ink outlines.
 */
export function renderSkeletalBBModel(
    ctx: CanvasRenderingContext2D,
    model: CompiledBBModel,
    screenX: number,
    screenY: number,
    angle: number,
    pose: SkeletalPoseMap,
    options?: {
        attachedWeaponModel?: CompiledBBModel;
        isFlashing?: boolean;
        colorOverrides?: Partial<Record<string, string>>;
        scaleMultiplier?: number;
    },
) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const scale = model.scale * (options?.scaleMultiplier ?? 1);
    const isFlashing = options?.isFlashing ?? false;

    const attachedWeapon = options?.attachedWeaponModel;
    const allCubes = attachedWeapon
        ? [
              ...model.cubes.map((c) => ({ cube: c, isWeaponCube: false })),
              ...attachedWeapon.cubes.map((c) => ({ cube: c, isWeaponCube: true })),
          ]
        : model.cubes.map((c) => ({ cube: c, isWeaponCube: false }));

    const DEG2RAD = Math.PI / 180;

    // Resolve target character socket origin when mounting an origin-centered [0,0,0] weapon
    const weaponSocketName: BBBoneName = attachedWeapon?.mountSocket || 'weapon_mount_bone';
    const charSocketOrigin: [number, number, number] =
        model.bones[weaponSocketName]?.origin ||
        (weaponSocketName === 'shoulder_mount_bone' ? [6.8, 18.8, 5.8] : [6.7, 15.2, 10.2]);
    const charArmParentChain: BBBoneName[] = ['right_forearm_bone', 'right_arm_bone', 'body_bone', 'root'];

    // Transform all cubes through their skeletal bone chains
    const posedCubes = allCubes.map(({ cube, isWeaponCube }) => {
        const [x0, y0, z0] = cube.from;
        const [x1, y1, z1] = cube.to;

        const rawCorners: Array<[number, number, number]> = [
            [x0, y0, z0], // 0
            [x1, y0, z0], // 1
            [x1, y0, z1], // 2
            [x0, y0, z1], // 3
            [x0, y1, z0], // 4
            [x1, y1, z0], // 5
            [x1, y1, z1], // 6
            [x0, y1, z1], // 7
        ];

        const [rx, ry, rz] = cube.rotation;
        const hasLocalRot = rx !== 0 || ry !== 0 || rz !== 0;
        const [cox, coy, coz] = cube.origin;

        // Walk from deepest bone up to 'root'
        const worldVerts = rawCorners.map(([vx, vy, vz]) => {
            let px = vx;
            let py = vy;
            let pz = vz;

            if (hasLocalRot) {
                [px, py, pz] = rotatePointAroundOrigin(
                    px,
                    py,
                    pz,
                    cox,
                    coy,
                    coz,
                    rx * DEG2RAD,
                    ry * DEG2RAD,
                    rz * DEG2RAD,
                );
            }

            if (isWeaponCube && attachedWeapon) {
                // 1. Apply weapon-local mechanical sub-bones (slide, pump, warhead, breech, coil) around weapon's [0,0,0]-centered bone origins
                for (let bIdx = cube.bonePath.length - 1; bIdx >= 0; bIdx--) {
                    const bName = cube.bonePath[bIdx];
                    if (bName === 'weapon_mount_bone' || bName === 'root') continue;
                    const bTransform = pose[bName];
                    if (bTransform) {
                        const bOrigin = attachedWeapon.bones?.[bName]?.origin || [0, 0, 0];
                        [px, py, pz] = rotatePointAroundOrigin(
                            px,
                            py,
                            pz,
                            bOrigin[0],
                            bOrigin[1],
                            bOrigin[2],
                            bTransform.pitchX,
                            bTransform.yawY,
                            bTransform.rollZ,
                            bTransform.tx,
                            bTransform.ty,
                            bTransform.tz,
                        );
                    }
                }

                // 2. Mount weapon from its local [0, 0, 0] origin onto the character's target socket bone (hand or shoulder)
                px += charSocketOrigin[0];
                py += charSocketOrigin[1];
                pz += charSocketOrigin[2];

                // 3. Walk up the character's right arm & body bone hierarchy
                for (let i = 0; i < charArmParentChain.length; i++) {
                    const bName = charArmParentChain[i];
                    const bTransform = pose[bName];
                    if (bTransform) {
                        const bOrigin = model.bones[bName]?.origin || [0, 0, 0];
                        [px, py, pz] = rotatePointAroundOrigin(
                            px,
                            py,
                            pz,
                            bOrigin[0],
                            bOrigin[1],
                            bOrigin[2],
                            bTransform.pitchX,
                            bTransform.yawY,
                            bTransform.rollZ,
                            bTransform.tx,
                            bTransform.ty,
                            bTransform.tz,
                        );
                    }
                }
            } else {
                for (let bIdx = cube.bonePath.length - 1; bIdx >= 0; bIdx--) {
                    const bName = cube.bonePath[bIdx];
                    const bTransform = pose[bName];
                    if (bTransform) {
                        const bOrigin = model.bones[bName]?.origin || [0, 0, 0];
                        [px, py, pz] = rotatePointAroundOrigin(
                            px,
                            py,
                            pz,
                            bOrigin[0],
                            bOrigin[1],
                            bOrigin[2],
                            bTransform.pitchX,
                            bTransform.yawY,
                            bTransform.rollZ,
                            bTransform.tx,
                            bTransform.ty,
                            bTransform.tz,
                        );
                    }
                }
            }

            // Convert from Blockbench model space (X=side, Y=up, Z=forward) to arena world space
            const wx = (pz * cosA - px * sinA) * scale;
            const wy = (pz * sinA + px * cosA) * scale;
            const wz = py * scale;

            const sx = screenX + wx;
            const sy = screenY + wy * Y_PERSP - wz * ISO_Z_SCALE;

            return { wx, wy, wz, sx, sy };
        });

        // Cube center in world space
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (let i = 0; i < 8; i++) {
            cx += worldVerts[i].wx;
            cy += worldVerts[i].wy;
            cz += worldVerts[i].wz;
        }
        cx /= 8;
        cy /= 8;
        cz /= 8;

        // Painter's algorithm depth sort key (higher wy and higher wz are closer to viewer)
        const sortDepth = cy * Y_PERSP + cz * ISO_Z_SCALE;

        const hexColor = isFlashing ? '#ffffff' : options?.colorOverrides?.[cube.name] || cube.hexColor;

        return {
            cube,
            worldVerts,
            cx,
            cy,
            cz,
            sortDepth,
            hexColor,
        };
    });

    // Sort back-to-front
    posedCubes.sort((a, b) => a.sortDepth - b.sortDepth);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#09090b';
    ctx.lineWidth = 2.1;

    // Camera view vector in (wx, wy, wz) space pointing toward the viewer
    const camY = ISO_Z_SCALE;
    const camZ = Y_PERSP;

    for (let cIdx = 0; cIdx < posedCubes.length; cIdx++) {
        const item = posedCubes[cIdx];
        const v = item.worldVerts;

        // Collect visible faces for this cube and sort them by face depth
        const visibleFaces: Array<{
            indices: [number, number, number, number];
            shade: number;
            faceDepth: number;
        }> = [];

        for (let fIdx = 0; fIdx < CUBE_FACES.length; fIdx++) {
            const face = CUBE_FACES[fIdx];
            const [i0, i1, i2, i3] = face.indices;
            const p0 = v[i0];
            const p1 = v[i1];
            const p2 = v[i2];
            const p3 = v[i3];

            // Face center
            const fcx = (p0.wx + p1.wx + p2.wx + p3.wx) * 0.25;
            const fcy = (p0.wy + p1.wy + p2.wy + p3.wy) * 0.25;
            const fcz = (p0.wz + p1.wz + p2.wz + p3.wz) * 0.25;

            // Outward vector from cube center to face center
            const outX = fcx - item.cx;
            const outY = fcy - item.cy;
            const outZ = fcz - item.cz;

            // Edge vectors for true normal
            const e1x = p1.wx - p0.wx;
            const e1y = p1.wy - p0.wy;
            const e1z = p1.wz - p0.wz;
            const e2x = p2.wx - p0.wx;
            const e2y = p2.wy - p0.wy;
            const e2z = p2.wz - p0.wz;

            let nx = e1y * e2z - e1z * e2y;
            let ny = e1z * e2x - e1x * e2z;
            let nz = e1x * e2y - e1y * e2x;

            // Ensure normal points outward from cube center
            if (nx * outX + ny * outY + nz * outZ < 0) {
                nx = -nx;
                ny = -ny;
                nz = -nz;
            }

            // Visibility dot product with camera view vector (0, camY, camZ)
            const dotCam = ny * camY + nz * camZ;
            if (dotCam > 0.01) {
                const nLen = Math.hypot(nx, ny, nz) || 1;
                // Directional studio lighting: top-left-front light source (-0.35, 0.45, 0.82)
                const lightDot = (nx * -0.35 + ny * 0.45 + nz * 0.82) / nLen;
                const dynamicShade = Math.max(0.66, Math.min(1.12, 0.88 + lightDot * 0.22));

                visibleFaces.push({
                    indices: face.indices,
                    shade: dynamicShade,
                    faceDepth: fcy * Y_PERSP + fcz * ISO_Z_SCALE,
                });
            }
        }

        visibleFaces.sort((a, b) => a.faceDepth - b.faceDepth);

        for (let f = 0; f < visibleFaces.length; f++) {
            const vf = visibleFaces[f];
            const [i0, i1, i2, i3] = vf.indices;
            ctx.fillStyle = shadeHex(item.hexColor, vf.shade);
            ctx.beginPath();
            ctx.moveTo(v[i0].sx, v[i0].sy);
            ctx.lineTo(v[i1].sx, v[i1].sy);
            ctx.lineTo(v[i2].sx, v[i2].sy);
            ctx.lineTo(v[i3].sx, v[i3].sy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }
}
