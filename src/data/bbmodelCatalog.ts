/**
 * On-Demand Blockbench (.bbmodel v4.5) Skeletal Asset Catalog & Loader
 * All 3D cube geometry (`elements`), hierarchical bone outliners (`outliner`),
 * and keyframe animations (`animations`) are stored as standalone JSON `.bbmodel` files
 * under `/public/assets/bbmodels/{characters,monsters,weapons,equipment}/*.bbmodel`.
 *
 * Only the selected character(s) and required match assets are loaded into memory on demand.
 */

import { assetUrl } from '@/utils/assetUrl';

export type BBAssetId =
    | 'bambo'
    | 'bind'
    | 'bert'
    | 'sakamoto'
    | 'zombie'
    | 'fast_zombie'
    | 'devil'
    | 'pistol'
    | 'uzi'
    | 'shotgun'
    | 'barrel'
    | 'grenade'
    | 'wall'
    | 'mine'
    | 'rocket'
    | 'charge_pack'
    | 'railgun'
    | 'red_box';

export type BBBoneName =
    | 'root'
    | 'body_bone'
    | 'head_bone'
    | 'left_arm_bone'
    | 'left_forearm_bone'
    | 'right_arm_bone'
    | 'right_forearm_bone'
    | 'weapon_mount_bone'
    | 'shoulder_mount_bone'
    | 'weapon_slide_bone'
    | 'weapon_pump_bone'
    | 'weapon_warhead_bone'
    | 'weapon_breech_bone'
    | 'weapon_coil_bone'
    | 'muzzle_bone'
    | 'left_leg_bone'
    | 'left_knee_bone'
    | 'right_leg_bone'
    | 'right_knee_bone';

export interface BBCubeNode {
    uuid: string;
    name: string;
    from: [number, number, number]; // [X: side, Y: up, Z: forward]
    to: [number, number, number];
    origin: [number, number, number];
    rotation: [number, number, number]; // degrees [pitchX, yawY, rollZ]
    hexColor: string;
    bonePath: BBBoneName[]; // ordered from root down to immediate parent bone
}

export interface BBBoneNode {
    uuid: string;
    name: BBBoneName;
    origin: [number, number, number]; // Joint pivot in Blockbench space [X, Y, Z]
    rotation: [number, number, number];
    children: Array<BBBoneNode | string>; // child bone nodes or cube UUIDs
}

export interface BBKeyframe {
    time: number;
    value: [number, number, number]; // rotation in radians [pitchX, yawY, rollZ] or position in units [tx, ty, tz]
    interpolation: 'linear' | 'catmullrom' | 'smooth' | 'step';
}

export interface BBBoneTrack {
    boneName: BBBoneName;
    rotation: BBKeyframe[];
    position: BBKeyframe[];
}

export interface BBAnimationClip {
    uuid: string;
    name: string;
    loop: 'once' | 'hold' | 'loop';
    length: number;
    tracks: Partial<Record<BBBoneName, BBBoneTrack>>;
}

export interface CompiledBBModel {
    id: BBAssetId;
    category: 'CHARACTER' | 'MONSTER' | 'WEAPON' | 'EQUIPMENT';
    filePath: string;
    scale: number;
    mountSocket?: BBBoneName;
    isLoaded?: boolean;
    bones: Record<BBBoneName, { uuid: string; origin: [number, number, number] }>;
    cubes: BBCubeNode[];
    animations: Record<string, BBAnimationClip>;
    rawBBModelJSON: Record<string, unknown>;
}

const DEG_TO_RAD = Math.PI / 180;

