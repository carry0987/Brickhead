import type { WeaponId } from '@/types/game';
import { assetUrl } from './assetUrl';

const WAV_PATHS = {
    click: assetUrl('assets/sounds/ui_click.wav'),
    hitFloor: assetUrl('assets/sounds/creature_hit_floor.wav'),
    playerScream1: assetUrl('assets/sounds/creature_player_scream_1.wav'),
    playerScream2: assetUrl('assets/sounds/creature_player_scream_2.wav'),
    zombieAmbience1: assetUrl('assets/sounds/creature_zombie_ambience_1.wav'),
    zombieAmbience2: assetUrl('assets/sounds/creature_zombie_ambience_2.wav'),
    zombieAmbience3: assetUrl('assets/sounds/creature_zombie_ambience_3.wav'),
    zombieAmbience4: assetUrl('assets/sounds/creature_zombie_ambience_4.wav'),
    zombieAttack: assetUrl('assets/sounds/creature_zombie_attack.wav'),
    explosion: assetUrl('assets/sounds/effect_explosion.wav'),
    barrelPlace: assetUrl('assets/sounds/object_barrel_place.wav'),
    mineDetonate: assetUrl('assets/sounds/object_mine_detonate.wav'),
    pickup: assetUrl('assets/sounds/object_pickup.wav'),
    grenadeBounce: assetUrl('assets/sounds/shot_grenade_bounce.wav'),
    hitWall1: assetUrl('assets/sounds/shot_hit_wall_1.wav'),
    hitWall2: assetUrl('assets/sounds/shot_hit_wall_2.wav'),
    hitWall3: assetUrl('assets/sounds/shot_hit_wall_3.wav'),
    shotRocketFire: assetUrl('assets/sounds/shot_rocket_fire.wav'),
    minePlace: assetUrl('assets/sounds/weapon_mine_place.wav'),
    pistolFire: assetUrl('assets/sounds/weapon_pistol_fire.wav'),
    railgunFire: assetUrl('assets/sounds/weapon_railgun_fire.wav'),
    rocketFire: assetUrl('assets/sounds/weapon_rocket_fire.wav'),
    shotgunFire: assetUrl('assets/sounds/weapon_shotgun_fire.wav'),
    uziFire: assetUrl('assets/sounds/weapon_uzi_fire.wav'),
    worldEnd: assetUrl('assets/sounds/world_end.wav'),
} as const;

type SoundKey = keyof typeof WAV_PATHS;

// In weapon_shotgun_fire.wav:
// 00:00:00 -> 00:00:60 (0.0s to 0.60s) is the firing blast;
// 00:00:60 -> end is the pump-action reload sound.
const SHOTGUN_BLAST_END_SEC = 0.6;

class SoundManager {
    public muted: boolean = false;
    public masterVolume: number = 1.0;
    private audioCache: Map<SoundKey, HTMLAudioElement> = new Map();
    private lastPlayedAt: Map<string, number> = new Map();
    private audioCtx: AudioContext | null = null;
    private shotgunBuffer: AudioBuffer | null = null;
    private shotgunReloadTimer: number | null = null;
    private activeGameplayAudios: Set<HTMLAudioElement> = new Set();
    private activeBufferSources: Set<AudioBufferSourceNode> = new Set();
    private activeTimers: Set<number> = new Set();

    constructor() {
        if (typeof window !== 'undefined') {
            // Preload audio elements for instant playback
            (Object.keys(WAV_PATHS) as SoundKey[]).forEach((key) => {
                const audio = new Audio(WAV_PATHS[key]);
                audio.preload = 'auto';
                this.audioCache.set(key, audio);
            });

            this.preloadShotgunBuffer();
        }
    }

    private preloadShotgunBuffer(): Promise<void> {
        if (typeof window === 'undefined') return Promise.resolve();
        if (this.shotgunBuffer) return Promise.resolve();
        const AudioCtx =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return Promise.resolve();

        return fetch(WAV_PATHS.shotgunFire)
            .then((res) => res.arrayBuffer())
            .then((buf) => {
                if (!this.audioCtx) {
                    this.audioCtx = new AudioCtx();
                }
                return this.audioCtx.decodeAudioData(buf);
            })
            .then((decoded) => {
                this.shotgunBuffer = decoded;
            })
            .catch(() => {
                // Fallback to HTMLAudioElement slicing if decode fails
            });
    }

