import { type BBAssetId, BBMODEL_CATALOG } from '@/data/bbmodelCatalog';
import type { ActiveSvgEffect, SvgEffectId, WeaponId } from '@/types/game';
import { assetUrl } from './assetUrl';
import { clamp } from './battleGeometry';

const ISO_Z_SCALE = 0.88;
const Y_PERSP = 0.86;
const DEFAULT_BASE_EXPLOSION_RADIUS = 96.0;

export interface SvgEffectFrameSpec {
    frame: number;
    file?: string;
    url: string;
    scaleX?: number;
    bottomScaleY?: number;
    topScaleY?: number;
    stopOpacity?: number;
}

export interface SvgEffectCatalogEntry {
    id: SvgEffectId;
    spriteId?: number | null;
    category: 'EXPLOSION' | 'WEAPON_MUZZLE' | 'IMPACT';
    frameCount: number;
    defaultDurationMs: number;
    width: number;
    height: number;
    originX: number;
    originY: number;
    baseRadius?: number;
    rotatable: boolean;
    basePath?: string;
    frames: SvgEffectFrameSpec[];
}

export interface SvgEffectsCatalogJson {
    version: string;
    description?: string;
    effects: Record<string, Omit<SvgEffectCatalogEntry, 'frameCount'>>;
}

function createEmptyCatalogEntry(
    id: SvgEffectId,
    category: 'EXPLOSION' | 'WEAPON_MUZZLE' | 'IMPACT' = 'WEAPON_MUZZLE',
    defaultDurationMs = 110,
): SvgEffectCatalogEntry {
    return {
        id,
        spriteId: null,
        category,
        frameCount: 0,
        defaultDurationMs,
        width: 64,
        height: 64,
        originX: 32,
        originY: 32,
        baseRadius: category === 'EXPLOSION' ? DEFAULT_BASE_EXPLOSION_RADIUS : undefined,
        rotatable: category !== 'EXPLOSION',
        basePath: `assets/effects/${id}`,
        frames: [],
    };
}

/**
 * Runtime catalog populated exclusively from `public/assets/effects/index.json`.
 * Avoids duplicating frame definitions or metadata in TypeScript code.
 */
export const SVG_EFFECT_CATALOG: Record<SvgEffectId, SvgEffectCatalogEntry> = {
    explosion: createEmptyCatalogEntry('explosion', 'EXPLOSION', 450),
    explosion_dome: createEmptyCatalogEntry('explosion_dome', 'EXPLOSION', 450),
    explosion_midair: createEmptyCatalogEntry('explosion_midair', 'EXPLOSION', 450),
    rocket_smoke: createEmptyCatalogEntry('rocket_smoke', 'IMPACT', 320),
    fake_wall_smoke: createEmptyCatalogEntry('fake_wall_smoke', 'IMPACT', 500),
    fake_wall_damage: createEmptyCatalogEntry('fake_wall_damage', 'IMPACT', 1000),
    scorch_mark_ground: createEmptyCatalogEntry('scorch_mark_ground', 'IMPACT', 1000),
    scorch_mark_faint: createEmptyCatalogEntry('scorch_mark_faint', 'IMPACT', 1000),
    muzzle_pistol: createEmptyCatalogEntry('muzzle_pistol', 'WEAPON_MUZZLE', 95),
    muzzle_uzi: createEmptyCatalogEntry('muzzle_uzi', 'WEAPON_MUZZLE', 80),
    muzzle_shotgun: createEmptyCatalogEntry('muzzle_shotgun', 'WEAPON_MUZZLE', 135),
    muzzle_rocket: createEmptyCatalogEntry('muzzle_rocket', 'WEAPON_MUZZLE', 145),
    muzzle_railgun: createEmptyCatalogEntry('muzzle_railgun', 'WEAPON_MUZZLE', 140),
    throw_grenade: createEmptyCatalogEntry('throw_grenade', 'WEAPON_MUZZLE', 110),
    place_object: createEmptyCatalogEntry('place_object', 'WEAPON_MUZZLE', 110),
};

// Preloaded HTMLImageElement cache keyed by SvgEffectId -> frame index
const effectFrameImages = new Map<SvgEffectId, (HTMLImageElement | null)[]>();
// Pre-baked Offscreen HTMLCanvasElement cache (GPU Option A) keyed by SvgEffectId -> frame index
// Eliminates per-frame SVG DOM / <filter> / <mask> / vector re-rasterization when ctx.drawImage is called under scaling
const effectFrameCanvases = new Map<SvgEffectId, (HTMLCanvasElement | null)[]>();
const effectFrameDataUrls = new Map<SvgEffectId, string[]>();
const frameImagePromiseByUrl = new Map<string, Promise<HTMLImageElement | null>>();

let catalogLoaded = false;
let catalogFetchPromise: Promise<void> | null = null;
let fullPreloadPromise: Promise<{ loaded: number; total: number }> | null = null;

function resolveFrameUrl(entry: SvgEffectCatalogEntry, frameSpec: SvgEffectFrameSpec): string {
    return assetUrl(frameSpec.url || (entry.basePath && frameSpec.file ? `${entry.basePath}/${frameSpec.file}` : ''));
}