function sampleKeyframeChannel(keyframes: BBKeyframe[], time: number): [number, number, number] {
    if (!keyframes || keyframes.length === 0) return [0, 0, 0];
    if (keyframes.length === 1 || time <= keyframes[0].time) {
        return keyframes[0].value;
    }
    const last = keyframes[keyframes.length - 1];
    if (time >= last.time) {
        return last.value;
    }
    for (let i = 0; i < keyframes.length - 1; i++) {
        const k0 = keyframes[i];
        const k1 = keyframes[i + 1];
        if (time >= k0.time && time <= k1.time) {
            if (k0.interpolation === 'step') {
                return k0.value;
            }
            const span = Math.max(1e-6, k1.time - k0.time);
            let t = (time - k0.time) / span;
            if (k0.interpolation === 'smooth' || k0.interpolation === 'catmullrom') {
                t = t * t * (3 - 2 * t);
            }
            return [
                k0.value[0] + (k1.value[0] - k0.value[0]) * t,
                k0.value[1] + (k1.value[1] - k0.value[1]) * t,
                k0.value[2] + (k1.value[2] - k0.value[2]) * t,
            ];
        }
    }
    return last.value;
}

/**
 * Evaluates a parsed `.bbmodel` animation clip at normalized progress `0..1`
 * and returns the per-bone rotation (radians) and translation offsets.
 */
export function sampleBBAnimationClip(
    clip: BBAnimationClip | undefined,
    normalizedProgress: number,
): Partial<
    Record<
        BBBoneName,
        {
            pitchX: number;
            yawY: number;
            rollZ: number;
            tx: number;
            ty: number;
            tz: number;
        }
    >
> {
    if (!clip) return {};
    const clamped = Math.max(0, Math.min(1, normalizedProgress));
    const evalTime = clamped * (clip.length > 0 ? clip.length : 1.0);
    const result: Partial<
        Record<
            BBBoneName,
            {
                pitchX: number;
                yawY: number;
                rollZ: number;
                tx: number;
                ty: number;
                tz: number;
            }
        >
    > = {};

    for (const [bKey, track] of Object.entries(clip.tracks)) {
        if (!track) continue;
        const boneName = bKey as BBBoneName;
        const rot = sampleKeyframeChannel(track.rotation, evalTime);
        const pos = sampleKeyframeChannel(track.position, evalTime);
        result[boneName] = {
            pitchX: rot[0],
            yawY: rot[1],
            rollZ: rot[2],
            tx: pos[0],
            ty: pos[1],
            tz: pos[2],
        };
    }
    return result;
}

/**
 * Local `[0, 0, 0]`-centered weapon muzzle origins (relative to each weapon's `weapon_mount_bone` at `[0, 0, 0]`).
 */
const DEFAULT_WEAPON_MUZZLE_ORIGINS: Partial<Record<BBAssetId, [number, number, number]>> = {
    pistol: [0, 1.7, 8.6],
    uzi: [0, 2.0, 11.4],
    shotgun: [0, 1.7, 13.0],
    rocket: [0, 2.3, 21.2],
    railgun: [0, 1.7, 15.4],
    grenade: [0, 0.6, 2.3],
};

