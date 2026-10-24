import {
    type BBAssetId,
    BBMODEL_CATALOG,
    BBMODEL_LIST,
    loadBBModelById,
    loadStandaloneBBModelAssets,
} from '@/data/bbmodelCatalog';
import type { CustomAssetSlot } from './customAssetStore';
import { ISO_Z_SCALE, shadeHex } from './rendering/isoModelRenderer';

const BB_MARKER_COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#a3e635'];

/**
 * Downloads the complete skeletal-rigged Blockbench (.bbmodel v4.5) file
 * (including hierarchical bone outliner, joint origins, and keyframe walk/idle animations)
 * for any of the 18 game assets (`bambo`, `zombie`, `devil`, `pistol`, `uzi`, `shotgun`, `barrel`, etc.)
 */
export async function downloadBlockbenchStarterModel(slot: CustomAssetSlot) {
    const model = await loadBBModelById(slot, true);
    if (!model) return;

    const jsonString = JSON.stringify(model.rawBBModelJSON, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boxhead_${slot}.bbmodel`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Downloads a complete JSON archive containing all 18 skeletal-rigged .bbmodel files in the game.
 */
export async function downloadAllBBModelsArchive() {
    await loadStandaloneBBModelAssets();
    const bundle: Record<string, unknown> = {};
    BBMODEL_LIST.forEach((item) => {
        bundle[`boxhead_${item.id}.bbmodel`] = item.rawBBModelJSON;
    });
    const jsonString = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'boxhead_all_18_skeletal_bbmodels.json';
    a.click();
    URL.revokeObjectURL(url);
}

function rgbToHex(r: number, g: number, b: number): string {
    const h = (n: number) =>
        Math.max(0, Math.min(255, Math.round(n)))
            .toString(16)
            .padStart(2, '0');
    return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Parses a user-edited Blockbench (.bbmodel) JSON file, updates the live skeletal
 * `BBMODEL_CATALOG` entry if applicable, and also compiles an 8-direction Isometric
 * 2.5D Sprite Sheet (1024x128) with crisp cartoon outlines.
 */
export async function compileBBModelTo8DirSheet(jsonText: string, targetSlot?: BBAssetId): Promise<string> {
    const parsed = JSON.parse(jsonText);
    const elements: Array<{
        uuid?: string;
        name?: string;
        from: [number, number, number];
        to: [number, number, number];
        origin?: [number, number, number];
        rotation?: [number, number, number];
        color?: number;
        faces?: Record<string, { uv?: [number, number, number, number]; texture?: number | null }>;
    }> = Array.isArray(parsed.elements) ? parsed.elements : [];

    if (elements.length === 0) {
        throw new Error('No cubes (elements) were found in this .bbmodel file.');
    }

    // Load first embedded texture if present to sample UV colors
    let texCanvas: HTMLCanvasElement | null = null;
    let texCtx: CanvasRenderingContext2D | null = null;
    const resW = parsed.resolution?.width || 64;
    const resH = parsed.resolution?.height || 64;

    if (Array.isArray(parsed.textures) && parsed.textures[0]?.source) {
        const img = await new Promise<HTMLImageElement | null>((resolve) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = () => resolve(null);
            im.src = parsed.textures[0].source;
        });
        if (img) {
            texCanvas = document.createElement('canvas');
            texCanvas.width = img.naturalWidth || resW;
            texCanvas.height = img.naturalHeight || resH;
            texCtx = texCanvas.getContext('2d');
            texCtx?.drawImage(img, 0, 0);
        }
    }

    const sampleElementColor = (el: (typeof elements)[0]): string => {
        if (texCtx && texCanvas && el.faces) {
            const face = el.faces.up || el.faces.south || el.faces.north || Object.values(el.faces)[0];
            if (face && Array.isArray(face.uv) && face.uv.length >= 4) {
                const uMid = ((face.uv[0] + face.uv[2]) / 2 / resW) * texCanvas.width;
                const vMid = ((face.uv[1] + face.uv[3]) / 2 / resH) * texCanvas.height;
                const px = texCtx.getImageData(
                    Math.max(0, Math.min(texCanvas.width - 1, Math.floor(uMid))),
                    Math.max(0, Math.min(texCanvas.height - 1, Math.floor(vMid))),
                    1,
                    1,
                ).data;
                if (px[3] > 20) {
                    return rgbToHex(px[0], px[1], px[2]);
                }
            }
        }
        const nm = (el.name || '').toLowerCase();
        if (
            nm.includes('hair') ||
            nm.includes('boot') ||
            nm.includes('pant') ||
            nm.includes('gun') ||
            nm.includes('pistol') ||
            nm.includes('horn') ||
            nm.includes('fist')
        ) {
            return '#18181b';
        }
        if (nm.includes('bandana') || nm.includes('devil') || nm.includes('red') || nm.includes('stripe')) {
            return '#dc2626';
        }
        if (nm.includes('zombie') || nm.includes('blue')) {
            return '#5b9bd5';
        }
        if (nm.includes('shirt') || nm.includes('sleeve')) {
            return '#f8fafc';
        }
        if (nm.includes('skin') || nm.includes('head') || nm.includes('arm') || nm.includes('torso')) {
            return '#e2b281';
        }
        return BB_MARKER_COLORS[(el.color ?? 0) % BB_MARKER_COLORS.length];
    };

    // If targetSlot is provided, also hot-update its live skeletal cubes in BBMODEL_CATALOG!
    if (targetSlot && BBMODEL_CATALOG[targetSlot]) {
        const model = BBMODEL_CATALOG[targetSlot];
        model.rawBBModelJSON = parsed;
        model.cubes = elements.map((el, idx) => {
            const existing = model.cubes[idx];
            return {
                uuid: el.uuid || existing?.uuid || `custom-${idx}`,
                name: el.name || existing?.name || `Cube_${idx}`,
                from: el.from,
                to: el.to,
                origin: el.origin || existing?.origin || [0, 0, 0],
                rotation: el.rotation || existing?.rotation || [0, 0, 0],
                hexColor: sampleElementColor(el),
                bonePath: existing?.bonePath || ['root'],
            };
        });
    }

    // Render 8 directions onto a 1024x128 sprite sheet
    const frameSize = 128;
    const sheet = document.createElement('canvas');
    sheet.width = frameSize * 8;
    sheet.height = frameSize;
    const ctx = sheet.getContext('2d');
    if (!ctx) throw new Error('Unable to create a 2D canvas context');

    const SCALE = 2.15;
    const Y_PERSP = 0.86;

    for (let dir = 0; dir < 8; dir++) {
        const angle = dir * (Math.PI / 4);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const centerX = dir * frameSize + frameSize / 2;
        const baseY = frameSize * 0.82;

        const prepared = elements.map((el) => {
            const minX = Math.min(el.from[0], el.to[0]);
            const maxX = Math.max(el.from[0], el.to[0]);
            const minY = Math.min(el.from[1], el.to[1]);
            const maxY = Math.max(el.from[1], el.to[1]);
            const minZ = Math.min(el.from[2], el.to[2]);
            const maxZ = Math.max(el.from[2], el.to[2]);

            const cxLocal = (minX + maxX) / 2;
            const cyLocal = (minY + maxY) / 2;
            const czLocal = (minZ + maxZ) / 2;

            const worldY = (czLocal * sin + cxLocal * cos) * SCALE;

            const sortDepth = worldY * Y_PERSP + cyLocal * SCALE * 0.85;

            return {
                el,
                minX,
                maxX,
                minY,
                maxY,
                minZ,
                maxZ,
                sortDepth,
                baseColor: sampleElementColor(el),
            };
        });

        prepared.sort((a, b) => a.sortDepth - b.sortDepth);

        prepared.forEach((item) => {
            const { minX, maxX, minY, maxY, minZ, maxZ, baseColor } = item;

            const corners = [
                { f: maxZ, s: maxX },
                { f: maxZ, s: minX },
                { f: minZ, s: minX },
                { f: minZ, s: maxX },
            ];

            const zTop = maxY * SCALE * ISO_Z_SCALE;
            const zBot = minY * SCALE * ISO_Z_SCALE;

            const topPts = corners.map((c) => ({
                x: centerX + (c.f * cos - c.s * sin) * SCALE,
                y: baseY + (c.f * sin + c.s * cos) * SCALE * Y_PERSP - zTop,
            }));

            const botPts = corners.map((c) => ({
                x: centerX + (c.f * cos - c.s * sin) * SCALE,
                y: baseY + (c.f * sin + c.s * cos) * SCALE * Y_PERSP - zBot,
            }));

            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.lineWidth = 2.4;
            ctx.strokeStyle = '#09090b';

            for (let i = 0; i < 4; i++) {
                const next = (i + 1) % 4;
                const p1 = topPts[i];
                const p2 = topPts[next];
                const b2 = botPts[next];
                const b1 = botPts[i];

                if (p1.x - p2.x > -0.5) {
                    const shade = p2.y - p1.y > 0 ? 0.9 : 0.72;
                    ctx.fillStyle = shadeHex(baseColor, shade);
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.lineTo(b2.x, b2.y);
                    ctx.lineTo(b1.x, b1.y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            }

            ctx.fillStyle = shadeHex(baseColor, 1.07);
            ctx.beginPath();
            ctx.moveTo(topPts[0].x, topPts[0].y);
            ctx.lineTo(topPts[1].x, topPts[1].y);
            ctx.lineTo(topPts[2].x, topPts[2].y);
            ctx.lineTo(topPts[3].x, topPts[3].y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });
    }

    return sheet.toDataURL('image/png');
}
