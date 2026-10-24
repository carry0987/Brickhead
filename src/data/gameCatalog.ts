import type { CharacterSpec, RoomSpec } from '@/types/game';
import { assetUrl } from '@/utils/assetUrl';

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 680;
export const TILE_SIZE = 40;

export const CHARACTERS: CharacterSpec[] = [
    {
        id: 'bambo',
        skinColor: '#e2b281',
        hairColor: '#18181b',
        bandanaColor: '#dc2626',
        shirtColor: '#e2b281',
        pantsColor: '#18181b',
    },
    {
        id: 'bind',
        skinColor: '#e2b281',
        hairColor: '#3b1d0a',
        shirtColor: '#1f2937',
        pantsColor: '#09090b',
        glasses: true,
    },
    {
        id: 'bert',
        skinColor: '#e2b281',
        hairColor: '#451a03',
        shirtColor: '#2563eb',
        pantsColor: '#1e293b',
    },
    {
        id: 'sakamoto',
        skinColor: '#e2b281',
        hairColor: '#09090b',
        bandanaColor: '#f8fafc',
        shirtColor: '#27272a',
        pantsColor: '#18181b',
    },
];

const FALLBACK_ROOM: RoomSpec = {
    id: 'room_01',
    worldWidth: 721,
    worldHeight: 801,
    bounds: { x: 16, y: 103.3, w: 704, h: 544 },
    floorColor: '#ebdcc7',
    patchColor: '#d8cccc',
    gridLineColor: '#dfd2b8',
    wallTopColor: '#ffffff',
    wallBevelColor: '#b2b2b2',
    wallSideColor: '#888888',
    hasPerimeterWalls: false,
    filePath: 'assets/maps/room_01.json',
    isLoaded: false,
    obstacles: [],
    spawnNodes: [],
};

/**
 * Dynamic Map Catalog populated from `assets/maps/index.json`.
 * Individual map geometry (`obstacles` & `spawnNodes`) is loaded on-demand via `loadRoomById()`.
 */
export const ROOMS: RoomSpec[] = [FALLBACK_ROOM];

const roomListeners = new Set<() => void>();
const roomLoadPromises = new Map<string, Promise<RoomSpec>>();
let mapsIndexLoaded = false;
let mapsIndexPromise: Promise<RoomSpec[]> | null = null;

function notifyRoomListeners() {
    for (const fn of roomListeners) fn();
}

export function subscribeRooms(fn: () => void): () => void {
    roomListeners.add(fn);
    return () => roomListeners.delete(fn);
}

/**
 * Loads the lightweight map directory from `assets/maps/index.json` once.
 */
export async function loadMapsIndex(): Promise<RoomSpec[]> {
    if (mapsIndexLoaded) return ROOMS;
    if (mapsIndexPromise) return mapsIndexPromise;

    mapsIndexPromise = (async () => {
        try {
            if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
                const res = await fetch(assetUrl('assets/maps/index.json'));
                if (res.ok) {
                    const list: Array<Omit<RoomSpec, 'obstacles' | 'spawnNodes'>> = await res.json();
                    if (Array.isArray(list) && list.length > 0) {
                        const existingById = new Map(ROOMS.map((r) => [r.id, r]));
                        const nextRooms: RoomSpec[] = list.map((item) => {
                            const prev = existingById.get(item.id);
                            return {
                                ...item,
                                filePath: item.filePath || `assets/maps/${item.id}.json`,
                                isLoaded: prev?.isLoaded ?? false,
                                obstacles: prev?.obstacles ?? [],
                                spawnNodes: prev?.spawnNodes ?? [],
                            };
                        });
                        ROOMS.splice(0, ROOMS.length, ...nextRooms);
                        mapsIndexLoaded = true;
                        notifyRoomListeners();
                    }
                }
            }
        } catch {
            // Keep fallback room if offline
        } finally {
            mapsIndexPromise = null;
        }
        return ROOMS;
    })();

    return mapsIndexPromise;
}

/**
 * Preserves lightweight preloaded map JSON (`obstacles` & `spawnNodes`) in memory
 * (Approach A) so returning from battle to the lobby or cycling maps never reloads.
 */
export function releaseUnselectedRooms(_selectedRoomId: string): void {
    // Intentionally retained in memory (< 200 KB total across all 18 rooms)
}

/**
 * Dynamically loads a single map JSON from `assets/maps/{roomId}.json` into memory.
 * When `releaseOthers: true` is passed (e.g., on entering battle), unselected maps'
 * obstacles and spawnNodes are evicted from memory so only the active map remains loaded.
 */
export async function loadRoomById(roomId: string, options?: { releaseOthers?: boolean }): Promise<RoomSpec> {
    await loadMapsIndex();
    const target = ROOMS.find((r) => r.id === roomId) || ROOMS[0] || FALLBACK_ROOM;

    if (options?.releaseOthers) {
        releaseUnselectedRooms(target.id);
    }

    if (target.isLoaded && target.obstacles.length > 0) {
        return target;
    }

    const inflight = roomLoadPromises.get(target.id);
    if (inflight) return inflight;

    const promise = (async () => {
        try {
            if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
                const res = await fetch(assetUrl(target.filePath || `assets/maps/${target.id}.json`));
                if (res.ok) {
                    const data: RoomSpec = await res.json();
                    if (Array.isArray(data.obstacles)) {
                        target.obstacles = data.obstacles;
                    }
                    if (Array.isArray(data.spawnNodes)) {
                        target.spawnNodes = data.spawnNodes;
                    }
                    if (
                        data.bounds &&
                        (!target.bounds ||
                            target.bounds.x !== data.bounds.x ||
                            target.bounds.y !== data.bounds.y ||
                            target.bounds.w !== data.bounds.w ||
                            target.bounds.h !== data.bounds.h)
                    ) {
                        target.bounds = data.bounds;
                    }
                    if (Array.isArray(data.stainTransforms)) {
                        target.stainTransforms = data.stainTransforms;
                    }
                    target.isLoaded = true;
                    notifyRoomListeners();
                }
            }
        } catch {
            // Keep empty fallback if offline
        } finally {
            roomLoadPromises.delete(target.id);
        }
        return target;
    })();

    roomLoadPromises.set(target.id, promise);
    return promise;
}

/**
 * Preloads all map JSON files into memory at once during the Home -> Lobby transition
 * so cycling maps in the lobby has zero lag.
 */
export async function loadAllRooms(onProgress?: (loaded: number, total: number) => void): Promise<RoomSpec[]> {
    await loadMapsIndex();
    const total = ROOMS.length;
    if (total === 0) {
        onProgress?.(0, 0);
        return ROOMS;
    }
    let loaded = 0;
    onProgress?.(0, total);
    await Promise.all(
        ROOMS.map(async (r) => {
            await loadRoomById(r.id, { releaseOthers: false });
            loaded += 1;
            onProgress?.(loaded, total);
        }),
    );
    return ROOMS;
}