function createDefaultBones(id: BBAssetId): Record<BBBoneName, { uuid: string; origin: [number, number, number] }> {
    const isDevil = id === 'devil';
    const isWeapon =
        id === 'pistol' || id === 'uzi' || id === 'shotgun' || id === 'rocket' || id === 'railgun' || id === 'grenade';
    const muzzleOrigin = DEFAULT_WEAPON_MUZZLE_ORIGINS[id] || [0, 1.7, 8.6];
    if (isDevil) {
        return {
            root: { uuid: 'root', origin: [0, 0, 0] },
            body_bone: { uuid: 'body_bone', origin: [0, 12.0, 0] },
            head_bone: { uuid: 'head_bone', origin: [0, 28.0, 0] },
            left_arm_bone: { uuid: 'left_arm_bone', origin: [-11.5, 25.5, 0] },
            left_forearm_bone: { uuid: 'left_forearm_bone', origin: [-13.5, 19.0, 4.5] },
            right_arm_bone: { uuid: 'right_arm_bone', origin: [11.5, 25.5, 0] },
            right_forearm_bone: { uuid: 'right_forearm_bone', origin: [13.5, 19.0, 4.5] },
            weapon_mount_bone: { uuid: 'weapon_mount_bone', origin: [13.5, 16.0, 10.0] },
            shoulder_mount_bone: { uuid: 'shoulder_mount_bone', origin: [13.5, 22.0, 5.8] },
            weapon_slide_bone: { uuid: 'weapon_slide_bone', origin: [0, 1.7, 3.7] },
            weapon_pump_bone: { uuid: 'weapon_pump_bone', origin: [0, -0.5, 6.55] },
            weapon_warhead_bone: { uuid: 'weapon_warhead_bone', origin: [0, 2.3, 18.8] },
            weapon_breech_bone: { uuid: 'weapon_breech_bone', origin: [0, 2.3, -17.6] },
            weapon_coil_bone: { uuid: 'weapon_coil_bone', origin: [0, 2.2, 11.3] },
            muzzle_bone: { uuid: 'muzzle_bone', origin: [13.5, 18.0, 18.0] },
            left_leg_bone: { uuid: 'left_leg_bone', origin: [-4.6, 12.0, 0] },
            left_knee_bone: { uuid: 'left_knee_bone', origin: [-4.6, 5.5, 0] },
            right_leg_bone: { uuid: 'right_leg_bone', origin: [4.6, 12.0, 0] },
            right_knee_bone: { uuid: 'right_knee_bone', origin: [4.6, 5.5, 0] },
        };
    }
    return {
        root: { uuid: 'root', origin: [0, 0, 0] },
        body_bone: { uuid: 'body_bone', origin: [0, 9.0, 0] },
        head_bone: { uuid: 'head_bone', origin: [0, 20.0, 0] },
        left_arm_bone: { uuid: 'left_arm_bone', origin: [-6.8, 18.2, 0] },
        left_forearm_bone: { uuid: 'left_forearm_bone', origin: [-6.8, 15.8, 4.2] },
        right_arm_bone: { uuid: 'right_arm_bone', origin: [6.8, 18.2, 0] },
        right_forearm_bone: { uuid: 'right_forearm_bone', origin: [6.8, 15.8, 4.2] },
        weapon_mount_bone: {
            uuid: 'weapon_mount_bone',
            origin: isWeapon ? [0, 0, 0] : [6.7, 15.2, 10.2],
        },
        shoulder_mount_bone: {
            uuid: 'shoulder_mount_bone',
            origin: [6.8, 18.8, 5.8],
        },
        weapon_slide_bone: { uuid: 'weapon_slide_bone', origin: [0, 1.7, 3.7] },
        weapon_pump_bone: { uuid: 'weapon_pump_bone', origin: [0, -0.5, 6.55] },
        weapon_warhead_bone: { uuid: 'weapon_warhead_bone', origin: [0, 2.3, 18.8] },
        weapon_breech_bone: { uuid: 'weapon_breech_bone', origin: [0, 2.3, -17.6] },
        weapon_coil_bone: { uuid: 'weapon_coil_bone', origin: [0, 2.2, 11.3] },
        muzzle_bone: { uuid: 'muzzle_bone', origin: muzzleOrigin },
        left_leg_bone: { uuid: 'left_leg_bone', origin: [-2.6, 9.0, 0] },
        left_knee_bone: { uuid: 'left_knee_bone', origin: [-2.6, 4.2, 0] },
        right_leg_bone: { uuid: 'right_leg_bone', origin: [2.6, 9.0, 0] },
        right_knee_bone: { uuid: 'right_knee_bone', origin: [2.6, 4.2, 0] },
    };
}

function createManifestEntry(
    id: BBAssetId,
    category: 'CHARACTER' | 'MONSTER' | 'WEAPON' | 'EQUIPMENT',
    folder: 'characters' | 'monsters' | 'weapons' | 'equipment',
    scale: number,
): CompiledBBModel {
    return {
        id,
        category,
        filePath: `assets/bbmodels/${folder}/${id}.bbmodel`,
        scale,
        mountSocket:
            category === 'WEAPON' ? (id === 'rocket' ? 'shoulder_mount_bone' : 'weapon_mount_bone') : undefined,
        isLoaded: false,
        bones: createDefaultBones(id),
        cubes: [],
        animations: {},
        rawBBModelJSON: {},
    };
}