function loadSingleSvgImage(url: string): Promise<HTMLImageElement | null> {
    if (!url || typeof window === 'undefined') return Promise.resolve(null);

    const existing = frameImagePromiseByUrl.get(url);
    if (existing) return existing;

    const promise = new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });

    frameImagePromiseByUrl.set(url, promise);
    return promise;
}

/**
 * Bakes a loaded SVG `HTMLImageElement` once onto an offscreen `HTMLCanvasElement`
 * at a supersampled resolution (`3x` for compact sprites <= 64px, `2x` for larger sprites).
 * Subsequent `ctx.drawImage(bakedCanvas, ...)` calls in the 60 FPS game loop perform a fast
 * hardware texture blit with zero SVG `<filter>` or path re-evaluation on the GPU.
 */
function bakeSvgFrameToOffscreenCanvas(img: HTMLImageElement, entry: SvgEffectCatalogEntry): HTMLCanvasElement | null {
    if (typeof document === 'undefined' || !img.complete || img.naturalWidth === 0) {
        return null;
    }
    const logicalW = entry.width || img.naturalWidth || 64;
    const logicalH = entry.height || img.naturalHeight || 64;
    const maxDim = Math.max(logicalW, logicalH);
    const bakeScale = maxDim <= 64 ? 3.0 : 2.0;

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(logicalW * bakeScale));
    canvas.height = Math.max(1, Math.ceil(logicalH * bakeScale));

    const bctx = canvas.getContext('2d');
    if (!bctx) return null;

    bctx.imageSmoothingEnabled = true;
    bctx.imageSmoothingQuality = 'high';
    bctx.drawImage(img, 0, 0, logicalW * bakeScale, logicalH * bakeScale);
    return canvas;
}

function getFrameDrawable(effectId: SvgEffectId, frameIdx: number): CanvasImageSource | null {
    const bakedList = effectFrameCanvases.get(effectId);
    const baked = bakedList?.[frameIdx];
    if (baked) return baked;

    const imgList = effectFrameImages.get(effectId);
    const img = imgList?.[frameIdx];
    if (img?.complete && img.naturalWidth > 0) {
        const entry = SVG_EFFECT_CATALOG[effectId];
        if (entry && bakedList) {
            const newlyBaked = bakeSvgFrameToOffscreenCanvas(img, entry);
            if (newlyBaked) {
                bakedList[frameIdx] = newlyBaked;
                return newlyBaked;
            }
        }
        return img;
    }
    return null;
}

async function preloadFramesForEntryAsync(entry: SvgEffectCatalogEntry, onFrameLoaded?: () => void): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!entry.frames || entry.frames.length === 0) return;

    const existingImgs = effectFrameImages.get(entry.id);
    const imgList: (HTMLImageElement | null)[] =
        existingImgs && existingImgs.length === entry.frames.length
            ? existingImgs
            : new Array(entry.frames.length).fill(null);
    const existingCanvases = effectFrameCanvases.get(entry.id);
    const canvasList: (HTMLCanvasElement | null)[] =
        existingCanvases && existingCanvases.length === entry.frames.length
            ? existingCanvases
            : new Array(entry.frames.length).fill(null);
    const urlList: string[] = new Array(entry.frames.length).fill('');

    effectFrameImages.set(entry.id, imgList);
    effectFrameCanvases.set(entry.id, canvasList);
    effectFrameDataUrls.set(entry.id, urlList);

    if (entry.id === 'explosion') {
        effectFrameImages.set('explosion_dome', imgList);
        effectFrameCanvases.set('explosion_dome', canvasList);
        effectFrameDataUrls.set('explosion_dome', urlList);
    }

    await Promise.all(
        entry.frames.map(async (frameSpec, idx) => {
            const resolvedUrl = resolveFrameUrl(entry, frameSpec);
            urlList[idx] = resolvedUrl;
            if (!resolvedUrl) {
                onFrameLoaded?.();
                return;
            }
            const currentImg = imgList[idx];
            if (currentImg?.complete && currentImg.naturalWidth > 0) {
                if (!canvasList[idx]) {
                    canvasList[idx] = bakeSvgFrameToOffscreenCanvas(currentImg, entry);
                }
                onFrameLoaded?.();
                return;
            }
            const loadedImg = await loadSingleSvgImage(resolvedUrl);
            imgList[idx] = loadedImg;
            if (loadedImg) {
                canvasList[idx] = bakeSvgFrameToOffscreenCanvas(loadedImg, entry);
            }
            onFrameLoaded?.();
        }),
    );
}

/**
 * Loads `/assets/effects/index.json` once and populates `SVG_EFFECT_CATALOG`.
 */
export function loadSvgEffectsCatalog(): Promise<void> {
    if (catalogLoaded) return Promise.resolve();
    if (catalogFetchPromise) return catalogFetchPromise;
    if (typeof window === 'undefined') return Promise.resolve();

    catalogFetchPromise = fetch(assetUrl('assets/effects/index.json'))
        .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json() as Promise<SvgEffectsCatalogJson>;
        })
        .then((json) => {
            if (!json?.effects) return;
            Object.entries(json.effects).forEach(([key, rawEntry]) => {
                const effectId = key as SvgEffectId;
                const frames = Array.isArray(rawEntry.frames) ? rawEntry.frames : [];
                const merged: SvgEffectCatalogEntry = {
                    ...rawEntry,
                    id: effectId,
                    frameCount: frames.length,
                    frames,
                };
                SVG_EFFECT_CATALOG[effectId] = merged;

                if (effectId === 'explosion') {
                    SVG_EFFECT_CATALOG.explosion_dome = {
                        ...merged,
                        id: 'explosion_dome',
                    };
                }
            });
            catalogLoaded = true;
        })
        .catch(() => {
            // Ignore fetch errors if offline
        })
        .finally(() => {
            catalogFetchPromise = null;
        });

    return catalogFetchPromise;
}

