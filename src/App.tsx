import {
    ArrowLeft,
    Bot,
    Box,
    CheckCircle2,
    Clock,
    Flame,
    Keyboard,
    MapPin,
    Play,
    RotateCcw,
    Settings,
    Sparkles,
    Swords,
    Trophy,
    User,
    Users,
    Volume2,
    VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrickBattleCanvas } from './components/BrickBattleCanvas';
import { BoxheadCharacterAvatar, BoxheadHeroDioramaArt, BoxheadRoomPreviewSvg } from './components/LegoVectorArt';
import { MapViewerModal } from './components/MapViewerModal';
import { ModelStudioModal } from './components/ModelStudioModal';
import { GameButton } from './components/ui/GameButton';
import { GameNumberField } from './components/ui/GameNumberField';
import { GameSlider } from './components/ui/GameSlider';
import { useGameToast } from './components/ui/GameToastProvider';
import { LanguageMenu } from './components/ui/LanguageMenu';
import { ALL_BBMODEL_IDS, loadStandaloneBBModelAssets } from './data/bbmodelCatalog';
import { CHARACTERS, loadAllRooms, loadMapsIndex, ROOMS, subscribeRooms } from './data/gameCatalog';
import { AI_STRENGTH_SPECS } from './engine/tuning/aiTuning';
import { getCharacterDisplay, getRoomDisplay } from './i18n/catalogI18n';
import { getAIStrengthDisplay } from './i18n/lobbyI18n';
import * as m from './paraglide/messages';
import type {
    AIPartnerStrength,
    BlastDamageMode,
    CharacterId,
    ControlsConfig,
    DeathmatchFragsGoal,
    Difficulty,
    GameMode,
    GameOptionsConfig,
    GameSpeed,
    GameState,
    PlayerControlsBinding,
    RoomId,
} from './types/game';
import { soundFX } from './utils/sound';
import { formatSurvivalTime, type PersonalBestStats, statsStorage } from './utils/statsStorage';
import { preloadAllSvgEffectsWithProgress } from './utils/svgEffectRenderer';

const DEFAULT_OPTIONS: GameOptionsConfig = {
    difficulty: 'NORMAL',
    objectCollision: true,
    devilsEnabled: true,
    friendlyFire: false,
    explosionPlayerDamage: 'TEN_PERCENT',
    gameSpeed: 'NORMAL',
    deathmatchFrags: 10,
    minimapEnabled: true,
    masterVolume: 100,
    aiPartnerStrength: 'LV3',
    startingWave: 1,
};

const DEFAULT_CONTROLS: ControlsConfig = {
    p1: {
        up: 'w',
        down: 's',
        left: 'a',
        right: 'd',
        shoot: ' ',
        prevWeapon: 'q',
        nextWeapon: 'e',
    },
    p2: {
        up: 'arrowup',
        down: 'arrowdown',
        left: 'arrowleft',
        right: 'arrowright',
        shoot: '/',
        prevWeapon: ',',
        nextWeapon: '.',
    },
};

const OPTIONS_STORAGE_KEY = 'boxhead_2play_options_v1';
const CONTROLS_STORAGE_KEY = 'boxhead_2play_controls_v1';

function formatKeyLabel(key: string): string {
    if (key === ' ') return m.key_space();
    if (key === 'arrowup') return m.key_arrow_up();
    if (key === 'arrowdown') return m.key_arrow_down();
    if (key === 'arrowleft') return m.key_arrow_left();
    if (key === 'arrowright') return m.key_arrow_right();
    if (key === 'enter') return 'ENTER';
    if (key === 'shift') return 'SHIFT';
    if (key === 'control') return 'CTRL';
    if (key === '/') return m.key_slash();
    if (key === ',') return m.key_comma();
    if (key === '.') return m.key_period();
    return key.toUpperCase();
}

type MenuStep = 'STARTUP_LOADING' | 'MODE_SELECT' | 'LOBBY';
type LobbySubView = 'MAIN' | 'OPTIONS' | 'STARTING_WAVE' | 'CONTROLS' | 'AI_PARTNER' | 'SOUND' | 'HIGHSCORES';