export const BBMODEL_CATALOG: Record<BBAssetId, CompiledBBModel> = {
    bambo: createManifestEntry('bambo', 'CHARACTER', 'characters', 1.28),
    bind: createManifestEntry('bind', 'CHARACTER', 'characters', 1.28),
    bert: createManifestEntry('bert', 'CHARACTER', 'characters', 1.28),
    sakamoto: createManifestEntry('sakamoto', 'CHARACTER', 'characters', 1.28),
    zombie: createManifestEntry('zombie', 'MONSTER', 'monsters', 1.28),
    fast_zombie: createManifestEntry('fast_zombie', 'MONSTER', 'monsters', 1.28),
    devil: createManifestEntry('devil', 'MONSTER', 'monsters', 1.56),
    pistol: createManifestEntry('pistol', 'WEAPON', 'weapons', 1.0),
    uzi: createManifestEntry('uzi', 'WEAPON', 'weapons', 1.0),
    shotgun: createManifestEntry('shotgun', 'WEAPON', 'weapons', 1.0),
    barrel: createManifestEntry('barrel', 'EQUIPMENT', 'equipment', 1.38),
    grenade: createManifestEntry('grenade', 'WEAPON', 'weapons', 1.35),
    wall: createManifestEntry('wall', 'EQUIPMENT', 'equipment', 1.5),
    mine: createManifestEntry('mine', 'EQUIPMENT', 'equipment', 1.35),
    rocket: createManifestEntry('rocket', 'WEAPON', 'weapons', 1.0),
    charge_pack: createManifestEntry('charge_pack', 'EQUIPMENT', 'equipment', 1.4),
    railgun: createManifestEntry('railgun', 'WEAPON', 'weapons', 1.0),
    red_box: createManifestEntry('red_box', 'EQUIPMENT', 'equipment', 1.24),
};

export const ALL_BBMODEL_IDS: BBAssetId[] = Object.keys(BBMODEL_CATALOG) as BBAssetId[];

export const BBMODEL_LIST: CompiledBBModel[] = Object.values(BBMODEL_CATALOG);

const bbModelListeners = new Set<() => void>();
const bbModelLoadPromises = new Map<BBAssetId, Promise<CompiledBBModel>>();

function notifyBBModelListeners() {
    for (const fn of bbModelListeners) fn();
}

export function subscribeBBModels(fn: () => void): () => void {
    bbModelListeners.add(fn);
    return () => bbModelListeners.delete(fn);
}

const PALETTE_SWATCHES = [
    '#e2b281', // 0: Warm Tan Skin
    '#18181b', // 1: Matte Black (Hair / Pants / Pistol / Boots / Horns)
    '#dc2626', // 2: Crimson Red (Bandana / Barrel Stripe / Laser)
    '#52525b', // 3: Gunmetal Grey (Boots / UZI / Barrel Rim)
    '#5b9bd5', // 4: Zombie Ice-Blue Skin
    '#f8fafc', // 5: Crisp White (Zombie Shirt / Sakamoto Bandana)
    '#3b82f6', // 6: Zombie Blue Pants
    '#f97316', // 7: Devil Orange Joint Ring / Rocket Flame
    '#ef4444', // 8: Red Devil Body / Red Crate
    '#2563eb', // 9: Bert Royal Blue Shirt
    '#9ca3af', // 10: Metallic Silver Barrel
    '#6b7280', // 11: Recessed Dark Grey Lid / Wall Stone
    '#4ade80', // 12: Fast Runner Green Skin
    '#451a03', // 13: Dark Brown Hair / Shotgun Wood Stock
    '#3f6212', // 14: Olive Tactical Green (Rocket / Grenade / Mine)
    '#facc15', // 15: Hazard Yellow (C4 Charge Pack / Muzzle)
    '#a8a29e', // 16: Concrete Fake Wall Light Stone
    '#1f2937', // 17: Agent Bind Dark Suit
    '#22c55e', // 18: Bright Green LED (Charge Pack)
    '#14532d', // 19: Dark Green LED (Charge Pack)
    '#7f1d1d', // 20: Dark Red LED (Claymore Mine)
    '#f4320b', // 21: Classic Red Box Vivid Orange-Red
    '#868686', // 22: Fake Wall Center Stone Grey
    '#d6d3d1', // 23: Fake Wall Side Highlight Stone Grey
];