/**
 * Preloads the entire `assets/effects/index.json` catalog and awaits every single
 * SVG frame image (`HTMLImageElement` `onload`) across all effects, reporting
 * real-time progress `(loaded, total)` for the battle loading screen.
 */
export async function preloadAllSvgEffectsWithProgress(
    onProgress?: (loaded: number, total: number) => void,
): Promise<{ loaded: number; total: number }> {
    if (typeof window === 'undefined') {
        onProgress?.(0, 0);
        return { loaded: 0, total: 0 };
    }

    await loadSvgEffectsCatalog();

    // Collect all distinct effect entries (excluding alias `explosion_dome` which shares `explosion`)
    const entriesToPreload = (Object.values(SVG_EFFECT_CATALOG) as SvgEffectCatalogEntry[]).filter(
        (entry) => entry.id !== 'explosion_dome' && Array.isArray(entry.frames) && entry.frames.length > 0,
    );

    const totalFrames = entriesToPreload.reduce((sum, entry) => sum + entry.frames.length, 0);
    if (totalFrames === 0) {
        onProgress?.(0, 0);
        return { loaded: 0, total: 0 };
    }

    let loadedFrames = 0;
    onProgress?.(0, totalFrames);

    const runPreload = async () => {
        await Promise.all(
            entriesToPreload.map((entry) =>
                preloadFramesForEntryAsync(entry, () => {
                    loadedFrames += 1;
                    onProgress?.(loadedFrames, totalFrames);
                }),
            ),
        );
        return { loaded: loadedFrames, total: totalFrames };
    };

    if (!fullPreloadPromise) {
        fullPreloadPromise = runPreload().finally(() => {
            fullPreloadPromise = null;
        });
        return fullPreloadPromise;
    }

    return runPreload();
}

/**
 * Fire-and-forget convenience wrapper to ensure all SVG effect sprites are preloaded.
 */
export function preloadAllSvgEffects(): void {
    void preloadAllSvgEffectsWithProgress();
}

export function preloadExplosionSprites(): void {
    void preloadAllSvgEffectsWithProgress();
}

export function getWeaponMuzzleDurationMs(weaponId: WeaponId): number {
    switch (weaponId) {
        case 'pistol':
            return SVG_EFFECT_CATALOG.muzzle_pistol.defaultDurationMs;
        case 'uzi':
            return SVG_EFFECT_CATALOG.muzzle_uzi.defaultDurationMs;
        case 'shotgun':
            return SVG_EFFECT_CATALOG.muzzle_shotgun.defaultDurationMs;
        case 'rocket':
            return SVG_EFFECT_CATALOG.muzzle_rocket.defaultDurationMs;
        case 'railgun':
            return SVG_EFFECT_CATALOG.muzzle_railgun.defaultDurationMs;
        case 'grenade':
            return SVG_EFFECT_CATALOG.throw_grenade.defaultDurationMs;
        default:
            return SVG_EFFECT_CATALOG.place_object.defaultDurationMs;
    }
}

export function weaponIdToSvgEffectId(weaponId: WeaponId | string): SvgEffectId {
    switch (weaponId) {
        case 'pistol':
            return 'muzzle_pistol';
        case 'uzi':
            return 'muzzle_uzi';
        case 'shotgun':
            return 'muzzle_shotgun';
        case 'rocket':
            return 'muzzle_rocket';
        case 'railgun':
            return 'muzzle_railgun';
        case 'grenade':
            return 'throw_grenade';
        default:
            return 'place_object';
    }
}

export function getSvgEffectFrameDataUrl(effectId: SvgEffectId, frameIdx: number): string {
    preloadAllSvgEffects();
    const list = effectFrameDataUrls.get(effectId);
    if (!list || list.length === 0) return '';
    const safeIdx = clamp(frameIdx, 0, list.length - 1);
    return list[safeIdx];
}

/**
 * Computes the world barrel muzzle position for a player firing a specific firearm
 * directly from the weapon `.bbmodel` `muzzle_bone` 3D origin (`[X, Y, Z]`),
 * ensuring bullets, trajectories, and dynamic SVG muzzle flashes exit from the exact 3D barrel tip.
 */