export default function App() {
    const { notify } = useGameToast();
    const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
    const [menuStep, setMenuStep] = useState<MenuStep>('STARTUP_LOADING');
    const [lobbySubView, setLobbySubView] = useState<LobbySubView>('MAIN');
    const [isModelStudioOpen, setIsModelStudioOpen] = useState<boolean>(false);
    const [isMapViewerOpen, setIsMapViewerOpen] = useState<boolean>(false);
    const [isComboModalOpen, setIsComboModalOpen] = useState<boolean>(false);
    const openComboModal = useCallback(() => setIsComboModalOpen(true), []);
    const closeComboModal = useCallback(() => setIsComboModalOpen(false), []);

    // Global Startup Preload State (Loads all 3D .bbmodel models, 18 room maps, SVG effects, and WAV sounds before homepage)
    const startupLoadRunIdRef = useRef<number>(0);
    const [startupLoadProgress, setStartupLoadProgress] = useState<number>(8);
    const [startupLoadInfo, setStartupLoadInfo] = useState<{
        modelsLoaded: number;
        modelsTotal: number;
        mapsLoaded: number;
        mapsTotal: number;
        svgLoaded: number;
        svgTotal: number;
        soundsLoaded: number;
        soundsTotal: number;
        stageLabel: string;
    }>({
        modelsLoaded: 0,
        modelsTotal: ALL_BBMODEL_IDS.length,
        mapsLoaded: 0,
        mapsTotal: 18,
        svgLoaded: 0,
        svgTotal: 36,
        soundsLoaded: 0,
        soundsTotal: 26,
        stageLabel: m.startup_stage_initial(),
    });

    const [gameMode, setGameMode] = useState<GameMode>('COOP_2P');
    const [p1CharId, setP1CharId] = useState<CharacterId>('bambo');
    const [p2CharId, setP2CharId] = useState<CharacterId>('bert');
    const [roomId, setRoomId] = useState<RoomId>('room_01');

    const [options, setOptions] = useState<GameOptionsConfig>(() => {
        try {
            const saved = localStorage.getItem(OPTIONS_STORAGE_KEY);
            const legacyMinimap = localStorage.getItem('boxhead_2play_minimap_v1');
            const fallbackMinimap = legacyMinimap !== null ? legacyMinimap === 'true' : DEFAULT_OPTIONS.minimapEnabled;
            if (saved) {
                const parsed = JSON.parse(saved);
                const normalizedBlastMode: BlastDamageMode =
                    parsed.explosionPlayerDamage === 'OFF' ||
                    parsed.explosionPlayerDamage === 'TEN_PERCENT' ||
                    parsed.explosionPlayerDamage === 'FULL'
                        ? parsed.explosionPlayerDamage
                        : 'TEN_PERCENT';
                const normalizedVolume =
                    typeof parsed.masterVolume === 'number' && Number.isFinite(parsed.masterVolume)
                        ? Math.max(0, Math.min(100, Math.round(parsed.masterVolume)))
                        : DEFAULT_OPTIONS.masterVolume;
                const normalizedAIStrength: AIPartnerStrength =
                    parsed.aiPartnerStrength === 'LV1' ||
                    parsed.aiPartnerStrength === 'LV2' ||
                    parsed.aiPartnerStrength === 'LV3' ||
                    parsed.aiPartnerStrength === 'LV4'
                        ? parsed.aiPartnerStrength
                        : 'LV3';
                const normalizedStartingWave =
                    typeof parsed.startingWave === 'number' && Number.isFinite(parsed.startingWave)
                        ? Math.max(1, Math.min(99, Math.round(parsed.startingWave)))
                        : 1;
                soundFX.setMasterVolume(normalizedVolume / 100);
                return {
                    ...DEFAULT_OPTIONS,
                    minimapEnabled: fallbackMinimap,
                    ...parsed,
                    explosionPlayerDamage: normalizedBlastMode,
                    masterVolume: normalizedVolume,
                    aiPartnerStrength: normalizedAIStrength,
                    startingWave: normalizedStartingWave,
                };
            }
            soundFX.setMasterVolume(DEFAULT_OPTIONS.masterVolume / 100);
            return { ...DEFAULT_OPTIONS, minimapEnabled: fallbackMinimap };
        } catch {
            // ignore
        }
        soundFX.setMasterVolume(DEFAULT_OPTIONS.masterVolume / 100);
        return DEFAULT_OPTIONS;
    });

    const [controls, setControls] = useState<ControlsConfig>(() => {
        try {
            const saved = localStorage.getItem(CONTROLS_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                return {
                    p1: { ...DEFAULT_CONTROLS.p1, ...(parsed.p1 || {}) },
                    p2: { ...DEFAULT_CONTROLS.p2, ...(parsed.p2 || {}) },
                };
            }
        } catch {
            // ignore
        }
        return DEFAULT_CONTROLS;
    });

    const [listeningBind, setListeningBind] = useState<{
        player: 'p1' | 'p2';
        action: keyof PlayerControlsBinding;
    } | null>(null);
    const keyboardStateRef = useRef({
        gameState,
        menuStep,
        lobbySubView,
        isModelStudioOpen,
        isMapViewerOpen,
        isComboModalOpen,
        listeningBind,
    });
    keyboardStateRef.current = {
        gameState,
        menuStep,
        lobbySubView,
        isModelStudioOpen,
        isMapViewerOpen,
        isComboModalOpen,
        listeningBind,
    };

    const [personalStats, setPersonalStats] = useState<PersonalBestStats>(() => statsStorage.getStats());
    const [confirmReset, setConfirmReset] = useState<boolean>(false);
    const isInitialOptionsMountRef = useRef<boolean>(true);
    const previousOptionsRef = useRef<GameOptionsConfig>(options);
    const lastNonZeroVolumeRef = useRef<number>(
        (options.masterVolume ?? 100) > 0 ? (options.masterVolume ?? 100) : 100,
    );
    const startingWave = Math.max(1, Math.min(99, options.startingWave ?? 1));
    const startingWaveDifficultyMultiplier =
        options.difficulty === 'NIGHTMARE'
            ? 1.5
            : options.difficulty === 'HARD'
              ? 1.25
              : options.difficulty === 'EASY'
                ? 0.8
                : 1.0;
    const startingWaveZombieCount = Math.round((15 + startingWave * 8) * startingWaveDifficultyMultiplier);
    const startingWaveDevilCount =
        options.devilsEnabled && startingWave >= 2 ? Math.min(5, Math.floor(startingWave / 2) + 1) : 0;
    const startingWaveHpMultiplier = ((1 + (startingWave - 1) * 0.16) * startingWaveDifficultyMultiplier).toFixed(2);

    const toggleMuteMasterVolume = useCallback(() => {
        setOptions((prev) => {
            const currentVol = prev.masterVolume ?? 100;
            if (currentVol > 0) {
                lastNonZeroVolumeRef.current = currentVol;
                soundFX.setMasterVolume(0);
                notify({
                    id: 'master-volume',
                    kind: 'muted',
                    title: m.toast_muted_title(),
                    description: m.toast_muted_description(),
                });
                return { ...prev, masterVolume: 0 };
            } else {
                const restored = lastNonZeroVolumeRef.current > 0 ? lastNonZeroVolumeRef.current : 100;
                soundFX.setMasterVolume(restored / 100);
                soundFX.playClick();
                notify({
                    id: 'master-volume',
                    kind: 'volume',
                    title: m.toast_volume_restored_title({ volume: restored }),
                    description: m.toast_volume_restored_description(),
                });
                return { ...prev, masterVolume: restored };
            }
        });
    }, [notify]);

    useEffect(() => {
        const didOptionsChange = previousOptionsRef.current !== options;
        previousOptionsRef.current = options;
        const currentVol = options.masterVolume ?? 100;
        if (currentVol > 0) {
            lastNonZeroVolumeRef.current = currentVol;
        }
        soundFX.setMasterVolume(currentVol / 100);
        try {
            localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(options));
        } catch {
            // ignore
        }

        if (isInitialOptionsMountRef.current) {
            isInitialOptionsMountRef.current = false;
            return;
        }

        if (!didOptionsChange) {
            return;
        }

        if (
            menuStep !== 'LOBBY' ||
            (lobbySubView !== 'OPTIONS' &&
                lobbySubView !== 'STARTING_WAVE' &&
                lobbySubView !== 'AI_PARTNER' &&
                lobbySubView !== 'SOUND')
        ) {
            return;
        }

        const notificationTimer = window.setTimeout(() => {
            notify({
                id: 'settings-saved',
                kind: 'success',
                title: m.toast_settings_saved_title(),
                description: m.toast_settings_saved_description(),
            });
        }, 180);

        return () => window.clearTimeout(notificationTimer);
    }, [lobbySubView, menuStep, notify, options]);

    useEffect(() => {
        try {
            localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(controls));
        } catch {
            // ignore
        }
    }, [controls]);

    const [, setRoomsTick] = useState(0);

    useEffect(() => {
        void loadMapsIndex();
        return subscribeRooms(() => setRoomsTick((t) => t + 1));
    }, []);

    useEffect(() => {
        setPersonalStats({ ...statsStorage.getStats() });
        return statsStorage.subscribe(() => {
            setPersonalStats({ ...statsStorage.getStats() });
        });
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const state = keyboardStateRef.current;
            const binding = state.listeningBind;
            if (binding) {
                e.preventDefault();
                e.stopPropagation();
                const rawKey = e.key.toLowerCase();
                soundFX.playClick();
                if (rawKey !== 'escape') {
                    setControls((prev) => ({
                        ...prev,
                        [binding.player]: {
                            ...prev[binding.player],
                            [binding.action]: rawKey,
                        },
                    }));
                }
                setListeningBind(null);
                return;
            }

            if (e.key !== 'Escape' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
            const target = e.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.tagName === 'INPUT')
            ) {
                return;
            }

            e.preventDefault();
            soundFX.playClick();

            if (state.isMapViewerOpen) {
                setIsMapViewerOpen(false);
                return;
            }
            if (state.isModelStudioOpen) {
                setIsModelStudioOpen(false);
                return;
            }
            if (state.isComboModalOpen) {
                setIsComboModalOpen(false);
                return;
            }
            if (state.gameState === 'PAUSED') {
                setGameState('PLAYING');
                return;
            }
            if (state.gameState === 'PLAYING') {
                setGameState('PAUSED');
                return;
            }
            if (state.gameState !== 'TITLE_MENU' || state.menuStep !== 'LOBBY') {
                return;
            }
            if (state.lobbySubView !== 'MAIN') {
                setLobbySubView('MAIN');
                return;
            }
            setMenuStep('MODE_SELECT');
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, []);

    // Global keyboard shortcut ('M' key) to toggle master volume between current volume and 0%
    useEffect(() => {
        const handleGlobalMuteKeyDown = (e: KeyboardEvent) => {
            if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
            if (listeningBind) return;
            const target = e.target as HTMLElement | null;
            if (
                target &&
                (target.tagName === 'TEXTAREA' ||
                    target.tagName === 'SELECT' ||
                    (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range'))
            ) {
                return;
            }
            if (e.key.toLowerCase() === 'm') {
                e.preventDefault();
                toggleMuteMasterVolume();
            }
        };
        window.addEventListener('keydown', handleGlobalMuteKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalMuteKeyDown);
    }, [listeningBind, toggleMuteMasterVolume]);

    // Run Global Startup Preloading once before entering the homepage (MODE_SELECT)
    useEffect(() => {
        const runId = ++startupLoadRunIdRef.current;
        const startTime = performance.now();
        const minTransitionMs = 580;

        let currentModelsLoaded = 0;
        let currentModelsTotal = ALL_BBMODEL_IDS.length;
        let currentMapsLoaded = 0;
        let currentMapsTotal = Math.max(18, ROOMS.length);
        let currentSvgLoaded = 0;
        let currentSvgTotal = 36;
        let currentSoundsLoaded = 0;
        let currentSoundsTotal = 26;
        let allAssetsDone = false;

        const modelsPromise = loadStandaloneBBModelAssets((loaded, total) => {
            if (startupLoadRunIdRef.current !== runId) return;
            currentModelsLoaded = loaded;
            currentModelsTotal = total;
        });

        const mapsPromise = loadAllRooms((loaded, total) => {
            if (startupLoadRunIdRef.current !== runId) return;
            currentMapsLoaded = loaded;
            currentMapsTotal = total;
        });

        const svgPromise = preloadAllSvgEffectsWithProgress((loaded, total) => {
            if (startupLoadRunIdRef.current !== runId) return;
            currentSvgLoaded = loaded;
            currentSvgTotal = total;
        });

        const soundsPromise = soundFX.preloadAllSounds((loaded, total) => {
            if (startupLoadRunIdRef.current !== runId) return;
            currentSoundsLoaded = loaded;
            currentSoundsTotal = total;
        });

        Promise.all([modelsPromise, mapsPromise, svgPromise, soundsPromise]).then(() => {
            if (startupLoadRunIdRef.current !== runId) return;
            allAssetsDone = true;
        });

        const timer = window.setInterval(() => {
            if (startupLoadRunIdRef.current !== runId) {
                window.clearInterval(timer);
                return;
            }
            const elapsed = performance.now() - startTime;
            const timeRatio = Math.min(1, elapsed / minTransitionMs);
            const modelRatio = currentModelsTotal > 0 ? currentModelsLoaded / currentModelsTotal : 1;
            const mapRatio = currentMapsTotal > 0 ? currentMapsLoaded / currentMapsTotal : 1;
            const svgRatio = currentSvgTotal > 0 ? currentSvgLoaded / currentSvgTotal : 1;
            const soundRatio = currentSoundsTotal > 0 ? currentSoundsLoaded / currentSoundsTotal : 1;
            const assetRatio = modelRatio * 0.3 + mapRatio * 0.3 + svgRatio * 0.2 + soundRatio * 0.2;
            const combined = allAssetsDone ? timeRatio : Math.min(0.95, Math.min(timeRatio, assetRatio));
            const pct = Math.min(100, Math.max(8, Math.round(combined * 100)));

            setStartupLoadProgress(pct);
            setStartupLoadInfo({
                modelsLoaded: currentModelsLoaded,
                modelsTotal: currentModelsTotal,
                mapsLoaded: currentMapsLoaded,
                mapsTotal: currentMapsTotal,
                svgLoaded: currentSvgLoaded,
                svgTotal: currentSvgTotal,
                soundsLoaded: currentSoundsLoaded,
                soundsTotal: currentSoundsTotal,
                stageLabel:
                    pct >= 100
                        ? m.startup_stage_complete()
                        : pct >= 75
                          ? m.startup_stage_sounds()
                          : pct >= 52
                            ? m.startup_stage_effects()
                            : pct >= 28
                              ? m.startup_stage_maps()
                              : m.startup_stage_models(),
            });

            if (allAssetsDone && timeRatio >= 1) {
                window.clearInterval(timer);
                setStartupLoadProgress(100);
                window.setTimeout(() => {
                    if (startupLoadRunIdRef.current !== runId) return;
                    setMenuStep('MODE_SELECT');
                }, 120);
            }
        }, 35);

        return () => {
            window.clearInterval(timer);
        };
    }, []);

    const handleSelectMode = (mode: GameMode) => {
        soundFX.playClick();
        setGameMode(mode);
        if (mode === 'DEATHMATCH_2P') {
            setOptions((prev) =>
                prev.explosionPlayerDamage === 'OFF' ? { ...prev, explosionPlayerDamage: 'TEN_PERCENT' } : prev,
            );
        }
        setLobbySubView('MAIN');
        setMenuStep('LOBBY');
    };

    const handleStartGame = () => {
        setIsComboModalOpen(false);
        setGameState('PLAYING');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cycleCharacter = (player: 'P1' | 'P2', dir: 1 | -1) => {
        soundFX.playClick();
        const curId = player === 'P1' ? p1CharId : p2CharId;
        const idx = CHARACTERS.findIndex((c) => c.id === curId);
        const nextIdx = (idx + dir + CHARACTERS.length) % CHARACTERS.length;
        if (player === 'P1') setP1CharId(CHARACTERS[nextIdx].id);
        else setP2CharId(CHARACTERS[nextIdx].id);
    };

    const cycleRoom = (dir: 1 | -1) => {
        soundFX.playClick();
        const idx = ROOMS.findIndex((r) => r.id === roomId);
        const nextIdx = (idx + dir + ROOMS.length) % ROOMS.length;
        setRoomId(ROOMS[nextIdx].id);
    };

    const p1Char = CHARACTERS.find((c) => c.id === p1CharId) || CHARACTERS[0];
    const p2Char = CHARACTERS.find((c) => c.id === p2CharId) || CHARACTERS[1];
    const currentRoomIdx = Math.max(
        0,
        ROOMS.findIndex((r) => r.id === roomId),
    );
    const currentRoom = ROOMS[currentRoomIdx] || ROOMS[0];
    const currentRoomDisplay = getRoomDisplay(currentRoom.id);
    const currentRoomRecord = personalStats.roomRecords[currentRoom.id];

    // Generate an array of health brick IDs for rendering health bars
    const HEALTH_BRICK_IDS = Array.from({ length: 10 }, (_, index) => `health-brick-${index + 1}`);

    return (
        <div
            className="min-h-screen bg-stone-950 text-stone-100 flex flex-col"
            onFocusCapture={(event) => {
                if (event.target instanceof HTMLButtonElement) {
                    event.target.blur();
                }
            }}>
            {/* Top Bar: When playing, hide everything except the game name on the left */}
            <header className="sticky top-0 z-40 flex items-center justify-between gap-8 px-6 py-4 border-b border-stone-800 bg-stone-950/95 backdrop-blur-md">
                <GameButton
                    type="button"
                    onClick={() => {
                        if (menuStep === 'STARTUP_LOADING') return;
                        soundFX.stopAllGameplaySounds();
                        soundFX.playClick();
                        setGameState('TITLE_MENU');
                        setMenuStep('MODE_SELECT');
                        setLobbySubView('MAIN');
                    }}
                    className="text-lg font-extrabold tracking-tight text-white font-display whitespace-nowrap shrink-0">
                    {m.app_title()}
                </GameButton>

                {menuStep !== 'STARTUP_LOADING' && (
                    <div className="flex items-center gap-2.5 shrink-0">
                        {gameState === 'TITLE_MENU' && <LanguageMenu />}

                        <GameButton
                            type="button"
                            onClick={toggleMuteMasterVolume}
                            title={m.toolbar_toggle_mute()}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none font-mono-tabular ${
                                (options.masterVolume ?? 100) === 0
                                    ? 'text-red-300 bg-red-950/70 border-red-700/80 hover:bg-red-900/70'
                                    : 'text-emerald-300 bg-stone-900 border-stone-700 hover:bg-stone-800'
                            }`}>
                            {(options.masterVolume ?? 100) === 0 ? (
                                <VolumeX className="w-3.5 h-3.5 text-red-400" />
                            ) : (
                                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span>
                                {(options.masterVolume ?? 100) === 0
                                    ? m.toolbar_muted()
                                    : m.toolbar_volume({ volume: options.masterVolume ?? 100 })}
                            </span>
                        </GameButton>

                        {gameState === 'TITLE_MENU' && (
                            <>
                                <GameButton
                                    onClick={() => {
                                        soundFX.playClick();
                                        setIsMapViewerOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-300 bg-stone-900 border border-stone-700 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none">
                                    <MapPin className="w-3.5 h-3.5 text-red-400" />
                                    <span>{m.toolbar_map_viewer()}</span>
                                </GameButton>

                                <GameButton
                                    onClick={() => {
                                        soundFX.playClick();
                                        setIsModelStudioOpen(true);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-300 bg-stone-900 border border-stone-700 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none">
                                    <Box className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{m.toolbar_model_studio()}</span>
                                </GameButton>
                            </>
                        )}
                    </div>
                )}
            </header>

            {gameState !== 'TITLE_MENU' ? (
                <main className="flex-1 flex flex-col justify-center">
                    <BrickBattleCanvas
                        gameState={gameState}
                        gameMode={gameMode}
                        difficulty={options.difficulty}
                        options={options}
                        controls={controls}
                        p1CharId={p1CharId}
                        p2CharId={p2CharId}
                        roomId={roomId}
                        minimapEnabled={options.minimapEnabled}
                        isMapViewerOpen={isMapViewerOpen}
                        isComboModalOpen={isComboModalOpen}
                        onToggleMinimap={() =>
                            setOptions((prev) => ({ ...prev, minimapEnabled: !prev.minimapEnabled }))
                        }
                        onOpenMapViewer={() => setIsMapViewerOpen(true)}
                        onOpenComboModal={openComboModal}
                        onCloseComboModal={closeComboModal}
                        onReturnToTitle={() => {
                            soundFX.stopAllGameplaySounds();
                            soundFX.playClick();
                            setIsComboModalOpen(false);
                            setGameState('TITLE_MENU');
                            setMenuStep('LOBBY');
                        }}
                        onGameStateChange={(next) => setGameState(next)}
                    />
                </main>
            ) : menuStep === 'STARTUP_LOADING' ? (
                /* =====================================================================
           PAGE 0: GLOBAL STARTUP LOADING SCREEN (BEFORE HOME PAGE)
           Preloads all 3D .bbmodel models, 18 room maps, and SVG combat effects
           ===================================================================== */
                <main className="flex-1 max-w-280 w-full mx-auto px-4 sm:px-6 py-6 flex flex-col items-center justify-center">
                    <div className="max-w-xl w-full rounded-2xl border-2 border-stone-700 bg-stone-900/95 p-6 sm:p-7 shadow-2xl flex flex-col gap-5">
                        <div className="flex items-center justify-between gap-3 border-b border-stone-800 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-lg bg-red-600 border-b-4 border-red-800 p-1.5 grid grid-cols-2 gap-1 shadow-md shrink-0 animate-pulse">
                                    <span className="rounded-full bg-red-400/90 border border-red-300/60 shadow-inner" />
                                    <span className="rounded-full bg-red-400/90 border border-red-300/60 shadow-inner" />
                                    <span className="rounded-full bg-red-400/90 border border-red-300/60 shadow-inner" />
                                    <span className="rounded-full bg-red-400/90 border border-red-300/60 shadow-inner" />
                                </div>
                                <div>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-amber-400 text-stone-950 uppercase">
                                        {m.startup_badge()}
                                    </span>
                                    <h2 className="text-lg sm:text-xl font-extrabold text-white mt-1 tracking-tight">
                                        {m.startup_title()}
                                    </h2>
                                </div>
                            </div>
                            <div className="text-right font-mono-tabular shrink-0">
                                <span className="text-2xl sm:text-3xl font-black text-amber-400">
                                    {startupLoadProgress}%
                                </span>
                            </div>
                        </div>

                        <div className="rounded-xl border border-stone-700/90 bg-stone-950/90 p-4 flex flex-col gap-4 shadow-inner">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                    <span>{startupLoadInfo.stageLabel}</span>
                                </span>
                            </div>

                            {/* 10-Stud Lego Brick Progress Bar */}
                            <div className="grid grid-cols-10 gap-1.5 p-2 rounded-xl bg-stone-900 border-2 border-stone-800">
                                {Array.from({ length: 10 }).map((_, idx) => {
                                    const threshold = ((idx + 1) / 10) * 100;
                                    const isFilled = startupLoadProgress >= threshold - 4;
                                    const isComplete = startupLoadProgress >= 100;
                                    const brickBg = !isFilled
                                        ? 'bg-stone-800/80 border-stone-700/60'
                                        : isComplete
                                          ? 'bg-emerald-500 border-emerald-700'
                                          : idx < 4
                                            ? 'bg-red-600 border-red-800'
                                            : idx < 7
                                              ? 'bg-amber-500 border-amber-700'
                                              : 'bg-yellow-400 border-yellow-600';
                                    const studBg = !isFilled
                                        ? 'bg-stone-700/60'
                                        : isComplete
                                          ? 'bg-emerald-300'
                                          : idx < 4
                                            ? 'bg-red-400'
                                            : idx < 7
                                              ? 'bg-amber-300'
                                              : 'bg-yellow-200';

                                    return (
                                        <div
                                            key={HEALTH_BRICK_IDS[idx]}
                                            className={`relative h-8 rounded-md border-b-4 transition-all duration-150 flex flex-col items-center justify-start pt-1 ${brickBg} ${
                                                isFilled
                                                    ? 'translate-y-0 opacity-100 shadow-sm'
                                                    : 'translate-y-0.5 opacity-45'
                                            }`}>
                                            <div
                                                className={`w-3.5 h-1.5 rounded-t-sm border-t border-white/40 ${studBg}`}
                                            />
                                            {isFilled && <div className="w-3/4 h-0.5 bg-white/30 rounded-full mt-1" />}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-mono-tabular">
                                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                                    <span>{m.startup_models()}</span>
                                    <span className="font-bold text-amber-400 flex items-center gap-1">
                                        {startupLoadInfo.modelsLoaded}/{startupLoadInfo.modelsTotal}
                                        {startupLoadInfo.modelsLoaded >= startupLoadInfo.modelsTotal && (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        )}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                                    <span>{m.startup_maps()}</span>
                                    <span className="font-bold text-amber-400 flex items-center gap-1">
                                        {startupLoadInfo.mapsLoaded}/{startupLoadInfo.mapsTotal}
                                        {startupLoadInfo.mapsLoaded >= startupLoadInfo.mapsTotal && (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        )}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                                    <span>{m.startup_effects()}</span>
                                    <span className="font-bold text-amber-400 flex items-center gap-1">
                                        {startupLoadInfo.svgLoaded}/{startupLoadInfo.svgTotal}
                                        {startupLoadInfo.svgLoaded >= startupLoadInfo.svgTotal && (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        )}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                                    <span>{m.startup_sounds()}</span>
                                    <span className="font-bold text-amber-400 flex items-center gap-1">
                                        {startupLoadInfo.soundsLoaded}/{startupLoadInfo.soundsTotal}
                                        {startupLoadInfo.soundsLoaded >= startupLoadInfo.soundsTotal && (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                        )}
                                    </span>
                                </div>
                            </div>

                            <p className="text-[11px] text-stone-400 leading-relaxed">{m.startup_cache_hint()}</p>
                        </div>
                    </div>
                </main>
            ) : menuStep === 'MODE_SELECT' ? (
                /* =====================================================================
           PAGE 1: SIMPLIFIED HOME PAGE — MODE SELECTION
           ===================================================================== */
                <main className="flex-1 max-w-295 w-full mx-auto px-6 py-10 flex flex-col justify-center">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* Left Column: Title + 4 Mode Buttons */}
                        <div className="lg:col-span-6 flex flex-col justify-between p-8 rounded-2xl border border-stone-800 bg-stone-900 shadow-2xl space-y-6">
                            <div className="space-y-3">
                                <div className="text-xs font-bold tracking-wider uppercase text-red-500">
                                    {m.mode_eyebrow()}
                                </div>
                                <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none">
                                    {m.mode_title()}
                                </h1>
                                <p className="text-sm text-stone-400">{m.mode_description()}</p>
                            </div>

                            <div className="space-y-3">
                                {[
                                    {
                                        id: 'SOLO' as GameMode,
                                        title: m.mode_solo_title(),
                                        sub: m.mode_solo_description(),
                                        icon: User,
                                    },
                                    {
                                        id: 'COOP_2P' as GameMode,
                                        title: m.mode_coop_title(),
                                        sub: m.mode_coop_description(),
                                        icon: Users,
                                    },
                                    {
                                        id: 'COOP_AI' as GameMode,
                                        title: m.mode_ai_title(),
                                        sub: m.mode_ai_description(),
                                        icon: Bot,
                                    },
                                    {
                                        id: 'DEATHMATCH_2P' as GameMode,
                                        title: m.mode_deathmatch_title(),
                                        sub: m.mode_deathmatch_description(),
                                        icon: Swords,
                                    },
                                ].map((m) => {
                                    const Icon = m.icon;
                                    return (
                                        <GameButton
                                            key={m.id}
                                            onClick={() => handleSelectMode(m.id)}
                                            className="w-full group p-4 rounded-xl border-2 border-stone-800 bg-stone-950 hover:border-red-500 hover:bg-stone-900/90 transition-all flex items-center justify-between gap-4 text-left select-none">
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-lg bg-red-600/15 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:bg-red-600 group-hover:text-white transition-colors shrink-0">
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="text-base font-extrabold text-white group-hover:text-red-400 transition-colors">
                                                        {m.title}
                                                    </div>
                                                    <div className="text-xs text-stone-400 mt-0.5">{m.sub}</div>
                                                </div>
                                            </div>
                                            <Play className="w-4 h-4 text-stone-500 group-hover:text-red-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                                        </GameButton>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Right Column: Live 3D .bbmodel Diorama Poster */}
                        <div className="lg:col-span-6 flex">
                            <BoxheadHeroDioramaArt />
                        </div>
                    </div>
                </main>
            ) : (
                /* =====================================================================
           PAGE 2: CLASSIC BOXHEAD 2PLAY LOBBY (CHARACTERS, MAP, OPTIONS, CONTROLS)
           Modeled directly on the original Boxhead 2Play screenshots!
           ===================================================================== */
                <main className="h-[calc(100dvh-67px)] max-w-280 w-full mx-auto px-6 py-3 flex flex-col justify-center overflow-hidden">
                    <div className="relative h-full min-h-0 max-h-180 rounded-2xl border-2 border-stone-300 bg-[#f6f5f2] text-stone-900 shadow-2xl overflow-hidden p-6 flex flex-col justify-between">
                        {/* Subtle watermark background glow */}
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(220,38,38,0.06),transparent_65%)]" />

                        {/* Top-Left "Back to menu" Tab & Mode Badge */}
                        <div className="relative z-10 flex items-center justify-between gap-4">
                            <GameButton
                                onClick={() => {
                                    soundFX.playClick();
                                    if (lobbySubView !== 'MAIN') {
                                        setLobbySubView('MAIN');
                                        setListeningBind(null);
                                    } else {
                                        setMenuStep('MODE_SELECT');
                                    }
                                }}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-br-xl rounded-tl-lg bg-linear-to-b from-stone-100 to-stone-300 border-2 border-stone-400 text-stone-900 font-bold text-sm shadow-sm hover:from-white hover:to-stone-200 transition-colors select-none">
                                <ArrowLeft className="w-4 h-4" />
                                <span>{lobbySubView !== 'MAIN' ? m.back_to_lobby() : m.back_to_menu()}</span>
                            </GameButton>

                            <div className="text-xs font-extrabold tracking-wide uppercase px-3 py-1.5 rounded-full bg-stone-200 border border-stone-300 text-stone-700">
                                {gameMode === 'SOLO'
                                    ? m.mode_solo_title()
                                    : gameMode === 'COOP_2P'
                                      ? m.mode_coop_title()
                                      : gameMode === 'COOP_AI'
                                        ? m.mode_ai_title()
                                        : m.mode_deathmatch_title()}
                            </div>
                        </div>

                        {lobbySubView === 'MAIN' && (
                            <div className="relative z-10 text-center my-2">
                                <h1 className="text-5xl font-black tracking-tight text-red-600 uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]">
                                    {gameMode === 'DEATHMATCH_2P' ? m.objective_deathmatch() : m.objective_zombies()}
                                </h1>
                                <p className="text-sm font-extrabold text-red-600 mt-1">
                                    {gameMode === 'DEATHMATCH_2P'
                                        ? m.reward_deathmatch({ frags: options.deathmatchFrags })
                                        : m.reward_survival()}
                                </p>
                            </div>
                        )}

                        {/* ===============================================================
                SUBVIEW 1: MAIN LOBBY (Character Selectors + Room Preview Card)
                =============================================================== */}
                        {lobbySubView === 'MAIN' && (
                            <div className="relative z-10 grid grid-cols-12 gap-6 items-center my-1">
                                {/* Left Column: Character Selector Cards (1 & 2) */}
                                <div className="col-span-4 flex flex-col items-center justify-center gap-4">
                                    {/* Player 1 Character Selector */}
                                    <div className="flex items-center gap-3">
                                        <GameButton
                                            type="button"
                                            onClick={() => cycleCharacter('P1', -1)}
                                            aria-label={m.character_previous({ player: 'P1' })}
                                            className="w-9 h-11 flex items-center justify-center rounded-lg bg-white border-2 border-stone-700 text-stone-900 hover:bg-red-50 hover:border-red-600 shadow-md transition-colors font-black text-lg select-none">
                                            ◀
                                        </GameButton>

                                        <div className="relative w-36 h-36 bg-white rounded-lg border-2 border-stone-400 shadow-lg p-2 flex flex-col items-center justify-center">
                                            {/* Top-left number badge "1" */}
                                            <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-white border-2 border-stone-300 shadow flex items-center justify-center font-black text-sm text-stone-900 z-10">
                                                1
                                            </div>

                                            <BoxheadCharacterAvatar character={p1Char} size={108} />

                                            {/* Bottom-right character nameplate */}
                                            <div className="absolute bottom-1 right-1.5 bg-white/95 px-2 py-0.5 rounded text-xs font-black tracking-tight text-stone-900 border border-stone-300 shadow-xs">
                                                {getCharacterDisplay(p1Char.id).name}
                                            </div>
                                        </div>

                                        <GameButton
                                            type="button"
                                            onClick={() => cycleCharacter('P1', 1)}
                                            aria-label={m.character_next({ player: 'P1' })}
                                            className="w-9 h-11 flex items-center justify-center rounded-lg bg-white border-2 border-stone-700 text-stone-900 hover:bg-red-50 hover:border-red-600 shadow-md transition-colors font-black text-lg select-none">
                                            ▶
                                        </GameButton>
                                    </div>

                                    {/* Player 2 Character Selector (shown in 2P Co-op, 1P+AI, and 2P Deathmatch) */}
                                    {gameMode !== 'SOLO' && (
                                        <div className="flex items-center gap-3">
                                            <GameButton
                                                type="button"
                                                onClick={() => cycleCharacter('P2', -1)}
                                                aria-label={m.character_previous({ player: 'P2' })}
                                                className="w-9 h-11 flex items-center justify-center rounded-lg bg-white border-2 border-stone-700 text-stone-900 hover:bg-red-50 hover:border-red-600 shadow-md transition-colors font-black text-lg select-none">
                                                ◀
                                            </GameButton>

                                            <div className="relative w-36 h-36 bg-white rounded-lg border-2 border-stone-400 shadow-lg p-2 flex flex-col items-center justify-center">
                                                {/* Top-left number badge "2" */}
                                                <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-white border-2 border-stone-300 shadow flex items-center justify-center font-black text-sm text-stone-900 z-10">
                                                    {gameMode === 'COOP_AI' ? 'AI' : '2'}
                                                </div>

                                                <BoxheadCharacterAvatar character={p2Char} size={108} />

                                                {/* Bottom-right character nameplate */}
                                                <div className="absolute bottom-1 right-1.5 bg-white/95 px-2 py-0.5 rounded text-xs font-black tracking-tight text-stone-900 border border-stone-300 shadow-xs">
                                                    {getCharacterDisplay(p2Char.id).name}
                                                </div>
                                            </div>

                                            <GameButton
                                                type="button"
                                                onClick={() => cycleCharacter('P2', 1)}
                                                aria-label={m.character_next({ player: 'P2' })}
                                                className="w-9 h-11 flex items-center justify-center rounded-lg bg-white border-2 border-stone-700 text-stone-900 hover:bg-red-50 hover:border-red-600 shadow-md transition-colors font-black text-lg select-none">
                                                ▶
                                            </GameButton>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Large Framed Level / Map Selector */}
                                <div className="col-span-8 flex flex-col items-center">
                                    {/* View Highscores link right above map frame */}
                                    <GameButton
                                        type="button"
                                        onClick={() => {
                                            soundFX.playClick();
                                            setLobbySubView('HIGHSCORES');
                                        }}
                                        className="mb-1.5 text-base font-extrabold text-stone-900 hover:text-red-600 transition-colors cursor-pointer select-none">
                                        {m.view_highscores()}
                                    </GameButton>

                                    <div className="w-full flex items-center justify-center gap-3 sm:gap-4">
                                        {/* Left Map Cycle Arrow */}
                                        <GameButton
                                            type="button"
                                            onClick={() => cycleRoom(-1)}
                                            aria-label={m.room_previous()}
                                            className="w-10 h-16 flex items-center justify-center rounded-lg bg-white border-2 border-stone-700 text-stone-900 hover:bg-red-50 hover:border-red-600 shadow-md transition-colors font-black text-2xl shrink-0 select-none">
                                            ◀
                                        </GameButton>

                                        {/* Framed Room Preview Box (Click to play level!) */}
                                        <GameButton
                                            type="button"
                                            onClick={handleStartGame}
                                            title={m.room_start_title()}
                                            className="relative flex-1 max-w-140 bg-white rounded-lg border-4 border-white shadow-[0_6px_20px_rgba(0,0,0,0.22)] ring-1 ring-stone-300 overflow-hidden cursor-pointer group">
                                            {/* Top-left room index badge e.g. 1/5 */}
                                            <div className="absolute top-0 left-0 z-10 bg-white px-2.5 py-1 rounded-br-lg border-r border-b border-stone-300 text-xs font-bold text-stone-800">
                                                {currentRoomIdx + 1}/{ROOMS.length}
                                            </div>

                                            {/* Best record badge on top-right if any */}
                                            {currentRoomRecord &&
                                                (currentRoomRecord.bestCombo > 0 ||
                                                    currentRoomRecord.bestSurvivalSeconds > 0) && (
                                                    <div className="absolute top-0 right-0 z-10 bg-white/95 px-2.5 py-1 rounded-bl-lg border-l border-b border-stone-300 text-[11px] font-bold text-red-600">
                                                        {m.room_best_combo({
                                                            combo: currentRoomRecord.bestCombo,
                                                        })}{' '}
                                                        · {formatSurvivalTime(currentRoomRecord.bestSurvivalSeconds)}
                                                    </div>
                                                )}

                                            {/* Room Preview SVG */}
                                            <div className="overflow-hidden border border-stone-500 group-hover:brightness-105 transition-all">
                                                <BoxheadRoomPreviewSvg room={currentRoom} large />
                                            </div>

                                            {/* Bottom-Center Trapezoid Room Name Tab (Authentic Boxhead "BOXY" style) */}
                                            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-white px-9 py-1.5 rounded-t-xl border-t border-x border-stone-400 shadow-xs text-center">
                                                <div className="text-xl sm:text-2xl font-black tracking-tight text-stone-950 uppercase leading-none">
                                                    {currentRoomDisplay.name}
                                                </div>
                                            </div>
                                        </GameButton>

                                        {/* Right Map Cycle Arrow */}
                                        <GameButton
                                            type="button"
                                            onClick={() => cycleRoom(1)}
                                            aria-label={m.room_next()}
                                            className="w-10 h-16 flex items-center justify-center rounded-lg bg-white border-2 border-stone-700 text-stone-900 hover:bg-red-50 hover:border-red-600 shadow-md transition-colors font-black text-2xl shrink-0 select-none">
                                            ▶
                                        </GameButton>
                                    </div>

                                    {/* CLICK TO PLAY LEVEL */}
                                    <GameButton
                                        type="button"
                                        onClick={handleStartGame}
                                        className="mt-3 px-8 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-base sm:text-lg tracking-wide uppercase shadow-lg transition-transform active:scale-95 cursor-pointer select-none">
                                        {gameMode === 'DEATHMATCH_2P'
                                            ? m.play_deathmatch()
                                            : m.play_survival({ wave: options.startingWave ?? 1 })}
                                    </GameButton>
                                </div>
                            </div>
                        )}

                        {lobbySubView === 'STARTING_WAVE' && gameMode !== 'DEATHMATCH_2P' && (
                            <div className="relative z-10 max-w-220 w-full mx-auto bg-white/95 rounded-2xl border-2 border-stone-300 shadow-xl p-5 space-y-3 my-1">
                                <div className="flex items-center gap-3 border-b border-stone-200 pb-4">
                                    <div className="flex size-11 items-center justify-center rounded-xl border border-amber-400 bg-amber-100 text-amber-700">
                                        <Flame className="size-5 text-red-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black tracking-tight text-stone-900">
                                            {m.starting_wave_title()}
                                        </h2>
                                        <p className="text-xs text-stone-600">{m.starting_wave_description()}</p>
                                    </div>
                                </div>

                                <GameNumberField
                                    id="starting-wave"
                                    label={m.starting_wave_label()}
                                    labelClassName="text-base text-stone-900"
                                    value={startingWave}
                                    min={1}
                                    max={99}
                                    onValueChange={(value) => {
                                        setOptions((previous) => ({
                                            ...previous,
                                            startingWave: Math.max(1, Math.min(99, Math.round(value))),
                                        }));
                                    }}
                                    className="justify-between"
                                />

                                <div>
                                    <p className="mb-2 text-xs font-bold text-stone-600">
                                        {m.starting_wave_quick_select()}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {[1, 3, 5, 8, 10, 15, 20, 30, 50].map((preset) => (
                                            <GameButton
                                                key={preset}
                                                type="button"
                                                onClick={() => {
                                                    soundFX.playClick();
                                                    setOptions((previous) => ({ ...previous, startingWave: preset }));
                                                }}
                                                className={`rounded-lg border-2 px-4 py-2 font-mono-tabular text-xs font-black transition-colors ${
                                                    startingWave === preset
                                                        ? 'border-amber-500 bg-amber-300 text-stone-950 shadow-inner'
                                                        : 'border-stone-200 bg-white text-stone-800 hover:border-amber-400 hover:bg-amber-50'
                                                }`}>
                                                {m.starting_wave_value({ wave: preset })}
                                            </GameButton>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                                    <div>
                                        <p className="text-[10px] font-bold text-stone-500">
                                            {m.starting_wave_zombies()}
                                        </p>
                                        <p className="mt-1 font-mono-tabular text-lg font-black text-stone-900">
                                            {startingWaveZombieCount}
                                        </p>
                                    </div>
                                    <div className="border-x border-stone-200">
                                        <p className="text-[10px] font-bold text-stone-500">
                                            {m.starting_wave_devils()}
                                        </p>
                                        <p className="mt-1 font-mono-tabular text-lg font-black text-red-600">
                                            {startingWaveDevilCount}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-stone-500">
                                            {m.starting_wave_enemy_health()}
                                        </p>
                                        <p className="mt-1 font-mono-tabular text-lg font-black text-amber-600">
                                            {startingWaveHpMultiplier}x
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ===============================================================
                SUBVIEW 2: OPTIONS (Matches original Boxhead Options screenshot!)
                =============================================================== */}
                        {lobbySubView === 'OPTIONS' && (
                            <div className="relative z-10 max-w-220 w-full mx-auto bg-white/95 rounded-2xl border-2 border-stone-300 shadow-xl p-5 space-y-3 my-1">
                                {/* 1. Difficulty (Hidden in 2P Deathmatch mode) */}
                                {gameMode !== 'DEATHMATCH_2P' && (
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="w-40 text-base sm:text-lg font-extrabold text-stone-900">
                                                {m.options_difficulty()}:
                                            </span>
                                            <div className="flex flex-wrap items-center gap-2.5">
                                                {(
                                                    [
                                                        { id: 'EASY', label: m.difficulty_easy() },
                                                        { id: 'NORMAL', label: m.difficulty_normal() },
                                                        { id: 'HARD', label: m.difficulty_hard() },
                                                        { id: 'NIGHTMARE', label: m.difficulty_nightmare() },
                                                    ] as { id: Difficulty; label: string }[]
                                                ).map((d) => {
                                                    const active = options.difficulty === d.id;
                                                    return (
                                                        <GameButton
                                                            key={d.id}
                                                            type="button"
                                                            onClick={() => {
                                                                soundFX.playClick();
                                                                setOptions((prev) => ({ ...prev, difficulty: d.id }));
                                                            }}
                                                            className={`px-5 py-1.5 rounded-full text-xs sm:text-sm font-black tracking-wide border-2 transition-all select-none ${
                                                                active
                                                                    ? 'bg-[#f4a2a2] border-red-400 text-stone-950 shadow-inner'
                                                                    : 'bg-white border-stone-200 text-stone-800 hover:border-stone-400'
                                                            }`}>
                                                            {d.label}
                                                        </GameButton>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <p className="text-xs italic text-stone-600 pl-1">{m.difficulty_hint()}</p>
                                    </div>
                                )}

                                {/* 2. Object collision */}
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="w-40 text-base sm:text-lg font-extrabold text-stone-900">
                                            {m.options_collision()}:
                                        </span>
                                        <div className="flex items-center gap-2.5">
                                            {[
                                                { val: false, label: m.toggle_off() },
                                                { val: true, label: m.toggle_on() },
                                            ].map((item) => {
                                                const active = options.objectCollision === item.val;
                                                return (
                                                    <GameButton
                                                        key={item.label}
                                                        type="button"
                                                        onClick={() => {
                                                            soundFX.playClick();
                                                            setOptions((prev) => ({
                                                                ...prev,
                                                                objectCollision: item.val,
                                                            }));
                                                        }}
                                                        className={`w-32 py-1.5 rounded-full text-xs sm:text-sm font-black border-2 transition-all select-none ${
                                                            active
                                                                ? 'bg-[#f4a2a2] border-red-400 text-stone-950 shadow-inner'
                                                                : 'bg-white border-stone-200 text-stone-800 hover:border-stone-400'
                                                        }`}>
                                                        {item.label}
                                                    </GameButton>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <p className="text-xs italic text-stone-600 pl-1">{m.collision_hint()}</p>
                                </div>

                                {/* 3. Devils */}
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="w-40 text-base sm:text-lg font-extrabold text-stone-900">
                                            {m.options_devils()}:
                                        </span>
                                        <div className="flex items-center gap-2.5">
                                            {[
                                                { val: false, label: m.toggle_off() },
                                                { val: true, label: m.toggle_on() },
                                            ].map((item) => {
                                                const active = options.devilsEnabled === item.val;
                                                return (
                                                    <GameButton
                                                        key={item.label}
                                                        type="button"
                                                        onClick={() => {
                                                            soundFX.playClick();
                                                            setOptions((prev) => ({
                                                                ...prev,
                                                                devilsEnabled: item.val,
                                                            }));
                                                        }}
                                                        className={`w-32 py-1.5 rounded-full text-xs sm:text-sm font-black border-2 transition-all select-none ${
                                                            active
                                                                ? 'bg-[#f4a2a2] border-red-400 text-stone-950 shadow-inner'
                                                                : 'bg-white border-stone-200 text-stone-800 hover:border-stone-400'
                                                        }`}>
                                                        {item.label}
                                                    </GameButton>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <p className="text-xs italic text-stone-600 pl-1">{m.devils_hint()}</p>
                                </div>

                                {/* 4. Friendly Fire (Shown ONLY in 2P Co-op and 1P+AI Co-op modes) */}
                                {(gameMode === 'COOP_2P' || gameMode === 'COOP_AI') && (
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="w-40 text-base sm:text-lg font-extrabold text-stone-900">
                                                {m.options_friendly_fire()}:
                                            </span>
                                            <div className="flex items-center gap-2.5">
                                                {[
                                                    { val: false, label: m.toggle_off() },
                                                    { val: true, label: m.toggle_on() },
                                                ].map((item) => {
                                                    const active = options.friendlyFire === item.val;
                                                    return (
                                                        <GameButton
                                                            key={item.label}
                                                            type="button"
                                                            onClick={() => {
                                                                soundFX.playClick();
                                                                setOptions((prev) => ({
                                                                    ...prev,
                                                                    friendlyFire: item.val,
                                                                }));
                                                            }}
                                                            className={`w-32 py-1.5 rounded-full text-xs sm:text-sm font-black border-2 transition-all select-none ${
                                                                active
                                                                    ? 'bg-[#f4a2a2] border-red-400 text-stone-950 shadow-inner'
                                                                    : 'bg-white border-stone-200 text-stone-800 hover:border-stone-400'
                                                            }`}>
                                                            {item.label}
                                                        </GameButton>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <p className="text-xs italic text-stone-600 pl-1">{m.friendly_fire_hint()}</p>
                                    </div>
                                )}

                                {/* 4b. Explosion Damage to Players */}
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="w-40 text-base sm:text-lg font-extrabold text-stone-900">
                                            {m.options_blast_damage()}:
                                        </span>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            {(
                                                [
                                                    { val: 'OFF', label: m.toggle_off() },
                                                    { val: 'TEN_PERCENT', label: '10%' },
                                                    { val: 'FULL', label: m.toggle_on() },
                                                ] as { val: BlastDamageMode; label: string }[]
                                            ).map((item) => {
                                                const isLockedInDeathmatch =
                                                    gameMode === 'DEATHMATCH_2P' && item.val === 'OFF';
                                                const rawVal = options.explosionPlayerDamage || 'TEN_PERCENT';
                                                const currentVal =
                                                    gameMode === 'DEATHMATCH_2P' && rawVal === 'OFF'
                                                        ? 'TEN_PERCENT'
                                                        : rawVal;
                                                const active = currentVal === item.val;
                                                return (
                                                    <GameButton
                                                        key={item.val}
                                                        type="button"
                                                        disabled={isLockedInDeathmatch}
                                                        title={
                                                            isLockedInDeathmatch
                                                                ? m.blast_damage_deathmatch()
                                                                : undefined
                                                        }
                                                        onClick={() => {
                                                            if (isLockedInDeathmatch) return;
                                                            soundFX.playClick();
                                                            setOptions((prev) => ({
                                                                ...prev,
                                                                explosionPlayerDamage: item.val,
                                                            }));
                                                        }}
                                                        className={`w-32 py-1.5 rounded-full text-xs sm:text-sm font-black border-2 transition-all select-none ${
                                                            isLockedInDeathmatch
                                                                ? 'bg-stone-100 border-stone-200 text-stone-400 cursor-not-allowed opacity-60 line-through'
                                                                : active
                                                                  ? 'bg-[#f4a2a2] border-red-400 text-stone-950 shadow-inner'
                                                                  : 'bg-white border-stone-200 text-stone-800 hover:border-stone-400'
                                                        }`}>
                                                        {isLockedInDeathmatch
                                                            ? m.blast_damage_locked_off()
                                                            : item.label}
                                                    </GameButton>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <p className="text-xs italic text-stone-600 pl-1">
                                        {gameMode === 'DEATHMATCH_2P'
                                            ? m.blast_damage_deathmatch_hint()
                                            : m.blast_damage_hint()}
                                    </p>
                                </div>

                                {/* 5. Game speed */}
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="w-40 text-base sm:text-lg font-extrabold text-stone-900">
                                            {m.options_game_speed()}:
                                        </span>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            {(
                                                [
                                                    { id: 'SLOW', label: m.options_slow() },
                                                    { id: 'NORMAL', label: m.options_normal() },
                                                    { id: 'FAST', label: m.options_fast() },
                                                ] as { id: GameSpeed; label: string }[]
                                            ).map((sp) => {
                                                const active = options.gameSpeed === sp.id;
                                                return (
                                                    <GameButton
                                                        key={sp.id}
                                                        type="button"
                                                        onClick={() => {
                                                            soundFX.playClick();
                                                            setOptions((prev) => ({ ...prev, gameSpeed: sp.id }));
                                                        }}
                                                        className={`w-32 py-1.5 rounded-full text-xs sm:text-sm font-black border-2 transition-all select-none ${
                                                            active
                                                                ? 'bg-[#f4a2a2] border-red-400 text-stone-950 shadow-inner'
                                                                : 'bg-white border-stone-200 text-stone-800 hover:border-stone-400'
                                                        }`}>
                                                        {sp.label}
                                                    </GameButton>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <p className="text-xs italic text-stone-600 pl-1">{m.options_game_speed_hint()}</p>
                                </div>

                                {/* 6. Number of games (Shown ONLY in 2P Deathmatch mode) */}
                                {gameMode === 'DEATHMATCH_2P' && (
                                    <div className="space-y-1.5">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="w-40 text-base sm:text-lg font-extrabold text-stone-900">
                                                {m.options_deathmatch_goal()}:
                                            </span>
                                            <div className="flex flex-wrap items-center gap-2.5">
                                                {([5, 10, 20, 50] as DeathmatchFragsGoal[]).map((goal) => {
                                                    const active = options.deathmatchFrags === goal;
                                                    return (
                                                        <GameButton
                                                            key={goal}
                                                            type="button"
                                                            onClick={() => {
                                                                soundFX.playClick();
                                                                setOptions((prev) => ({
                                                                    ...prev,
                                                                    deathmatchFrags: goal,
                                                                }));
                                                            }}
                                                            className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-black border-2 transition-all select-none ${
                                                                active
                                                                    ? 'bg-[#f4a2a2] border-red-400 text-stone-950 shadow-inner'
                                                                    : 'bg-white border-stone-200 text-stone-800 hover:border-stone-400'
                                                            }`}>
                                                            {m.options_first_to({ goal })}
                                                        </GameButton>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <p className="text-xs italic text-stone-600 pl-1">
                                            {m.options_deathmatch_goal_hint()}
                                        </p>
                                    </div>
                                )}

                                {/* 7. Minimap */}
                                <div className="space-y-1.5">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="w-40 text-base sm:text-lg font-extrabold text-stone-900">
                                            {m.options_minimap()}:
                                        </span>
                                        <div className="flex items-center gap-2.5">
                                            {[
                                                { val: false, label: m.toggle_off() },
                                                { val: true, label: m.toggle_on() },
                                            ].map((item) => {
                                                const active = options.minimapEnabled === item.val;
                                                return (
                                                    <GameButton
                                                        key={item.label}
                                                        type="button"
                                                        onClick={() => {
                                                            soundFX.playClick();
                                                            setOptions((prev) => ({
                                                                ...prev,
                                                                minimapEnabled: item.val,
                                                            }));
                                                        }}
                                                        className={`w-32 py-1.5 rounded-full text-xs sm:text-sm font-black border-2 transition-all select-none ${
                                                            active
                                                                ? 'bg-[#f4a2a2] border-red-400 text-stone-950 shadow-inner'
                                                                : 'bg-white border-stone-200 text-stone-800 hover:border-stone-400'
                                                        }`}>
                                                        {item.label}
                                                    </GameButton>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <p className="text-xs italic text-stone-600 pl-1">{m.minimap_hint()}</p>
                                </div>
                            </div>
                        )}

                        {/* ===============================================================
                SUBVIEW: AI_PARTNER (Standalone AI Partner Strength Modal Panel)
                =============================================================== */}
                        {lobbySubView === 'AI_PARTNER' && (
                            <div className="relative z-10 max-w-220 w-full mx-auto bg-white/95 rounded-2xl border-2 border-stone-300 shadow-xl p-5 space-y-3 my-1">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <Bot className="w-5 h-5 text-red-600 shrink-0" />
                                        <div>
                                            <h2 className="text-xl font-black text-stone-900">
                                                {m.ai_partner_title()}
                                            </h2>
                                            <p className="text-xs text-stone-600 mt-0.5">
                                                {m.ai_partner_description()}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 4-Level Strength Selector */}
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="w-40 text-base sm:text-lg font-extrabold text-stone-900">
                                            {m.ai_strength()}:
                                        </span>
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            {(['LV1', 'LV2', 'LV3', 'LV4'] as AIPartnerStrength[]).map((lv) => {
                                                const currentLv = options.aiPartnerStrength || 'LV3';
                                                const active = currentLv === lv;
                                                const display = getAIStrengthDisplay(lv);
                                                return (
                                                    <GameButton
                                                        key={lv}
                                                        type="button"
                                                        onClick={() => {
                                                            soundFX.playClick();
                                                            setOptions((prev) => ({
                                                                ...prev,
                                                                aiPartnerStrength: lv,
                                                            }));
                                                        }}
                                                        className={`px-5 py-2 rounded-full text-xs sm:text-sm font-black tracking-wide border-2 transition-all cursor-pointer select-none ${
                                                            active
                                                                ? 'bg-[#f4a2a2] border-red-400 text-stone-950 shadow-inner'
                                                                : 'bg-white border-stone-200 text-stone-800 hover:border-stone-400'
                                                        }`}>
                                                        {display.label}
                                                    </GameButton>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Detailed Breakdown of All 4 Levels */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {(['LV1', 'LV2', 'LV3', 'LV4'] as AIPartnerStrength[]).map((lv) => {
                                            const currentLv = options.aiPartnerStrength || 'LV3';
                                            const active = currentLv === lv;
                                            const spec = AI_STRENGTH_SPECS[lv];
                                            const display = getAIStrengthDisplay(lv);
                                            const accuracyLabel =
                                                lv === 'LV1'
                                                    ? m.ai_precision_low()
                                                    : lv === 'LV2'
                                                      ? m.ai_precision_medium()
                                                      : lv === 'LV3'
                                                        ? m.ai_precision_high()
                                                        : m.ai_precision_perfect();
                                            return (
                                                <GameButton
                                                    type="button"
                                                    key={lv}
                                                    onClick={() => {
                                                        soundFX.playClick();
                                                        setOptions((prev) => ({
                                                            ...prev,
                                                            aiPartnerStrength: lv,
                                                        }));
                                                    }}
                                                    className={`p-2.5 rounded-xl border-2 transition-all cursor-pointer select-none ${
                                                        active
                                                            ? 'bg-red-50/90 border-red-400 shadow-sm'
                                                            : 'bg-stone-50 border-stone-200 hover:border-stone-300'
                                                    }`}>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-black text-stone-900">
                                                            {display.label}
                                                        </span>
                                                        {active && (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-600 text-white">
                                                                ACTIVE
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-stone-700 font-bold mt-1.5 space-y-0.5">
                                                        <div>
                                                            • {m.ai_detection_distance()}
                                                            <span className="text-red-600 font-mono">
                                                                {spec.senseRadius} px
                                                            </span>
                                                        </div>
                                                        <div>
                                                            • {m.ai_shooting_accuracy()}
                                                            <span className="text-stone-900">{accuracyLabel}</span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-stone-500 mt-1">
                                                        {display.description}
                                                    </p>
                                                </GameButton>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ===============================================================
                SUBVIEW: SOUND (Standalone Master Volume / SFX Modal Panel)
                =============================================================== */}
                        {lobbySubView === 'SOUND' && (
                            <div className="relative z-10 max-w-220 w-full mx-auto bg-white/95 rounded-2xl border-2 border-stone-300 shadow-xl p-5 space-y-3 my-1">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <Volume2 className="w-5 h-5 text-red-600 shrink-0" />
                                        <div>
                                            <h2 className="text-xl font-black text-stone-900">{m.sound_title()}</h2>
                                            <p className="text-xs text-stone-600 mt-0.5">{m.sound_description()}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 py-2">
                                    <div className="flex flex-wrap items-center gap-4">
                                        <span className="w-44 text-base sm:text-lg font-extrabold text-stone-900">
                                            {m.volume_field()}:
                                        </span>
                                        <div className="flex flex-1 min-w-60 max-w-115 items-center gap-4">
                                            <span className="w-12 text-right font-mono-tabular text-base font-black text-stone-900">
                                                {options.masterVolume ?? 100}%
                                            </span>
                                            <GameSlider
                                                value={options.masterVolume ?? 100}
                                                min={0}
                                                max={100}
                                                label={m.sound_volume_label()}
                                                onValueChange={(nextVol) => {
                                                    soundFX.setMasterVolume(nextVol / 100);
                                                    setOptions((prev) => ({
                                                        ...prev,
                                                        masterVolume: nextVol,
                                                    }));
                                                }}
                                                onValueCommitted={() => soundFX.playClick()}
                                                className="flex-1"
                                            />
                                        </div>
                                    </div>

                                    {/* Quick Volume Preset Pills */}
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className="w-44 text-sm font-bold text-stone-600">
                                            {m.sound_presets()}
                                        </span>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {[
                                                { val: 0, label: m.volume_mute() },
                                                { val: 25, label: '25%' },
                                                { val: 50, label: '50%' },
                                                { val: 75, label: '75%' },
                                                { val: 100, label: m.volume_max() },
                                            ].map((preset) => {
                                                const active = (options.masterVolume ?? 100) === preset.val;
                                                return (
                                                    <GameButton
                                                        key={preset.val}
                                                        type="button"
                                                        onClick={() => {
                                                            soundFX.setMasterVolume(preset.val / 100);
                                                            setOptions((prev) => ({
                                                                ...prev,
                                                                masterVolume: preset.val,
                                                            }));
                                                            if (preset.val > 0) {
                                                                soundFX.playClick();
                                                            }
                                                        }}
                                                        className={`px-4 py-1.5 rounded-full text-xs font-black border-2 transition-all cursor-pointer select-none ${
                                                            active
                                                                ? 'bg-[#f4a2a2] border-red-400 text-stone-950 shadow-inner'
                                                                : 'bg-white border-stone-200 text-stone-800 hover:border-stone-400'
                                                        }`}>
                                                        {preset.label}
                                                    </GameButton>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <p className="text-xs italic text-stone-600 pl-1 pt-1">{m.sound_hint()}</p>
                                </div>
                            </div>
                        )}

                        {/* ===============================================================
                SUBVIEW 3: CONTROLS (Interactive Key Mapping for P1 & P2)
                =============================================================== */}
                        {lobbySubView === 'CONTROLS' && (
                            <div className="relative z-10 max-w-220 w-full mx-auto bg-white/95 rounded-2xl border-2 border-stone-300 shadow-xl p-5 space-y-3 my-1">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
                                    <div>
                                        <h2 className="text-xl font-black text-stone-900">{m.controls_title()}</h2>
                                        <p className="text-xs text-stone-600 mt-0.5">{m.controls_description()}</p>
                                    </div>
                                    <GameButton
                                        type="button"
                                        onClick={() => {
                                            soundFX.playClick();
                                            setControls(DEFAULT_CONTROLS);
                                            setListeningBind(null);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-stone-200 hover:bg-stone-300 text-stone-800 transition-colors select-none">
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>{m.controls_reset()}</span>
                                    </GameButton>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {(['p1', 'p2'] as const).map((plKey) => {
                                        const isP1 = plKey === 'p1';
                                        const binds = controls[plKey];
                                        const rows: { key: keyof PlayerControlsBinding; label: string }[] = [
                                            { key: 'up', label: m.control_move_up() },
                                            { key: 'down', label: m.control_move_down() },
                                            { key: 'left', label: m.control_move_left() },
                                            { key: 'right', label: m.control_move_right() },
                                            { key: 'shoot', label: m.control_shoot() },
                                            { key: 'prevWeapon', label: m.control_previous_weapon() },
                                            { key: 'nextWeapon', label: m.control_next_weapon() },
                                        ];
                                        return (
                                            <div
                                                key={plKey}
                                                className="p-4 rounded-xl border-2 border-stone-200 bg-stone-50 space-y-2.5">
                                                <div className="text-sm font-black text-red-600 uppercase border-b border-stone-200 pb-1.5">
                                                    {m.controls_player({ player: isP1 ? '1' : '2' })}
                                                </div>

                                                {rows.map((r) => {
                                                    const isListening =
                                                        listeningBind?.player === plKey &&
                                                        listeningBind?.action === r.key;
                                                    return (
                                                        <div
                                                            key={r.key}
                                                            className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                                                            <span className="font-bold text-stone-700">{r.label}</span>
                                                            <GameButton
                                                                type="button"
                                                                onClick={() => {
                                                                    soundFX.playClick();
                                                                    setListeningBind({ player: plKey, action: r.key });
                                                                }}
                                                                className={`min-w-36.25 px-3 py-1.5 rounded-full font-mono-tabular font-black text-xs border-2 transition-all select-none ${
                                                                    isListening
                                                                        ? 'bg-red-600 border-red-700 text-white animate-pulse'
                                                                        : 'bg-white border-stone-300 text-stone-900 hover:border-red-500'
                                                                }`}>
                                                                {isListening
                                                                    ? m.controls_press_key()
                                                                    : formatKeyLabel(binds[r.key])}
                                                            </GameButton>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ===============================================================
                SUBVIEW 4: HIGHSCORES (Personal Best Records)
                =============================================================== */}
                        {lobbySubView === 'HIGHSCORES' && (
                            <div className="relative z-10 max-w-220 w-full mx-auto bg-white/95 rounded-2xl border-2 border-stone-300 shadow-xl p-5 space-y-3 my-1">
                                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <Trophy className="w-5 h-5 text-amber-500" />
                                        <div>
                                            <h2 className="text-xl font-black text-stone-900">
                                                {m.highscores_title()}
                                            </h2>
                                            <p className="text-xs text-stone-600">{m.highscores_description()}</p>
                                        </div>
                                    </div>

                                    {(personalStats.bestCombo > 0 ||
                                        personalStats.bestSurvivalSeconds > 0 ||
                                        personalStats.bestScore > 0) && (
                                        <div className="flex items-center gap-2">
                                            {confirmReset ? (
                                                <>
                                                    <GameButton
                                                        type="button"
                                                        onClick={() => {
                                                            soundFX.playClick();
                                                            statsStorage.resetStats();
                                                            setConfirmReset(false);
                                                        }}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-500 select-none">
                                                        {m.highscores_confirm_clear()}
                                                    </GameButton>
                                                    <GameButton
                                                        type="button"
                                                        onClick={() => {
                                                            soundFX.playClick();
                                                            setConfirmReset(false);
                                                        }}
                                                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-stone-200 text-stone-700 select-none">
                                                        {m.cancel()}
                                                    </GameButton>
                                                </>
                                            ) : (
                                                <GameButton
                                                    type="button"
                                                    onClick={() => {
                                                        soundFX.playClick();
                                                        setConfirmReset(true);
                                                    }}
                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-stone-200 text-stone-700 hover:bg-stone-300 select-none">
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                    <span>{m.highscores_reset()}</span>
                                                </GameButton>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 font-mono-tabular">
                                    <div className="p-4 rounded-xl border border-stone-200 bg-stone-50">
                                        <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                                            <span>{m.highscores_best_combo()}</span>
                                            <Flame className="w-4 h-4 text-red-500" />
                                        </div>
                                        <div className="text-2xl font-black text-red-600 mt-1">
                                            {personalStats.bestCombo}x
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-stone-200 bg-stone-50">
                                        <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                                            <span>{m.highscores_survival_time()}</span>
                                            <Clock className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div className="text-2xl font-black text-emerald-600 mt-1">
                                            {formatSurvivalTime(personalStats.bestSurvivalSeconds)}
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-stone-200 bg-stone-50">
                                        <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                                            <span>{m.highscores_best_wave()}</span>
                                            <Swords className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <div className="text-2xl font-black text-amber-600 mt-1">
                                            {personalStats.bestWave > 0
                                                ? m.highscores_wave_value({ wave: personalStats.bestWave })
                                                : '—'}
                                        </div>
                                    </div>

                                    <div className="p-4 rounded-xl border border-stone-200 bg-stone-50">
                                        <div className="flex items-center justify-between text-xs font-bold text-stone-500">
                                            <span>{m.highscores_high_score()}</span>
                                            <Trophy className="w-4 h-4 text-sky-600" />
                                        </div>
                                        <div className="text-2xl font-black text-stone-900 mt-1">
                                            {personalStats.bestScore.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bottom Classic Pill Buttons: OPTIONS, CONTROLS, AI PARTNER (in COOP_AI), & MASTER VOLUME */}
                        <div className="relative z-10 flex flex-wrap items-center justify-center gap-3.5 pt-2">
                            {lobbySubView !== 'MAIN' && (
                                <GameButton
                                    type="button"
                                    onClick={() => {
                                        soundFX.playClick();
                                        setLobbySubView('MAIN');
                                        setListeningBind(null);
                                    }}
                                    className="px-7 py-2.5 rounded-full bg-white border-2 border-stone-300 shadow-md text-sm font-black tracking-wide text-stone-900 hover:border-red-500 transition-all select-none">
                                    {m.back_to_level_select()}
                                </GameButton>
                            )}

                            {gameMode !== 'DEATHMATCH_2P' && lobbySubView !== 'STARTING_WAVE' && (
                                <GameButton
                                    type="button"
                                    onClick={() => {
                                        soundFX.playClick();
                                        setLobbySubView('STARTING_WAVE');
                                        setListeningBind(null);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-full border-2 border-amber-500 bg-stone-950 px-5 py-2 text-sm font-black tracking-wide text-amber-300 shadow-md transition-all hover:border-amber-300 hover:bg-stone-900 select-none">
                                    <Flame className="size-4 text-red-500" />
                                    <span>{m.starting_wave_menu()}</span>
                                    <span className="rounded-full bg-amber-400 px-2 py-0.5 font-mono-tabular text-xs text-stone-950">
                                        {m.starting_wave_value({ wave: startingWave })}
                                    </span>
                                </GameButton>
                            )}

                            {lobbySubView !== 'OPTIONS' && (
                                <GameButton
                                    type="button"
                                    onClick={() => {
                                        soundFX.playClick();
                                        setLobbySubView('OPTIONS');
                                        setListeningBind(null);
                                    }}
                                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full border-2 shadow-md text-sm font-black tracking-wide bg-white border-stone-300 text-stone-900 hover:border-stone-500 transition-all select-none">
                                    <Settings className="w-4 h-4" />
                                    <span>{m.options_menu()}</span>
                                </GameButton>
                            )}

                            {gameMode === 'COOP_AI' && lobbySubView !== 'AI_PARTNER' && (
                                <GameButton
                                    type="button"
                                    onClick={() => {
                                        soundFX.playClick();
                                        setLobbySubView('AI_PARTNER');
                                        setListeningBind(null);
                                    }}
                                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full border-2 shadow-md text-sm font-black tracking-wide bg-white border-stone-300 text-stone-900 hover:border-stone-500 transition-all select-none">
                                    <Bot className="w-4 h-4" />
                                    <span>{m.ai_partner_menu({ level: options.aiPartnerStrength || 'LV3' })}</span>
                                </GameButton>
                            )}

                            {lobbySubView !== 'SOUND' && (
                                <GameButton
                                    type="button"
                                    onClick={() => {
                                        soundFX.playClick();
                                        setLobbySubView('SOUND');
                                        setListeningBind(null);
                                    }}
                                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full border-2 shadow-md text-sm font-black tracking-wide bg-white border-stone-300 text-stone-900 hover:border-stone-500 transition-all select-none">
                                    <Volume2 className="w-4 h-4" />
                                    <span>{m.volume_menu()}</span>
                                </GameButton>
                            )}

                            {lobbySubView !== 'CONTROLS' && (
                                <GameButton
                                    type="button"
                                    onClick={() => {
                                        soundFX.playClick();
                                        setLobbySubView('CONTROLS');
                                        setListeningBind(null);
                                    }}
                                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full border-2 shadow-md text-sm font-black tracking-wide bg-white border-stone-300 text-stone-900 hover:border-stone-500 transition-all select-none">
                                    <Keyboard className="w-4 h-4" />
                                    <span>{m.controls_menu()}</span>
                                </GameButton>
                            )}
                        </div>
                    </div>
                </main>
            )}

            <ModelStudioModal isOpen={isModelStudioOpen} onClose={() => setIsModelStudioOpen(false)} />

            <MapViewerModal
                isOpen={isMapViewerOpen}
                selectedRoomId={roomId}
                onSelectRoom={(id) => setRoomId(id)}
                onClose={() => setIsMapViewerOpen(false)}
            />
        </div>
    );
}
