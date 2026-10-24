import type { PlayerEntity, RoomId, WeaponId } from '@/types/game';

export interface RoomBestRecord {
    bestCombo: number;
    bestSurvivalSeconds: number;
    bestWave: number;
    bestScore: number;
}

export interface PersonalBestStats {
    bestCombo: number;
    bestSurvivalSeconds: number;
    bestWave: number;
    bestScore: number;
    totalKills: number;
    lastPlayedRoom?: RoomId;
    updatedAt?: number;
    roomRecords: Partial<Record<RoomId, RoomBestRecord>>;
}

export interface SavedPlayerWeaponState {
    playerId: 'P1' | 'P2';
    currentWeapon: WeaponId;
    ammo: Record<WeaponId, number>;
    maxAmmo: Record<WeaponId, number>;
    unlocked: Record<WeaponId, boolean>;
    combo: number;
    maxComboReached: number;
    unlockedMilestones: number[];
}

export interface SavedRunWeaponsSnapshot {
    updatedAt: number;
    globalMaxComboReached: number;
    players: Partial<Record<'P1' | 'P2', SavedPlayerWeaponState>>;
}

const STORAGE_KEY = 'boxhead_2play_personal_bests_v1';
const WEAPON_STATE_STORAGE_KEY = 'boxhead_2play_active_weapons_v1';

const DEFAULT_STATS: PersonalBestStats = {
    bestCombo: 0,
    bestSurvivalSeconds: 0,
    bestWave: 0,
    bestScore: 0,
    totalKills: 0,
    roomRecords: {},
};

export function formatSurvivalTime(totalSeconds: number): string {
    const safeSecs = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(safeSecs / 60);
    const secs = safeSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

class StatsStorageManager {
    private stats: PersonalBestStats = { ...DEFAULT_STATS };
    private listeners = new Set<() => void>();

    constructor() {
        this.load();
    }

    private load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            this.stats = {
                bestCombo: Number(parsed.bestCombo) || 0,
                bestSurvivalSeconds: Number(parsed.bestSurvivalSeconds) || 0,
                bestWave: Number(parsed.bestWave) || 0,
                bestScore: Number(parsed.bestScore) || 0,
                totalKills: Number(parsed.totalKills) || 0,
                lastPlayedRoom: parsed.lastPlayedRoom,
                updatedAt: parsed.updatedAt,
                roomRecords: parsed.roomRecords || {},
            };
        } catch {
            this.stats = { ...DEFAULT_STATS, roomRecords: {} };
        }
    }

    private save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stats));
        } catch {
            // Ignore storage quota errors
        }
    }

    public getStats(): PersonalBestStats {
        return this.stats;
    }

    /**
     * Updates personal bests in localStorage if current run metrics exceed stored records.
     * Returns flags indicating whether a new best combo or best survival time was achieved.
     */
    public updateFromRun(params: {
        roomId: RoomId;
        maxCombo: number;
        survivalSeconds: number;
        wave: number;
        score: number;
        killsDelta?: number;
    }): { isNewBestCombo: boolean; isNewBestTime: boolean } {
        const { roomId, maxCombo, survivalSeconds, wave, score, killsDelta = 0 } = params;

        const cleanSecs = Math.floor(survivalSeconds);
        const isNewBestCombo = maxCombo > this.stats.bestCombo && maxCombo > 0;
        const isNewBestTime = cleanSecs > this.stats.bestSurvivalSeconds && cleanSecs > 0;

        let changed = false;

        if (maxCombo > this.stats.bestCombo) {
            this.stats.bestCombo = maxCombo;
            changed = true;
        }
        if (cleanSecs > this.stats.bestSurvivalSeconds) {
            this.stats.bestSurvivalSeconds = cleanSecs;
            changed = true;
        }
        if (wave > this.stats.bestWave) {
            this.stats.bestWave = wave;
            changed = true;
        }
        if (score > this.stats.bestScore) {
            this.stats.bestScore = score;
            changed = true;
        }
        if (killsDelta > 0) {
            this.stats.totalKills += killsDelta;
            changed = true;
        }

        const prevRoom = this.stats.roomRecords[roomId] || {
            bestCombo: 0,
            bestSurvivalSeconds: 0,
            bestWave: 0,
            bestScore: 0,
        };

        if (
            maxCombo > prevRoom.bestCombo ||
            cleanSecs > prevRoom.bestSurvivalSeconds ||
            wave > prevRoom.bestWave ||
            score > prevRoom.bestScore
        ) {
            this.stats.roomRecords[roomId] = {
                bestCombo: Math.max(prevRoom.bestCombo, maxCombo),
                bestSurvivalSeconds: Math.max(prevRoom.bestSurvivalSeconds, cleanSecs),
                bestWave: Math.max(prevRoom.bestWave, wave),
                bestScore: Math.max(prevRoom.bestScore, score),
            };
            changed = true;
        }

        if (changed) {
            this.stats.lastPlayedRoom = roomId;
            this.stats.updatedAt = Date.now();
            this.save();
            this.notify();
        }

        return { isNewBestCombo, isNewBestTime };
    }

    public resetStats() {
        this.stats = { ...DEFAULT_STATS, roomRecords: {} };
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Ignore
        }
        this.notify();
    }

    public subscribe(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private notify() {
        for (const fn of this.listeners) fn();
    }
}