function parseBBModelAnimations(
    rawAnimations: unknown,
    bones: Record<BBBoneName, { uuid: string; origin: [number, number, number] }>,
): Record<string, BBAnimationClip> {
    const result: Record<string, BBAnimationClip> = {};
    if (!Array.isArray(rawAnimations)) return result;

    // Map bone UUIDs to BBBoneName for fast lookup when animator key is a UUID
    const uuidToBoneName: Record<string, BBBoneName> = {};
    for (const [bName, bInfo] of Object.entries(bones)) {
        if (bInfo?.uuid) {
            uuidToBoneName[bInfo.uuid] = bName as BBBoneName;
        }
        uuidToBoneName[bName] = bName as BBBoneName;
    }

    for (const rawAnim of rawAnimations) {
        if (!rawAnim || typeof rawAnim !== 'object') continue;
        const animObj = rawAnim as {
            uuid?: string;
            name?: string;
            loop?: 'once' | 'hold' | 'loop';
            length?: number;
            animators?: Record<
                string,
                {
                    name?: string;
                    type?: string;
                    keyframes?: Array<{
                        channel?: string;
                        time?: number;
                        interpolation?: 'linear' | 'catmullrom' | 'smooth' | 'step';
                        data_points?: Array<{
                            x?: number | string;
                            y?: number | string;
                            z?: number | string;
                        }>;
                    }>;
                }
            >;
        };
        const animName = animObj.name || animObj.uuid || 'default';
        const tracks: Partial<Record<BBBoneName, BBBoneTrack>> = {};

        if (animObj.animators && typeof animObj.animators === 'object') {
            for (const [animKey, animator] of Object.entries(animObj.animators)) {
                if (!animator || typeof animator !== 'object') continue;
                const resolvedBoneName =
                    (animator.name && uuidToBoneName[animator.name]) ||
                    uuidToBoneName[animKey] ||
                    (animator.name as BBBoneName | undefined);
                if (!resolvedBoneName) continue;

                const rotKfs: BBKeyframe[] = [];
                const posKfs: BBKeyframe[] = [];

                if (Array.isArray(animator.keyframes)) {
                    for (const kf of animator.keyframes) {
                        if (!kf || typeof kf !== 'object') continue;
                        const dp =
                            Array.isArray(kf.data_points) && kf.data_points[0]
                                ? kf.data_points[0]
                                : { x: 0, y: 0, z: 0 };
                        const xNum = Number(dp.x) || 0;
                        const yNum = Number(dp.y) || 0;
                        const zNum = Number(dp.z) || 0;
                        const time = typeof kf.time === 'number' ? kf.time : 0;
                        const interpolation = kf.interpolation || 'linear';

                        if (kf.channel === 'rotation') {
                            rotKfs.push({
                                time,
                                value: [xNum * DEG_TO_RAD, yNum * DEG_TO_RAD, zNum * DEG_TO_RAD],
                                interpolation,
                            });
                        } else if (kf.channel === 'position') {
                            posKfs.push({
                                time,
                                value: [xNum, yNum, zNum],
                                interpolation,
                            });
                        }
                    }
                }

                rotKfs.sort((a, b) => a.time - b.time);
                posKfs.sort((a, b) => a.time - b.time);

                tracks[resolvedBoneName] = {
                    boneName: resolvedBoneName,
                    rotation: rotKfs,
                    position: posKfs,
                };
            }
        }

        result[animName] = {
            uuid: animObj.uuid || animName,
            name: animName,
            loop: animObj.loop || 'once',
            length: typeof animObj.length === 'number' && animObj.length > 0 ? animObj.length : 1.0,
            tracks,
        };
    }

    return result;
}