    /**
     * Ensures all 26 game sound assets and WebAudio buffers are initialized and ready
     * before starting the combat loop, reporting progress for the Lego loading bar.
     */
    public async preloadAllSounds(onProgress?: (loaded: number, total: number) => void): Promise<void> {
        if (typeof window === 'undefined') {
            onProgress?.(1, 1);
            return;
        }
        const keys = Object.keys(WAV_PATHS) as SoundKey[];
        const total = keys.length;
        let loaded = 0;

        await Promise.all(
            keys.map(
                (key) =>
                    new Promise<void>((resolve) => {
                        let audio = this.audioCache.get(key);
                        if (!audio) {
                            audio = new Audio(WAV_PATHS[key]);
                            audio.preload = 'auto';
                            this.audioCache.set(key, audio);
                        }

                        if (audio.readyState >= 2) {
                            loaded += 1;
                            onProgress?.(loaded, total);
                            resolve();
                            return;
                        }

                        let settled = false;
                        const finish = () => {
                            if (settled) return;
                            settled = true;
                            audio?.removeEventListener('canplaythrough', finish);
                            audio?.removeEventListener('loadeddata', finish);
                            audio?.removeEventListener('error', finish);
                            loaded += 1;
                            onProgress?.(loaded, total);
                            resolve();
                        };

                        audio.addEventListener('canplaythrough', finish, { once: true });
                        audio.addEventListener('loadeddata', finish, { once: true });
                        audio.addEventListener('error', finish, { once: true });
                        try {
                            audio.load();
                        } catch {
                            finish();
                        }
                        window.setTimeout(finish, 180);
                    }),
            ),
        );

        await this.preloadShotgunBuffer();
    }

    private trackGameplayAudio(instance: HTMLAudioElement) {
        this.activeGameplayAudios.add(instance);
        const cleanup = () => {
            this.activeGameplayAudios.delete(instance);
            instance.removeEventListener('ended', cleanup);
            instance.removeEventListener('pause', cleanup);
            instance.removeEventListener('error', cleanup);
        };
        instance.addEventListener('ended', cleanup, { once: true });
        instance.addEventListener('pause', cleanup, { once: true });
        instance.addEventListener('error', cleanup, { once: true });
    }

    /**
     * Immediately stops all currently playing or scheduled combat/gameplay sound effects
     * (leaving UI click sounds untouched).
     */
    public stopAllGameplaySounds() {
        if (typeof window === 'undefined') return;

        if (this.shotgunReloadTimer !== null) {
            window.clearTimeout(this.shotgunReloadTimer);
            this.shotgunReloadTimer = null;
        }

        this.activeTimers.forEach((timerId) => {
            window.clearTimeout(timerId);
        });
        this.activeTimers.clear();

        this.activeGameplayAudios.forEach((audio) => {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch {
                // ignore
            }
        });
        this.activeGameplayAudios.clear();

        this.activeBufferSources.forEach((source) => {
            try {
                source.stop();
                source.disconnect();
            } catch {
                // ignore
            }
        });
        this.activeBufferSources.clear();
    }

    public setMasterVolume(volumeRatio: number) {
        this.masterVolume = Math.max(0, Math.min(1, volumeRatio));
    }

    private playWav(key: SoundKey, volume: number = 0.7, minIntervalMs: number = 0, throttleGroup?: string) {
        if (this.muted || this.masterVolume <= 0.001 || typeof window === 'undefined') return;
        const groupKey = throttleGroup || key;
        if (minIntervalMs > 0) {
            const now = performance.now();
            const prev = this.lastPlayedAt.get(groupKey) || 0;
            if (now - prev < minIntervalMs) return;
            this.lastPlayedAt.set(groupKey, now);
        }

        try {
            const base = this.audioCache.get(key);
            const instance = base ? (base.cloneNode() as HTMLAudioElement) : new Audio(WAV_PATHS[key]);
            instance.volume = Math.max(0, Math.min(1, volume * this.masterVolume));
            if (key !== 'click') {
                this.trackGameplayAudio(instance);
            }
            instance.play().catch(() => {
                this.activeGameplayAudios.delete(instance);
            });
        } catch {
            // Ignore autoplay errors before user gesture
        }
    }