/**
 * Manages live P1 & P2 weapon ammo, unlocked weapons, and evolution milestones in localStorage
 * whenever weapons fire, reload/pickup, or evolve.
 * Allows restoring the exact pre-sandbox weapon state when maxed-weapons mode is turned off,
 * and clears the stored record upon GAME_OVER.
 */
class WeaponStateStorageManager {
    public savePlayersWeaponState(players: PlayerEntity[], globalMaxComboReached: number) {
        try {
            const snapshot: SavedRunWeaponsSnapshot = {
                updatedAt: Date.now(),
                globalMaxComboReached,
                players: {},
            };
            players.forEach((p) => {
                snapshot.players[p.id] = {
                    playerId: p.id,
                    currentWeapon: p.currentWeapon,
                    ammo: { ...p.ammo },
                    maxAmmo: { ...p.maxAmmo },
                    unlocked: { ...p.unlocked },
                    combo: p.combo,
                    maxComboReached: p.maxComboReached,
                    unlockedMilestones: [...p.unlockedMilestones],
                };
            });
            localStorage.setItem(WEAPON_STATE_STORAGE_KEY, JSON.stringify(snapshot));
        } catch {
            // Ignore storage quota errors
        }
    }

    public loadSnapshot(): SavedRunWeaponsSnapshot | null {
        try {
            const raw = localStorage.getItem(WEAPON_STATE_STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw) as SavedRunWeaponsSnapshot;
        } catch {
            return null;
        }
    }

    /**
     * Restores P1 and P2's saved weapon ammo, maxAmmo, unlocked flags, and evolution milestones
     * from localStorage when maxed-weapons mode is turned off.
     */
    public restorePlayersWeaponState(players: PlayerEntity[]): number | null {
        const snap = this.loadSnapshot();
        if (!snap) return null;

        players.forEach((p) => {
            const saved = snap.players[p.id];
            if (!saved) return;
            p.ammo = { ...saved.ammo };
            p.maxAmmo = { ...saved.maxAmmo };
            p.unlocked = { ...saved.unlocked };
            p.maxComboReached = saved.maxComboReached;
            p.unlockedMilestones = Array.isArray(saved.unlockedMilestones) ? [...saved.unlockedMilestones] : [];
            if (p.unlocked[saved.currentWeapon]) {
                p.currentWeapon = saved.currentWeapon;
            } else {
                p.currentWeapon = 'pistol';
            }
        });

        return snap.globalMaxComboReached;
    }

    public clearWeaponState() {
        try {
            localStorage.removeItem(WEAPON_STATE_STORAGE_KEY);
        } catch {
            // Ignore
        }
    }
}

export const statsStorage = new StatsStorageManager();
export const weaponStateStorage = new WeaponStateStorageManager();