export function getPlayerWeaponMuzzleWorldPos(
    playerX: number,
    playerY: number,
    angle: number,
    weaponId: WeaponId | string,
): { x: number; y: number; z: number; screenX: number; screenY: number } {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const charScale = 1.28;

    const wAsset = BBMODEL_CATALOG[weaponId as BBAssetId];
    const socketName = wAsset?.mountSocket || (weaponId === 'rocket' ? 'shoulder_mount_bone' : 'weapon_mount_bone');
    const socketOrigin =
        BBMODEL_CATALOG.bambo?.bones?.[socketName]?.origin ||
        (socketName === 'shoulder_mount_bone' ? [6.8, 18.8, 5.8] : [6.7, 15.2, 10.2]);
    const muzzleLocal = wAsset?.bones?.muzzle_bone?.origin || [0, 1.7, 8.6];

    const mx = socketOrigin[0] + muzzleLocal[0];
    const my = socketOrigin[1] + muzzleLocal[1];
    const mz = socketOrigin[2] + muzzleLocal[2];

    const wx = (mz * cos - mx * sin) * charScale;
    const wy = (mz * sin + mx * cos) * charScale;
    const wz = my * charScale;

    const worldX = playerX + wx;
    const worldY = playerY + wy * Y_PERSP;
    return {
        x: worldX,
        y: worldY,
        z: wz,
        screenX: worldX,
        screenY: worldY - wz * ISO_Z_SCALE,
    };
}

/**
 * Renders either:
 * - Ground hemisphere explosion (`DefineSprite_568_Effect.Explosion`, `isMidAir = false`)
 * - Airborne spherical explosion (`DefineSprite_573_Effect.Explosion_MidAir`, `isMidAir = true`)
 * driven by `/public/assets/effects/index.json`.
 */