    // Plays ONLY the shotgun firing blast segment (0.00s -> 0.60s)
    public playShotgunBlast() {
        if (this.muted || this.masterVolume <= 0.001 || typeof window === 'undefined') return;

        // Cancel any pending reload sound because the player is still firing!
        if (this.shotgunReloadTimer !== null) {
            window.clearTimeout(this.shotgunReloadTimer);
            this.shotgunReloadTimer = null;
        }

        const now = performance.now();
        const prev = this.lastPlayedAt.get('shotgunBlast') || 0;
        if (now - prev < 35) return;
        this.lastPlayedAt.set('shotgunBlast', now);

        if (this.shotgunBuffer && this.audioCtx) {
            try {
                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().catch(() => {});
                }
                const source = this.audioCtx.createBufferSource();
                source.buffer = this.shotgunBuffer;
                const gainNode = this.audioCtx.createGain();
                gainNode.gain.value = Math.max(0, Math.min(1, 0.82 * this.masterVolume));
                source.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);
                this.activeBufferSources.add(source);
                source.onended = () => {
                    this.activeBufferSources.delete(source);
                };
                source.start(0, 0, Math.min(SHOTGUN_BLAST_END_SEC, this.shotgunBuffer.duration));
                return;
            } catch {
                // Fallback below
            }
        }

        try {
            const base = this.audioCache.get('shotgunFire');
            const instance = base ? (base.cloneNode() as HTMLAudioElement) : new Audio(WAV_PATHS.shotgunFire);
            instance.volume = Math.max(0, Math.min(1, 0.82 * this.masterVolume));
            instance.currentTime = 0;
            this.trackGameplayAudio(instance);
            instance.play().catch(() => {
                this.activeGameplayAudios.delete(instance);
            });
            const timerId = window.setTimeout(() => {
                this.activeTimers.delete(timerId);
                try {
                    instance.pause();
                } catch {
                    // ignore
                }
            }, SHOTGUN_BLAST_END_SEC * 1000);
            this.activeTimers.add(timerId);
        } catch {
            // Ignore
        }
    }

    // Schedules the shotgun pump-action reload segment (0.60s -> end) to play ONCE after firing stops
    public triggerShotgunReloadAfterStop(elapsedSinceLastShotMs: number = 0) {
        if (this.muted || typeof window === 'undefined') return;

        if (this.shotgunReloadTimer !== null) {
            window.clearTimeout(this.shotgunReloadTimer);
            this.shotgunReloadTimer = null;
        }

        // Wait until the final shot's 0.00s-0.60s blast finishes, then play the 0.60s-end reload segment once!
        const delayMs = Math.max(0, SHOTGUN_BLAST_END_SEC * 1000 - elapsedSinceLastShotMs);

        this.shotgunReloadTimer = window.setTimeout(() => {
            this.shotgunReloadTimer = null;
            this.playShotgunReloadSegment();
        }, delayMs);
    }

    private playShotgunReloadSegment() {
        if (this.muted || this.masterVolume <= 0.001 || typeof window === 'undefined') return;

        if (this.shotgunBuffer && this.audioCtx) {
            try {
                if (this.audioCtx.state === 'suspended') {
                    this.audioCtx.resume().catch(() => {});
                }
                const reloadDuration = Math.max(0.05, this.shotgunBuffer.duration - SHOTGUN_BLAST_END_SEC);
                const source = this.audioCtx.createBufferSource();
                source.buffer = this.shotgunBuffer;
                const gainNode = this.audioCtx.createGain();
                gainNode.gain.value = Math.max(0, Math.min(1, 0.85 * this.masterVolume));
                source.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);
                this.activeBufferSources.add(source);
                source.onended = () => {
                    this.activeBufferSources.delete(source);
                };
                source.start(0, SHOTGUN_BLAST_END_SEC, reloadDuration);
                return;
            } catch {
                // Fallback below
            }
        }

        try {
            const base = this.audioCache.get('shotgunFire');
            const instance = base ? (base.cloneNode() as HTMLAudioElement) : new Audio(WAV_PATHS.shotgunFire);
            instance.volume = Math.max(0, Math.min(1, 0.85 * this.masterVolume));
            instance.currentTime = SHOTGUN_BLAST_END_SEC;
            this.trackGameplayAudio(instance);
            instance.play().catch(() => {
                this.activeGameplayAudios.delete(instance);
            });
        } catch {
            // Ignore
        }
    }

    public playClick() {
        this.playWav('click', 0.85, 25);
    }

    public playPlaceItem(kind?: 'barrel' | 'wall' | 'mine' | 'charge_pack') {
        if (kind === 'mine' || kind === 'charge_pack') {
            this.playWav('minePlace', 0.8, 35);
        } else {
            this.playWav('barrelPlace', 0.8, 35);
        }
    }

    public playMineDetonate() {
        this.playWav('mineDetonate', 0.9, 40);
    }

    public playPickupBox() {
        this.playWav('pickup', 0.85, 40);
    }

    public playGrenadeBounce() {
        this.playWav('grenadeBounce', 0.65, 55);
    }

    public playHitWall() {
        const keys: SoundKey[] = ['hitWall1', 'hitWall2', 'hitWall3'];
        const key = keys[Math.floor(Math.random() * keys.length)];
        this.playWav(key, 0.82, 20, 'hitWall');
    }

    public playZombieAttack() {
        this.playWav('zombieAttack', 0.75, 120, 'zombieAttack');
    }

    public playZombieAmbience() {
        const pick = Math.floor(Math.random() * 4);
        const keys: SoundKey[] = ['zombieAmbience1', 'zombieAmbience2', 'zombieAmbience3', 'zombieAmbience4'];
        this.playWav(keys[pick], 0.45, 2200, 'zombieAmbience');
    }

    public playCreatureHitFloor() {
        this.playWav('hitFloor', 0.72, 65, 'hitFloor');
    }

    /** Non-lethal player hurt sound: uses creature_player_scream_2.wav only */
    public playPlayerScream() {
        this.playWav('playerScream2', 0.85, 80, 'playerScream');
    }

    /** Player death scream: creature_player_scream_1.wav is played ONLY when a player dies */
    public playPlayerDeathScream() {
        this.playWav('playerScream1', 0.92, 0, 'playerDeathScream');
    }

    public playWorldEnd() {
        this.playWav('worldEnd', 0.9, 500);
    }

    public playWeaponFire(weaponId: WeaponId | 'devil_fireball') {
        if (weaponId === 'barrel' || weaponId === 'wall') {
            this.playPlaceItem(weaponId);
            return;
        }
        if (weaponId === 'mine' || weaponId === 'charge_pack') {
            this.playPlaceItem(weaponId);
            return;
        }
        if (weaponId === 'pistol') {
            this.playWav('pistolFire', 0.75, 35);
        } else if (weaponId === 'uzi') {
            this.playWav('uziFire', 0.65, 30);
        } else if (weaponId === 'shotgun') {
            this.playShotgunBlast();
        } else if (weaponId === 'rocket') {
            this.playWav('rocketFire', 0.85, 50);
            this.playWav('shotRocketFire', 0.75, 50);
        } else if (weaponId === 'railgun') {
            this.playWav('railgunFire', 0.85, 50);
        } else if (weaponId === 'grenade') {
            this.playWav('barrelPlace', 0.6, 40);
        } else if (weaponId === 'devil_fireball') {
            this.playWav('zombieAttack', 0.8, 80, 'devilFireball');
        }
    }

    public playExplosion(scale: number = 1) {
        const vol = Math.min(1, Math.max(0.55, 0.72 * scale));
        this.playWav('explosion', vol, 40);
    }
}

export const soundFX = new SoundManager();