/**
 * Dynamically loads a single `.bbmodel` asset from `/public/assets/bbmodels/...` on demand.
 */
export async function loadBBModelById(id: BBAssetId, forceReload: boolean = false): Promise<CompiledBBModel> {
    const entry = BBMODEL_CATALOG[id];
    if (!entry) {
        return BBMODEL_CATALOG.bambo;
    }
    if (!forceReload && entry.isLoaded && entry.cubes.length > 0) {
        return entry;
    }

    const inflight = bbModelLoadPromises.get(id);
    if (!forceReload && inflight) return inflight;

    const promise = (async () => {
        try {
            if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
                const res = await fetch(assetUrl(entry.filePath), { cache: 'no-cache' });
                if (res.ok) {
                    const parsed = await res.json();
                    entry.rawBBModelJSON = parsed;
                    if (
                        parsed.boxhead_meta &&
                        Array.isArray(parsed.boxhead_meta.cubes) &&
                        parsed.boxhead_meta.cubes.length > 0
                    ) {
                        if (typeof parsed.boxhead_meta.scale === 'number') {
                            entry.scale = parsed.boxhead_meta.scale;
                        }
                        if (typeof parsed.boxhead_meta.mountSocket === 'string') {
                            entry.mountSocket = parsed.boxhead_meta.mountSocket as BBBoneName;
                        }
                        if (parsed.boxhead_meta.bones) {
                            entry.bones = {
                                ...entry.bones,
                                ...parsed.boxhead_meta.bones,
                            };
                        }
                        entry.cubes = parsed.boxhead_meta.cubes;
                    } else if (Array.isArray(parsed.elements)) {
                        // Native Blockbench .bbmodel fallback parser (from elements + outliner)
                        const cubeBonePathMap: Record<string, BBBoneName[]> = {};
                        const walkOutliner = (nodes: unknown[], pathSoFar: BBBoneName[]) => {
                            for (const node of nodes) {
                                if (typeof node === 'string') {
                                    cubeBonePathMap[node] = pathSoFar;
                                } else if (node && typeof node === 'object') {
                                    const bNode = node as {
                                        name?: BBBoneName;
                                        uuid?: string;
                                        origin?: [number, number, number];
                                        children?: unknown[];
                                    };
                                    const bName = bNode.name || 'body_bone';
                                    const nextPath: BBBoneName[] = [...pathSoFar, bName];
                                    if (bNode.origin && bName in entry.bones) {
                                        entry.bones[bName] = {
                                            uuid: bNode.uuid || bName,
                                            origin: bNode.origin,
                                        };
                                    }
                                    if (Array.isArray(bNode.children)) {
                                        walkOutliner(bNode.children, nextPath);
                                    }
                                }
                            }
                        };
                        if (Array.isArray(parsed.outliner)) {
                            walkOutliner(parsed.outliner, []);
                        }
                        entry.cubes = parsed.elements.map(
                            (el: {
                                uuid?: string;
                                name?: string;
                                from: [number, number, number];
                                to: [number, number, number];
                                origin?: [number, number, number];
                                rotation?: [number, number, number];
                                faces?: { north?: { uv?: [number, number, number, number] } };
                            }) => {
                                const uv = el.faces?.north?.uv || [1, 1, 7, 7];
                                const col = Math.round((uv[0] - 1) / 8);
                                const row = Math.round((uv[1] - 1) / 8);
                                const idx = row * 8 + col;
                                let hexColor = PALETTE_SWATCHES[idx] || '#e2b281';
                                if (id === 'red_box' && el.name === 'RedBox_Classic_Simple_Cube') {
                                    hexColor = '#f4320b';
                                }
                                return {
                                    uuid: el.uuid || el.name || 'cube',
                                    name: el.name || 'cube',
                                    from: el.from,
                                    to: el.to,
                                    origin: el.origin || [0, 0, 0],
                                    rotation: el.rotation || [0, 0, 0],
                                    hexColor,
                                    bonePath: (el.uuid && cubeBonePathMap[el.uuid]) || ['root', 'body_bone'],
                                };
                            },
                        );
                    }
                    entry.animations = parseBBModelAnimations(parsed.animations, entry.bones);
                    entry.isLoaded = entry.cubes.length > 0;
                    notifyBBModelListeners();
                }
            }
        } catch {
            // Ignore fetch errors
        } finally {
            bbModelLoadPromises.delete(id);
        }
        return entry;
    })();

    bbModelLoadPromises.set(id, promise);
    return promise;
}