export function drawBoxheadExplosionDome(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    maxRadius: number,
    progress: number,
    isMidAir = false,
    z = 0,
): void {
    preloadAllSvgEffects();

    const effectId: SvgEffectId = isMidAir ? 'explosion_midair' : 'explosion';
    const meta = SVG_EFFECT_CATALOG[effectId] || SVG_EFFECT_CATALOG.explosion;
    const frames = meta.frames;
    const clampedP = clamp(progress, 0, 0.9999);

    const frameIdx = frames.length > 0 ? Math.min(frames.length - 1, Math.floor(clampedP * frames.length)) : 0;
    const spec = frames[frameIdx];
    const stopOpacity = spec?.stopOpacity ?? Math.max(0, 1 - clampedP);
    if (stopOpacity <= 0.001) return;

    const baseRadius = meta.baseRadius ?? DEFAULT_BASE_EXPLOSION_RADIUS;
    const radiusScale = maxRadius / baseRadius;
    const drawable = getFrameDrawable(effectId, frameIdx);
    const screenY = y - z * ISO_Z_SCALE;

    ctx.save();
    ctx.translate(x, screenY);
    ctx.scale(radiusScale, radiusScale);

    if (drawable) {
        ctx.drawImage(drawable, -meta.originX, -meta.originY, meta.width, meta.height);
        ctx.restore();
        return;
    }

    // Vector fallback while JSON / SVG image is loading
    const scaleX = spec?.scaleX ?? 0.26 + clampedP * 0.86;
    const bottomScaleY = spec?.bottomScaleY ?? (isMidAir ? -scaleX : -scaleX * 0.5);
    const topScaleY = spec?.topScaleY ?? scaleX;

    const drawHalfDome = (sx: number, sy: number) => {
        ctx.save();
        ctx.transform(sx, 0, 0, sy, 0, 0);

        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius);
        grad.addColorStop(0, `rgba(255, 255, 255, ${stopOpacity})`);
        grad.addColorStop(0.7254901960784313, `rgba(255, 255, 255, ${stopOpacity})`);
        grad.addColorStop(0.8705882352941177, `rgba(255, 255, 0, ${stopOpacity})`);
        grad.addColorStop(1.0, 'rgba(255, 0, 0, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(67.85, -67.9);
        ctx.quadraticCurveTo(96.0, -39.75, 96.0, 0.0);
        ctx.lineTo(-96.0, 0.0);
        ctx.quadraticCurveTo(-96.0, -39.75, -67.9, -67.9);
        ctx.quadraticCurveTo(-39.75, -96.0, 0.0, -96.0);
        ctx.quadraticCurveTo(39.75, -96.0, 67.85, -67.9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    };

    drawHalfDome(scaleX, bottomScaleY);
    drawHalfDome(topScaleY, topScaleY);

    ctx.restore();
}

/**
 * Stamps the authentic Boxhead 2Play ScorchMark SVG onto the persistent floor canvas:
 * - `scorch_mark_ground` (`DefineSprite_613_Effect.ScorchMark`, 91.2x91.2, high-contrast 20%/35% soot starburst) for ground explosions (`!isMidAir`)
 * - `scorch_mark_faint` (`DefineSprite_614_Effect.ScorchMark`, 121.3x121.3, 1.331x wide 5.1%/9% faint soot halo) for mid-air explosions (`isMidAir`) AND as a soft outer soot ring on ground explosions
 */
export function drawScorchMarkSvgOnCanvas(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    isMidAir = false,
): void {
    preloadAllSvgEffects();

    const groundDrawable = getFrameDrawable('scorch_mark_ground', 0);
    const faintDrawable = getFrameDrawable('scorch_mark_faint', 0);
    const groundMeta = SVG_EFFECT_CATALOG.scorch_mark_ground;
    const faintMeta = SVG_EFFECT_CATALOG.scorch_mark_faint;

    const rotAngle = Math.random() * Math.PI * 2;

    if (isMidAir) {
        if (faintDrawable) {
            const scale = (radius * 0.92) / (faintMeta.baseRadius || 60.65);
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, Y_PERSP);
            ctx.rotate(rotAngle);
            ctx.scale(scale, scale);
            ctx.drawImage(faintDrawable, -faintMeta.originX, -faintMeta.originY, faintMeta.width, faintMeta.height);
            ctx.restore();
            return;
        }
    } else {
        let drewAny = false;
        // 1. Stamp wide faint outer soot halo (DefineSprite_614)
        if (faintDrawable) {
            const faintScale = (radius * 0.85) / (faintMeta.baseRadius || 60.65);
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, Y_PERSP);
            ctx.rotate(rotAngle);
            ctx.scale(faintScale, faintScale);
            ctx.drawImage(faintDrawable, -faintMeta.originX, -faintMeta.originY, faintMeta.width, faintMeta.height);
            ctx.restore();
            drewAny = true;
        }
        // 2. Stamp dark crisp core scorch starburst (DefineSprite_613)
        if (groundDrawable) {
            const groundScale = (radius * 0.76) / (groundMeta.baseRadius || 45.6);
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(1, Y_PERSP);
            ctx.rotate(rotAngle);
            ctx.scale(groundScale, groundScale);
            ctx.drawImage(
                groundDrawable,
                -groundMeta.originX,
                -groundMeta.originY,
                groundMeta.width,
                groundMeta.height,
            );
            ctx.restore();
            drewAny = true;
        }
        if (drewAny) return;
    }

    // Fallback radial gradient if SVG images haven't finished loading yet
    ctx.save();
    const r = radius * 0.55;
    const grad = ctx.createRadialGradient(x, y, 2, x, y, r);
    grad.addColorStop(0, isMidAir ? 'rgba(24, 24, 27, 0.28)' : 'rgba(24, 24, 27, 0.68)');
    grad.addColorStop(0.55, isMidAir ? 'rgba(41, 37, 36, 0.14)' : 'rgba(41, 37, 36, 0.38)');
    grad.addColorStop(1, 'rgba(41, 37, 36, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/**
 * Renders a frame from the 6-frame `DefineSprite_580_Effect.RocketSmoke` (`rocket_smoke_1..6.svg`)
 * for rocket exhaust trails, rocket launcher backblast, and bullet wall-impact smoke clouds.
 */
export function drawRocketSmokeFrameOnCanvas(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    targetRadius = 18,
    extraAlpha = 1.0,
): boolean {
    preloadAllSvgEffects();

    const meta = SVG_EFFECT_CATALOG.rocket_smoke;
    const cachedFrames = effectFrameImages.get('rocket_smoke');
    if (!meta || !cachedFrames || cachedFrames.length === 0) return false;

    const clampedP = clamp(progress, 0, 0.9999);
    const frameIdx = Math.min(cachedFrames.length - 1, Math.floor(clampedP * cachedFrames.length));
    const drawable = getFrameDrawable('rocket_smoke', frameIdx);
    if (!drawable) {
        return false;
    }

    const baseR = meta.baseRadius || 48.0;
    const scale = targetRadius / baseR;
    // In DefineSprite_580_Effect.RocketSmoke frames 2..6, the 4 morph circles drift toward (+2, +7) in local SVG space;
    // subtracting that local drift keeps the smoke puff visually centered on the exact bullet trail tip (x, y).
    const localDriftX = clampedP * 2.0;
    const localDriftY = clampedP * 7.5;

    ctx.save();
    if (extraAlpha < 0.999) {
        ctx.globalAlpha *= clamp(extraAlpha, 0, 1);
    }
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.drawImage(drawable, -meta.originX - localDriftX, -meta.originY - localDriftY, meta.width, meta.height);
    ctx.restore();
    return true;
}

/**
 * Renders a frame from the 15-frame `DefineSprite_626` Fake Wall collapse dust/smoke cloud
 * (`fake_wall_smoke_1..15.svg`, 128x128, origin at `(64.0, 100.25)`) when a Fake Wall (`wall`) is destroyed.
 */
export function drawFakeWallSmokeFrameOnCanvas(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    scale = 0.8,
): boolean {
    preloadAllSvgEffects();

    const meta = SVG_EFFECT_CATALOG.fake_wall_smoke;
    const cachedFrames = effectFrameImages.get('fake_wall_smoke');
    if (!meta || !cachedFrames || cachedFrames.length === 0) return false;

    const clampedP = clamp(progress, 0, 0.9999);
    const frameIdx = Math.min(cachedFrames.length - 1, Math.floor(clampedP * cachedFrames.length));
    const drawable = getFrameDrawable('fake_wall_smoke', frameIdx);
    if (!drawable) {
        return false;
    }

    ctx.save();
    ctx.translate(x, y);
    if (scale !== 1.0) {
        ctx.scale(scale, scale);
    }
    ctx.drawImage(drawable, -meta.originX, -meta.originY, meta.width, meta.height);
    ctx.restore();
    return true;
}

/**
 * Renders the authentic Boxhead 2Play Fake Wall damage overlay (`DefineSprite_660_Object.Wall-2..10`,
 * slimmed down to transparent hole + crack + bevel overlays in `/assets/effects/fake_wall/fake_wall_2..10.svg`)
 * on top of the soft 3D octagonal column base (`drawFakeWallOctagon3D`).
 * Maps `damageRatio` (`< 0.995` -> Frames 2..10 progressively).
 */
export function drawFakeWallDamageSvgOnCanvas(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scaleMultiplier = 1.0,
    damageRatio = 1.0,
): boolean {
    preloadAllSvgEffects();

    const meta = SVG_EFFECT_CATALOG.fake_wall_damage;
    const cachedFrames = effectFrameImages.get('fake_wall_damage');
    if (!meta || !cachedFrames || cachedFrames.length === 0) return false;

    const hpRatio = clamp(damageRatio, 0, 1);
    // Frame 0 (fake_wall_1.svg) is 100% intact; once damaged (hpRatio < 0.995), step through frames 1..9 (fake_wall_2..10.svg)
    const frameIdx =
        hpRatio >= 0.995
            ? 0
            : Math.min(cachedFrames.length - 1, 1 + Math.floor((1 - hpRatio) * (cachedFrames.length - 1)));

    const drawable = getFrameDrawable('fake_wall_damage', frameIdx) || getFrameDrawable('fake_wall_damage', 0);
    if (!drawable) {
        return false;
    }

    // Align the 28.8x44.25 SVG octagon column to drawFakeWallOctagon3D's 31.04x48.02 octagon column
    const scaleX = scaleMultiplier * 1.078;
    const scaleY = scaleMultiplier * 1.085;

    ctx.save();
    ctx.translate(cx, cy + 2.4 * scaleMultiplier);
    ctx.scale(scaleX, scaleY);
    ctx.drawImage(drawable, -meta.originX, -meta.originY, meta.width, meta.height);
    ctx.restore();
    return true;
}

/**
 * Checks whether the pre-baked Fake Wall damage overlay frame for a given `damageRatio` is ready.
 */
export function isFakeWallDamageFrameReady(damageRatio: number): boolean {
    const hpRatio = clamp(damageRatio, 0, 1);
    if (hpRatio >= 0.995) return true;
    preloadAllSvgEffects();
    const cachedFrames = effectFrameImages.get('fake_wall_damage');
    if (!cachedFrames || cachedFrames.length < 2) return false;
    const frameIdx = Math.min(cachedFrames.length - 1, 1 + Math.floor((1 - hpRatio) * (cachedFrames.length - 1)));
    return Boolean(getFrameDrawable('fake_wall_damage', frameIdx));
}

/**
 * Unified Animated Weapon Muzzle / Action SVG Effect Renderer
 * Uses authentic Boxhead 2Play Rooms extracted SVG assets:
 * - `muzzle_flash_composite.svg` (`DefineSprite_678_Pistol.MuzzleFlash`)
 * - `muzzle_flash_star.svg` (`DefineSprite_675` / `679` / `682` 8-pointed yellow starburst)
 * - `muzzle_flash_cone.svg` (`DefineSprite_677` / `680` / `683` forward yellow flame cone)
 * - `rocket_smoke_1..6.svg` (`DefineSprite_580_Effect.RocketSmoke` 6-frame smoke cloud)
 */
export function drawAnimatedWeaponMuzzleSVG(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    weaponId: WeaponId,
    progress: number,
): void {
    preloadAllSvgEffects();

    const p = clamp(progress, 0, 0.9999);
    const fadeOut = clamp(1 - Math.max(0, (p - 0.35) / 0.65), 0, 1);
    const expand = 0.55 + Math.sin(Math.min(1, p * 1.6) * (Math.PI / 2)) * 0.65;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const perpX = -sin;
    const perpY = cos;

    const isPlaceable =
        weaponId === 'barrel' || weaponId === 'wall' || weaponId === 'mine' || weaponId === 'charge_pack';
    const isThrown = weaponId === 'grenade';

    ctx.save();

    if (isPlaceable) {
        ctx.globalAlpha = fadeOut;
        ctx.strokeStyle =
            weaponId === 'charge_pack'
                ? 'rgba(34, 197, 94, 0.85)'
                : weaponId === 'mine'
                  ? 'rgba(239, 68, 68, 0.85)'
                  : 'rgba(248, 250, 252, 0.85)';
        ctx.lineWidth = 2.4 * (1 - p * 0.4);
        ctx.beginPath();
        ctx.ellipse(x, y, 12 + p * 8, 7.5 + p * 5, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
    }

    if (isThrown) {
        const handX = x + perpX * 8 + cos * 18;
        const handY = y + (perpY * 8 + sin * 18) * Y_PERSP - 20 * ISO_Z_SCALE;
        ctx.globalAlpha = fadeOut;
        ctx.strokeStyle = 'rgba(163, 230, 53, 0.9)';
        ctx.lineWidth = 2.6 * (1 - p * 0.35);
        ctx.beginPath();
        const startAng = angle - 0.95 + p * 0.45;
        const endAng = angle - 0.2 + p * 0.95;
        ctx.arc(handX, handY, 9 + p * 4, startAng, endAng);
        ctx.stroke();
        ctx.restore();
        return;
    }

    const muzzlePos = getPlayerWeaponMuzzleWorldPos(x, y, angle, weaponId);
    const flashX = muzzlePos.screenX;
    const flashY = muzzlePos.screenY;

    // Retrieve pre-baked authentic Boxhead MuzzleFlash drawables (composite=0, star=1, cone=2)
    const compositeImg = getFrameDrawable('muzzle_pistol', 0);
    const starImg = getFrameDrawable('muzzle_pistol', 1);
    const coneImg = getFrameDrawable('muzzle_pistol', 2);
    const hasMuzzleSvgs = Boolean(compositeImg);

    if (weaponId === 'pistol') {
        if (hasMuzzleSvgs && compositeImg) {
            const s = 0.36 * expand;
            ctx.globalAlpha = fadeOut;
            ctx.translate(flashX, flashY);
            ctx.rotate(angle);
            ctx.scale(s, s);
            ctx.drawImage(compositeImg, -30.0, -29.85, 75.9, 59.95);
            ctx.restore();
            return;
        }

        const rOuter = 11.5 * expand;
        const grad = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, rOuter);
        grad.addColorStop(0, `rgba(255, 255, 255, ${fadeOut})`);
        grad.addColorStop(0.55, `rgba(254, 240, 138, ${fadeOut * 0.95})`);
        grad.addColorStop(0.82, `rgba(249, 115, 22, ${fadeOut * 0.75})`);
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(flashX, flashY, rOuter, 0, Math.PI * 2);
        ctx.fill();
    } else if (weaponId === 'uzi') {
        if (hasMuzzleSvgs && compositeImg) {
            const spikeScale = 0.42 * expand * (0.92 + Math.sin(p * Math.PI) * 0.22);
            ctx.globalAlpha = fadeOut;
            ctx.translate(flashX, flashY);
            ctx.rotate(angle);
            ctx.scale(spikeScale, spikeScale);
            ctx.drawImage(compositeImg, -30.0, -29.85, 75.9, 59.95);
            if (starImg) {
                ctx.rotate(p * 0.45);
                ctx.scale(0.85, 0.85);
                ctx.drawImage(starImg, -24.0, -23.95, 48.0, 48.0);
            }
            ctx.restore();
            return;
        }

        ctx.translate(flashX, flashY);
        ctx.rotate(angle);

        const spikeScale = expand * (0.9 + Math.sin(p * Math.PI) * 0.25);
        const grad = ctx.createRadialGradient(2, 0, 0, 2, 0, 15 * spikeScale);
        grad.addColorStop(0, `rgba(255, 255, 255, ${fadeOut})`);
        grad.addColorStop(0.6, `rgba(254, 240, 138, ${fadeOut})`);
        grad.addColorStop(0.88, `rgba(249, 115, 22, ${fadeOut * 0.85})`);
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(15 * spikeScale, 0);
        ctx.lineTo(3.5 * spikeScale, 3.4 * spikeScale);
        ctx.lineTo(0, 10.2 * spikeScale);
        ctx.lineTo(-3.2 * spikeScale, 3.2 * spikeScale);
        ctx.lineTo(-7.5 * spikeScale, 0);
        ctx.lineTo(-3.2 * spikeScale, -3.2 * spikeScale);
        ctx.lineTo(0, -10.2 * spikeScale);
        ctx.lineTo(3.5 * spikeScale, -3.4 * spikeScale);
        ctx.closePath();
        ctx.fill();
    } else if (weaponId === 'shotgun') {
        const smokeDrift = 12 + p * 14;
        drawRocketSmokeFrameOnCanvas(
            ctx,
            flashX + cos * smokeDrift,
            flashY + sin * smokeDrift * 0.8 - 2,
            p,
            14 + p * 10,
            0.85,
        );

        if (hasMuzzleSvgs && compositeImg) {
            const s = 0.56 * expand;
            ctx.globalAlpha = fadeOut;
            ctx.translate(flashX, flashY);
            ctx.rotate(angle);
            if (coneImg) {
                ctx.save();
                ctx.rotate(-0.22);
                ctx.scale(s * 1.15, s * 1.05);
                ctx.drawImage(coneImg, 0, -10.8, 36.75, 21.6);
                ctx.restore();

                ctx.save();
                ctx.rotate(0.22);
                ctx.scale(s * 1.15, s * 1.05);
                ctx.drawImage(coneImg, 0, -10.8, 36.75, 21.6);
                ctx.restore();
            }
            ctx.scale(s, s * 1.18);
            ctx.drawImage(compositeImg, -30.0, -29.85, 75.9, 59.95);
            ctx.restore();
            return;
        }

        const coneLen = 28 * expand;
        const grad = ctx.createRadialGradient(flashX, flashY, 0, flashX, flashY, coneLen);
        grad.addColorStop(0, `rgba(255, 255, 255, ${fadeOut})`);
        grad.addColorStop(0.5, `rgba(253, 224, 71, ${fadeOut * 0.92})`);
        grad.addColorStop(0.82, `rgba(249, 115, 22, ${fadeOut * 0.68})`);
        grad.addColorStop(1, 'rgba(220, 38, 38, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(flashX, flashY);
        ctx.arc(flashX, flashY, coneLen, angle - 0.54, angle + 0.54);
        ctx.closePath();
        ctx.fill();
    } else if (weaponId === 'rocket') {
        const muzzleX = flashX;
        const muzzleY = flashY;
        const backX = x + perpX * 8.7 - cos * (18 + p * 8);
        const backY = y + (perpY * 8.7 - sin * (18 + p * 8)) * Y_PERSP - muzzlePos.z * ISO_Z_SCALE;

        // Authentic DefineSprite_580 RocketSmoke backblast cloud behind shoulder launcher
        const drewSmoke = drawRocketSmokeFrameOnCanvas(ctx, backX - cos * 8, backY - sin * 5, p, 22 + p * 14, 1.0);
        if (!drewSmoke) {
            const smokeR = 10 + p * 7;
            ctx.fillStyle = `rgba(168, 162, 158, ${(1 - p) * 0.78})`;
            ctx.beginPath();
            ctx.arc(backX - cos * 8, backY - sin * 5, smokeR, 0, Math.PI * 2);
            ctx.fill();
        }

        if (hasMuzzleSvgs && compositeImg && starImg) {
            ctx.save();
            ctx.globalAlpha = fadeOut;
            ctx.translate(muzzleX, muzzleY);
            ctx.rotate(angle);
            const frontS = 0.48 * expand;
            ctx.scale(frontS, frontS);
            ctx.drawImage(compositeImg, -30.0, -29.85, 75.9, 59.95);
            ctx.restore();

            ctx.save();
            ctx.globalAlpha = fadeOut * 0.92;
            ctx.translate(backX, backY);
            ctx.rotate(angle + Math.PI);
            const backS = 0.36 * expand;
            ctx.scale(backS, backS);
            ctx.drawImage(starImg, -24.0, -23.95, 48.0, 48.0);
            ctx.restore();

            ctx.restore();
            return;
        }

        const rFront = 14 * expand;
        const frontGrad = ctx.createRadialGradient(muzzleX, muzzleY, 0, muzzleX, muzzleY, rFront);
        frontGrad.addColorStop(0, `rgba(255, 255, 255, ${fadeOut})`);
        frontGrad.addColorStop(0.65, `rgba(253, 224, 71, ${fadeOut * 0.95})`);
        frontGrad.addColorStop(0.88, `rgba(249, 115, 22, ${fadeOut * 0.8})`);
        frontGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');

        ctx.fillStyle = frontGrad;
        ctx.beginPath();
        ctx.arc(muzzleX, muzzleY, rFront, 0, Math.PI * 2);
        ctx.fill();
    } else if (weaponId === 'railgun') {
        ctx.globalAlpha = fadeOut;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3.0 * (1 - p * 0.45);
        ctx.beginPath();
        ctx.arc(flashX, flashY, 10 + p * 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.0 * (1 - p * 0.45);
        ctx.beginPath();
        ctx.arc(flashX, flashY, 6 + p * 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(flashX, flashY, 5.5 * (1 - p * 0.5), 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

/**
 * Renders any unified SVG effect frame (`explosion`, `explosion_midair`, or `muzzle_*`)
 * onto a 2D Canvas at coordinates `(x, y)` with normalized `progress` in `[0, 1)`.
 */
export function drawSvgEffectFrameOnCanvas(
    ctx: CanvasRenderingContext2D,
    effectId: SvgEffectId,
    x: number,
    y: number,
    progress: number,
    options?: {
        angle?: number;
        scale?: number;
        radius?: number;
    },
): void {
    preloadAllSvgEffects();

    if (effectId === 'explosion' || effectId === 'explosion_dome' || effectId === 'explosion_midair') {
        const isMidAir = effectId === 'explosion_midair';
        const baseRadius = SVG_EFFECT_CATALOG.explosion.baseRadius ?? DEFAULT_BASE_EXPLOSION_RADIUS;
        const maxRadius = options?.radius ?? (options?.scale ?? 1) * baseRadius;
        drawBoxheadExplosionDome(ctx, x, y, maxRadius, progress, isMidAir, 0);
        return;
    }

    const meta = SVG_EFFECT_CATALOG[effectId];
    if (!meta) return;

    const cachedFrames = effectFrameImages.get(effectId);
    const angle = options?.angle ?? 0;
    const scale = options?.scale ?? 1.0;

    if (cachedFrames && cachedFrames.length > 0) {
        const clampedP = clamp(progress, 0, 0.9999);
        const frameIdx = Math.min(cachedFrames.length - 1, Math.floor(clampedP * cachedFrames.length));
        const drawable = getFrameDrawable(effectId, frameIdx);
        if (drawable) {
            ctx.save();
            ctx.translate(x, y);
            if (meta.rotatable && angle !== 0) {
                ctx.rotate(angle);
            }
            if (scale !== 1.0) {
                ctx.scale(scale, scale);
            }
            ctx.drawImage(drawable, -meta.originX, -meta.originY, meta.width, meta.height);
            ctx.restore();
            return;
        }
    }
}

/**
 * Renders all active standalone SVG effect instances in the 2.5D world viewport.
 */
export function renderActiveSvgEffectsOnCanvas(
    ctx: CanvasRenderingContext2D,
    effects: ActiveSvgEffect[],
    now: number,
    filterCategory?: 'EXPLOSION' | 'WEAPON_MUZZLE' | 'IMPACT',
): void {
    for (let i = 0; i < effects.length; i++) {
        const ef = effects[i];
        const meta = SVG_EFFECT_CATALOG[ef.effectId];
        if (!meta) continue;
        if (filterCategory && meta.category !== filterCategory) continue;

        const progress = (now - ef.createdAt) / ef.durationMs;
        if (progress < 0 || progress >= 1) continue;

        const drawY = ef.y - (ef.z ?? 0) * ISO_Z_SCALE;
        drawSvgEffectFrameOnCanvas(ctx, ef.effectId, ef.x, drawY, progress, {
            angle: ef.angle,
            scale: ef.scale,
            radius: ef.radius,
        });
    }
}