/**
 * Loads a specific list of `.bbmodel` assets on demand.
 */
export async function loadBBModelsByIds(
    ids: BBAssetId[],
    onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
    const uniqueIds = Array.from(new Set(ids));
    const total = uniqueIds.length;
    if (total === 0) {
        onProgress?.(0, 0);
        return;
    }
    let loaded = 0;
    await Promise.all(
        uniqueIds.map(async (id) => {
            await loadBBModelById(id);
            loaded += 1;
            onProgress?.(loaded, total);
        }),
    );
}

/**
 * Preloads all 4 selectable player character `.bbmodel` files
 * into memory during the Home -> Lobby transition so character cycling has zero lag.
 */
export const LOBBY_PRELOAD_BBMODEL_IDS: BBAssetId[] = ['bambo', 'bind', 'bert', 'sakamoto'];

export async function loadAllLobbyBBModels(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    await loadBBModelsByIds(LOBBY_PRELOAD_BBMODEL_IDS, onProgress);
}

/**
 * Computes active player character and monster IDs for the current match while
 * preserving lightweight preloaded `.bbmodel` caches in memory (Approach A) so
 * returning to the lobby or switching modes/characters never requires reloading.
 */
export function releaseUnusedMatchBBModels(params: {
    gameMode: 'SOLO' | 'COOP_2P' | 'COOP_AI' | 'DEATHMATCH_2P';
    p1CharId: BBAssetId;
    p2CharId: BBAssetId;
}): { activeCharIds: BBAssetId[]; monsterIds: BBAssetId[] } {
    const activeCharIds: BBAssetId[] =
        params.gameMode === 'SOLO' ? [params.p1CharId] : Array.from(new Set([params.p1CharId, params.p2CharId]));

    const monsterIds: BBAssetId[] = params.gameMode === 'DEATHMATCH_2P' ? [] : ['zombie', 'fast_zombie', 'devil'];

    return { activeCharIds, monsterIds };
}

/**
 * Unloads any unselected character or unused monster `.bbmodel` data from memory
 * and loads only the 1 or 2 selected player characters + mode-relevant monsters & weapons.
 */
export async function loadMatchBBModels(
    params: {
        gameMode: 'SOLO' | 'COOP_2P' | 'COOP_AI' | 'DEATHMATCH_2P';
        p1CharId: BBAssetId;
        p2CharId: BBAssetId;
    },
    onProgress?: (loaded: number, total: number) => void,
): Promise<void> {
    const { activeCharIds, monsterIds } = releaseUnusedMatchBBModels(params);

    const weaponAndEquipIds: BBAssetId[] = [
        'pistol',
        'uzi',
        'shotgun',
        'barrel',
        'grenade',
        'wall',
        'mine',
        'rocket',
        'charge_pack',
        'railgun',
        'red_box',
    ];

    const requiredIds: BBAssetId[] = [...activeCharIds, ...monsterIds, ...weaponAndEquipIds];

    await loadBBModelsByIds(requiredIds, onProgress);
}

/**
 * Loads all 18 standalone `.bbmodel` files (used only when exporting full archive in Model Studio).
 */
export async function loadStandaloneBBModelAssets(onProgress?: (loaded: number, total: number) => void): Promise<void> {
    await loadBBModelsByIds(ALL_BBMODEL_IDS, onProgress);
}
