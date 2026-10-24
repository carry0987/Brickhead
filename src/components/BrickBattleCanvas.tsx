import type { FC } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadMatchBBModels } from '@/data/bbmodelCatalog';
import { COMBO_MILESTONES } from '@/data/comboMilestones';
import { CANVAS_HEIGHT, CANVAS_WIDTH, loadRoomById, ROOMS } from '@/data/gameCatalog';
import { GAMEPLAY_TIPS, WORLD_CAMERA_ZOOM } from '@/data/gameplayTips';
import { WEAPON_MAP, WEAPONS } from '@/data/weaponCatalog';
import { computeAIPlayerDecision } from '@/engine/ai/aiPartnerDecision';
import { spawnEnemyFromNode } from '@/engine/ai/enemySpawner';
import { updateEnemiesAIAndCombat } from '@/engine/ai/enemySystem';
import type { BattleEngineState, HudState, LoadingAssetsInfo } from '@/engine/battleTypes';
import type { CombatContext } from '@/engine/combat/combatContext';
import { updatePlacedObjects } from '@/engine/combat/placedObjectSystem';
import { updateBulletsAndGrenades } from '@/engine/combat/projectileSystem';
import { fireWeapon } from '@/engine/combat/weaponFireSystem';
import { applyMilestoneToPlayer, syncWeaponState } from '@/engine/combat/weaponProgression';
import {
    initRoomFlowField,
    resolveSafeRedBoxPosition,
    updateFlowField,
} from '@/engine/pathfinding/flowFieldPathfinding';
import { createPlayerEntity } from '@/engine/player/createPlayerEntity';
import { PLACEABLE_GRID_TUNING, PLACEABLE_SPECS } from '@/engine/tuning/placeableTuning';
import {
    PICKUP_TUNING,
    PLAYER_DEFAULTS,
    PLAYER_MOVEMENT_TUNING,
    PLAYER_REVIVE_TUNING,
} from '@/engine/tuning/playerTuning';
import { getWaveSpawnIntervalMs, WAVE_TUNING } from '@/engine/tuning/waveTuning';
import { WEAPON_PERK_TUNING } from '@/engine/tuning/weaponPerkTuning';
import { buildWaveEnemyQueue } from '@/engine/waves/buildWaveEnemyQueue';
import { renderBattleCanvasFrame } from '@/engine/worldViewportRenderer';
import { getCharacterDisplay, getComboMilestoneDisplay, getRoomDisplay, getWeaponDisplay } from '@/i18n/catalogI18n';
import * as m from '@/paraglide/messages';
import type {
    CharacterId,
    ControlsConfig,
    Difficulty,
    EnemyKind,
    GameMode,
    GameOptionsConfig,
    GameState,
    PlayerEntity,
    RoomId,
    WeaponId,
} from '@/types/game';
import { circleRectCollide, clamp, dist, snapAngleTo8Dir } from '@/utils/battleGeometry';
import { addBannerToEngine, initFloorBitmapOnCanvas, stampParticleOnFloorCanvas } from '@/utils/floorDecalRenderer';
import { renderBattleMinimaps } from '@/utils/minimapRenderer';
import { soundFX } from '@/utils/sound';
import { statsStorage, weaponStateStorage } from '@/utils/statsStorage';
import { preloadAllSvgEffectsWithProgress, preloadExplosionSprites } from '@/utils/svgEffectRenderer';
import { BattlePresentation } from './battle/BattlePresentation';

interface BrickBattleCanvasProps {
    gameState: GameState;
    gameMode: GameMode;
    difficulty: Difficulty;
    options?: GameOptionsConfig;
    controls?: ControlsConfig;
    p1CharId: CharacterId;
    p2CharId: CharacterId;
    roomId: RoomId;
    minimapEnabled?: boolean;
    isMapViewerOpen?: boolean;
    onToggleMinimap?: () => void;
    onOpenMapViewer?: () => void;
    onReturnToTitle: () => void;
    onGameStateChange: (nextState: GameState) => void;
}

export const BrickBattleCanvas: FC<BrickBattleCanvasProps> = ({
    gameState,
    gameMode,
    difficulty,
    options,
    controls,
    p1CharId,
    p2CharId,
    roomId,
    minimapEnabled = true,
    isMapViewerOpen = false,
    onToggleMinimap,
    onReturnToTitle,
    onGameStateChange,
}) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const leftMinimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const rightMinimapCanvasRef = useRef<HTMLCanvasElement | null>(null);
    // Offscreen Persistent World Floor Bitmap (Flash BitmapData technique for zero-cost blood/scorch decals!)
    const floorBufferRef = useRef<HTMLCanvasElement | null>(null);

    const [isComboModalOpen, setIsComboModalOpen] = useState(false);
    const [useMouseAim, setUseMouseAim] = useState(false);
    // In 2P Deathmatch mode, allows swapping Left & Right split-screen order via bottom arrow button outside the canvas
    const [isSplitSwapped, setIsSplitSwapped] = useState(false);

    // All assets (models, maps, SVG effects, sounds) are preloaded in Global Startup Loading, so battle starts READY immediately
    const [loadingPhase, setLoadingPhase] = useState<'LOADING' | 'FADING_OUT' | 'READY'>('READY');
    const loadingPhaseRef = useRef<'LOADING' | 'FADING_OUT' | 'READY'>('READY');
    const bootRunIdRef = useRef(0);
    const [loadingProgress] = useState(100);
    const [loadingAssetsInfo] = useState<LoadingAssetsInfo>({
        soundsLoaded: 26,
        soundsTotal: 26,
        modelsLoaded: 18,
        modelsTotal: 18,
        effectsLoaded: 36,
        effectsTotal: 36,
        mapReady: true,
        stageLabel: m.battle_assets_ready(),
    });
    const [activeTipIdx, setActiveTipIdx] = useState(() => Math.floor(Math.random() * GAMEPLAY_TIPS.length));

    const effectiveDifficulty = options?.difficulty ?? difficulty;
    const objectCollision = options?.objectCollision ?? true;
    const devilsEnabled = options?.devilsEnabled ?? true;
    const friendlyFire = options?.friendlyFire ?? false;
    const rawExplosionPlayerDamage = options?.explosionPlayerDamage ?? 'TEN_PERCENT';
    const explosionPlayerDamage =
        gameMode === 'DEATHMATCH_2P' && rawExplosionPlayerDamage === 'OFF' ? 'TEN_PERCENT' : rawExplosionPlayerDamage;
    const gameSpeedMult = options?.gameSpeed === 'SLOW' ? 0.5 : options?.gameSpeed === 'FAST' ? 2.0 : 1.0;
    const deathmatchFragsGoal = options?.deathmatchFrags ?? 10;
    const aiPartnerStrength = options?.aiPartnerStrength ?? 'LV3';
    const startingWave =
        gameMode === 'DEATHMATCH_2P' ? 1 : Math.max(1, Math.min(99, Math.round(options?.startingWave ?? 1)));

    const p1Binds = controls?.p1 ?? {
        up: 'w',
        down: 's',
        left: 'a',
        right: 'd',
        shoot: ' ',
        prevWeapon: 'q',
        nextWeapon: 'e',
    };
    const p2Binds = controls?.p2 ?? {
        up: 'arrowup',
        down: 'arrowdown',
        left: 'arrowleft',
        right: 'arrowright',
        shoot: '/',
        prevWeapon: ',',
        nextWeapon: '.',
    };

    const room = ROOMS.find((r) => r.id === roomId) || ROOMS[0];
    const roomDisplay = getRoomDisplay(room.id);
    const worldW = room.worldWidth || 721;
    const worldH = room.worldHeight || 801;
    const rawBoundsX = room.bounds?.x ?? 16;
    const rawBoundsY = room.bounds?.y ?? 103.3;
    const rawBoundsW = room.bounds?.w ?? 704;
    const rawBoundsH = room.bounds?.h ?? 544;
    const roomBounds = useMemo(
        () => ({ x: rawBoundsX, y: rawBoundsY, w: rawBoundsW, h: rawBoundsH }),
        [rawBoundsX, rawBoundsY, rawBoundsW, rawBoundsH],
    );
    const activeCameraZoom = Math.max(
        WORLD_CAMERA_ZOOM,
        CANVAS_WIDTH / Math.max(320, roomBounds.w),
        CANVAS_HEIGHT / Math.max(240, roomBounds.h),
    );

    const diffMult =
        effectiveDifficulty === 'NIGHTMARE'
            ? 1.5
            : effectiveDifficulty === 'HARD'
              ? 1.25
              : effectiveDifficulty === 'EASY'
                ? 0.8
                : 1.0;

    const engineRef = useRef<BattleEngineState>({
        wave: 1,
        spawnQueue: [],
        lastSpawnTime: 0,
        spawnIntervalMs: WAVE_TUNING.spawning.initialIntervalMs,
        score: 0,
        combo: 0,
        maxComboReached: 0,
        earnedMaxCombo: 0,
        survivalMs: 0,
        lastTickTime: performance.now(),
        newRecordCombo: false,
        newRecordTime: false,
        comboExpiresAt: 0,
        latestMilestoneText: '',
        formatMilestone: (milestone, playerId) => {
            const display = getComboMilestoneDisplay(milestone);
            return { title: display.title, summary: display.summary(playerId) };
        },
        sandboxAllUnlocked: false,
        deathmatchWinner: null,
        gameOverPendingAt: null,
        waveBanner: null,
        players: [],
        enemies: [],
        corpses: [],
        bullets: [],
        placedObjects: [],
        redBoxes: [],
        shellCasings: [],
        particles3D: [],
        wallSmokePuffs: [],
        explosions: [],
        beams: [],
        banners: [],
        keys: new Set(),
        justPressedKeys: new Set(),
        shotgunFiringPlayers: new Set(),
        mouse: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, down: false },
        screenShake: 0,
        lastRedBoxTime: 0,
        camShared: { x: 0, y: 0 },
        camP1: { x: 0, y: 0 },
        camP2: { x: 0, y: 0 },
        flowField: new Int16Array(0),
        flowBlocked: new Uint8Array(0),
        flowCols: 0,
        flowRows: 0,
        lastFlowUpdate: 0,
        debugPathfinding: false,
    });

    const initialStored = statsStorage.getStats();
    const [hud, setHud] = useState<HudState>({
        wave: 1,
        enemiesRemaining: 0,
        score: 0,
        combo: 0,
        maxComboReached: 0,
        earnedMaxCombo: 0,
        survivalSeconds: 0,
        bestComboRecord: initialStored.bestCombo,
        bestSurvivalSecondsRecord: initialStored.bestSurvivalSeconds,
        newRecordCombo: false,
        newRecordTime: false,
        comboRatio: 0,
        latestMilestoneText: '',
        players: [],
        sandboxAllUnlocked: false,
        deathmatchWinner: null,
        debugPathfinding: false,
    });

    const syncWeaponStateToStorage = useCallback(() => {
        syncWeaponState(engineRef.current);
    }, []);

    const initFloorBitmap = useCallback(
        (targetRoom: typeof room = room) => {
            if (!floorBufferRef.current) {
                floorBufferRef.current = document.createElement('canvas');
            }
            initFloorBitmapOnCanvas(floorBufferRef.current, targetRoom, worldW, worldH, roomBounds);
        },
        [room, roomBounds, worldH, worldW],
    );

    const createPlayer = useCallback(
        (
            id: 'P1' | 'P2',
            charId: CharacterId,
            isAI: boolean,
            x: number,
            y: number,
            unlockAll: boolean,
            initialAngle?: number,
        ): PlayerEntity =>
            createPlayerEntity({
                id,
                characterId: charId,
                isAI,
                x,
                y,
                unlockAll,
                aiLabel: m.ai_partner(),
                initialAngle,
            }),
        [],
    );

    const buildWaveEnemies = useCallback(
        (waveNum: number): EnemyKind[] =>
            buildWaveEnemyQueue({
                gameMode,
                wave: waveNum,
                difficultyMultiplier: diffMult,
                devilsEnabled,
            }),
        [devilsEnabled, diffMult, gameMode],
    );

    const initNewGame = useCallback(() => {
        preloadExplosionSprites();
        initFloorBitmap();
        const st = engineRef.current;
        const now = performance.now();
        st.wave = startingWave;
        st.score = 0;
        st.combo = 0;
        st.maxComboReached = 0;
        st.earnedMaxCombo = 0;
        st.survivalMs = 0;
        st.lastTickTime = now;
        st.newRecordCombo = false;
        st.newRecordTime = false;
        st.comboExpiresAt = 0;
        st.latestMilestoneText = '';
        st.sandboxAllUnlocked = false;
        st.deathmatchWinner = null;
        st.gameOverPendingAt = null;
        st.waveBanner =
            gameMode === 'DEATHMATCH_2P' ? null : { text: `WAVE ${startingWave}`, createdAt: now, durationMs: 2400 };
        st.enemies = [];
        st.corpses = [];
        st.bullets = [];
        st.placedObjects = [];
        st.redBoxes = [];
        st.shellCasings = [];
        st.particles3D = [];
        st.wallSmokePuffs = [];
        st.explosions = [];
        st.beams = [];
        st.banners = [];
        st.shotgunFiringPlayers.clear();

        const applyRoomGeometryAndSpawns = (activeRoom: typeof room) => {
            initFloorBitmap(activeRoom);
            const actW = activeRoom.worldWidth || worldW;
            const actH = activeRoom.worldHeight || worldH;
            const actBounds = activeRoom.bounds || roomBounds;
            const actZoom = Math.max(
                WORLD_CAMERA_ZOOM,
                CANVAS_WIDTH / Math.max(320, actBounds.w),
                CANVAS_HEIGHT / Math.max(240, actBounds.h),
            );

            initRoomFlowField(st, activeRoom, actW, actH);

            const p1Node = activeRoom.spawnNodes.find((n) => n.kind === '1') || {
                kind: '1' as const,
                x: actBounds.x + actBounds.w / 2 - 40,
                y: actBounds.y + actBounds.h / 2,
                angle: 0,
            };
            const p2Nodes = activeRoom.spawnNodes.filter((n) => n.kind === '2');
            const pickupNodes = activeRoom.spawnNodes.filter((n) => n.kind === 'P');
            const barrelNodes = activeRoom.spawnNodes.filter((n) => n.kind === 'B');
            const wallNodes = activeRoom.spawnNodes.filter((n) => n.kind === 'W');

            const isDeathmatch = gameMode === 'DEATHMATCH_2P';
            const p1Start = isDeathmatch && p2Nodes.length >= 2 ? p2Nodes[0] : p1Node;
            const p1 = createPlayer('P1', p1CharId, false, p1Start.x, p1Start.y, false, p1Start.angle ?? 0);

            const players: PlayerEntity[] = [p1];
            if (gameMode === 'COOP_2P' || gameMode === 'COOP_AI') {
                const nearestP2Node = p2Nodes
                    .slice()
                    .sort((a, b) => dist(a.x, a.y, p1.x, p1.y) - dist(b.x, b.y, p1.x, p1.y))[0] || {
                    x: p1.x + 68,
                    y: p1.y,
                    angle: Math.PI,
                };
                const useCloseOffset = dist(nearestP2Node.x, nearestP2Node.y, p1.x, p1.y) > 260;
                players.push(
                    createPlayer(
                        'P2',
                        p2CharId,
                        gameMode === 'COOP_AI',
                        useCloseOffset ? p1.x + 64 : nearestP2Node.x,
                        useCloseOffset ? p1.y : nearestP2Node.y,
                        false,
                        nearestP2Node.angle ?? Math.PI,
                    ),
                );
            } else if (gameMode === 'DEATHMATCH_2P') {
                const farP2Node = p2Nodes
                    .slice()
                    .sort((a, b) => dist(b.x, b.y, p1.x, p1.y) - dist(a.x, a.y, p1.x, p1.y))[0] || {
                    x: actBounds.x + actBounds.w - 120,
                    y: actBounds.y + actBounds.h / 2,
                    angle: Math.PI,
                };
                players.push(
                    createPlayer('P2', p2CharId, false, farP2Node.x, farP2Node.y, false, farP2Node.angle ?? Math.PI),
                );
            }
            st.players = players;

            weaponStateStorage.clearWeaponState();
            weaponStateStorage.savePlayersWeaponState(st.players, 0);

            const worldViewW = CANVAS_WIDTH / actZoom;
            const worldViewH = CANVAS_HEIGHT / actZoom;
            const splitWorldW = Math.floor(CANVAS_WIDTH / 2) / actZoom;
            const minCamX = actBounds.x;
            const maxCamXShared = Math.max(actBounds.x, actBounds.x + actBounds.w - worldViewW);
            const maxCamXSplit = Math.max(actBounds.x, actBounds.x + actBounds.w - splitWorldW);
            const minCamY = actBounds.y;
            const maxCamY = Math.max(actBounds.y, actBounds.y + actBounds.h - worldViewH);

            st.camShared = {
                x: clamp(p1.x - worldViewW / 2, minCamX, maxCamXShared),
                y: clamp(p1.y - worldViewH / 2, minCamY, maxCamY),
            };
            st.camP1 = {
                x: clamp(p1.x - splitWorldW / 2, minCamX, maxCamXSplit),
                y: clamp(p1.y - worldViewH / 2, minCamY, maxCamY),
            };
            const p2Ref = players[1] || p1;
            st.camP2 = {
                x: clamp(p2Ref.x - splitWorldW / 2, minCamX, maxCamXSplit),
                y: clamp(p2Ref.y - worldViewH / 2, minCamY, maxCamY),
            };

            const snapNodeToGrid = (wx: number, wy: number) => {
                const GRID_CELL = PLACEABLE_GRID_TUNING.cellSize;
                const halfCell = GRID_CELL / 2;
                const maxCol = Math.max(0, Math.floor(actBounds.w / GRID_CELL) - 1);
                const maxRow = Math.max(0, Math.floor(actBounds.h / GRID_CELL) - 1);
                const col = clamp(Math.floor((wx - actBounds.x) / GRID_CELL), 0, maxCol);
                const row = clamp(Math.floor((wy - actBounds.y) / GRID_CELL), 0, maxRow);
                return {
                    x: actBounds.x + col * GRID_CELL + halfCell,
                    y: actBounds.y + row * GRID_CELL + halfCell,
                };
            };

            st.placedObjects = [];
            barrelNodes.forEach((bNode, idx) => {
                const snapped = snapNodeToGrid(bNode.x, bNode.y);
                const spec = PLACEABLE_SPECS.barrel;
                st.placedObjects.push({
                    id: `map-barrel-${idx}`,
                    kind: 'barrel',
                    ownerId: 'P1',
                    x: snapped.x,
                    y: snapped.y,
                    w: spec.width,
                    h: spec.height,
                    radius: spec.radius,
                    hp: spec.maxHp,
                    maxHp: spec.maxHp,
                    damage: WEAPON_MAP.barrel.baseDamage,
                    blastRadius: WEAPON_MAP.barrel.blastRadius,
                    cluster: false,
                    createdAt: now,
                    armed: true,
                });
            });
            wallNodes.forEach((wNode, idx) => {
                const snapped = snapNodeToGrid(wNode.x, wNode.y);
                const spec = PLACEABLE_SPECS.wall;
                st.placedObjects.push({
                    id: `map-wall-${idx}`,
                    kind: 'wall',
                    ownerId: 'P1',
                    x: snapped.x,
                    y: snapped.y,
                    w: spec.width,
                    h: spec.height,
                    radius: spec.radius,
                    hp: spec.maxHp,
                    maxHp: spec.maxHp,
                    damage: 0,
                    blastRadius: 0,
                    cluster: false,
                    createdAt: now,
                    armed: true,
                });
            });

            st.redBoxes = [];
            pickupNodes.forEach((pNode, idx) => {
                const safePos = resolveSafeRedBoxPosition(activeRoom, actBounds, st.placedObjects, pNode.x, pNode.y);
                st.redBoxes.push({
                    id: `rbox-init-${idx}`,
                    x: safePos.x,
                    y: safePos.y,
                    createdAt: now,
                    source: 'MAP',
                });
            });
        };

        applyRoomGeometryAndSpawns(room);

        st.spawnQueue = buildWaveEnemies(startingWave);
        st.spawnIntervalMs = getWaveSpawnIntervalMs(st.wave);
        st.lastSpawnTime = now;
        st.lastRedBoxTime = now;
        setIsComboModalOpen(false);

        const runId = ++bootRunIdRef.current;
        loadingPhaseRef.current = 'READY';
        setLoadingPhase('READY');

        const readyNow = performance.now();
        st.lastTickTime = readyNow;
        st.lastSpawnTime = readyNow;
        st.lastRedBoxTime = readyNow;
        st.waveBanner = {
            text: gameMode === 'DEATHMATCH_2P' ? 'DEATHMATCH · FIGHT!' : `WAVE ${startingWave}`,
            createdAt: readyNow,
            durationMs: 2200,
        };

        if (!room.isLoaded || room.obstacles.length === 0) {
            void loadRoomById(room.id, { releaseOthers: false }).then((loadedRoom) => {
                if (bootRunIdRef.current !== runId) return;
                applyRoomGeometryAndSpawns(loadedRoom);
            });
        }
        void loadMatchBBModels({ gameMode, p1CharId, p2CharId });
        void preloadAllSvgEffectsWithProgress();
        void soundFX.preloadAllSounds();
    }, [
        buildWaveEnemies,
        createPlayer,
        gameMode,
        initFloorBitmap,
        p1CharId,
        p2CharId,
        room,
        roomBounds,
        startingWave,
        worldH,
        worldW,
    ]);

    useEffect(() => {
        initNewGame();
        return () => {
            bootRunIdRef.current += 1;
            soundFX.stopAllGameplaySounds();
        };
    }, [initNewGame]);

    useEffect(() => {
        if (gameState !== 'PLAYING') {
            soundFX.stopAllGameplaySounds();
        }
    }, [gameState]);

    // Auto-rotate gameplay tips while loading screen is active
    useEffect(() => {
        if (loadingPhase !== 'LOADING') return;
        const tipTimer = window.setInterval(() => {
            setActiveTipIdx((prev) => (prev + 1) % GAMEPLAY_TIPS.length);
        }, 2400);
        return () => window.clearInterval(tipTimer);
    }, [loadingPhase]);

    const cycleWeapon = useCallback((player: PlayerEntity, dir: 1 | -1) => {
        const st = engineRef.current;
        const available = WEAPONS.filter(
            (w) => st.sandboxAllUnlocked || (player.unlocked[w.id] && (w.baseMaxAmmo === -1 || player.ammo[w.id] > 0)),
        ).map((w) => w.id);
        if (available.length === 0) return;
        const idx = available.indexOf(player.currentWeapon);
        const nextIdx = (idx + dir + available.length) % available.length;
        player.currentWeapon = available[nextIdx];
        syncWeaponState(st);
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();

            if (
                k === ' ' ||
                e.code === 'Space' ||
                k === 'arrowup' ||
                k === 'arrowdown' ||
                k === 'arrowleft' ||
                k === 'arrowright' ||
                k === p1Binds.up ||
                k === p1Binds.down ||
                k === p1Binds.left ||
                k === p1Binds.right ||
                k === p1Binds.shoot ||
                k === p2Binds.up ||
                k === p2Binds.down ||
                k === p2Binds.left ||
                k === p2Binds.right ||
                k === p2Binds.shoot
            ) {
                e.preventDefault();
            }

            if (isMapViewerOpen || loadingPhaseRef.current !== 'READY') {
                return;
            }

            if (!engineRef.current.keys.has(k)) {
                engineRef.current.justPressedKeys.add(k);
            }
            engineRef.current.keys.add(k);

            if (k === 'escape' || k === 'p') {
                soundFX.playClick();
                if (isComboModalOpen) {
                    setIsComboModalOpen(false);
                    return;
                }
                if (gameState === 'PLAYING') onGameStateChange('PAUSED');
                else if (gameState === 'PAUSED') onGameStateChange('PLAYING');
                return;
            }

            if (k === 'tab' || k === 'b') {
                e.preventDefault();
                soundFX.playClick();
                setIsComboModalOpen((prev) => !prev);
                return;
            }

            if (k === 'v') {
                e.preventDefault();
                soundFX.playClick();
                const st = engineRef.current;
                st.debugPathfinding = !st.debugPathfinding;
                setHud((prev) => ({
                    ...prev,
                    debugPathfinding: Boolean(st.debugPathfinding),
                }));
                return;
            }

            const st = engineRef.current;
            const p1 = st.players[0];
            const p2 = st.players[1];

            if (p1 && !p1.isDowned) {
                if (k === p1Binds.prevWeapon || (gameMode === 'SOLO' && k === p2Binds.prevWeapon)) {
                    cycleWeapon(p1, -1);
                }
                if (k === p1Binds.nextWeapon || (gameMode === 'SOLO' && k === p2Binds.nextWeapon)) {
                    cycleWeapon(p1, 1);
                }

                const wMatch = WEAPONS.find((w) => w.keyBind === k);
                if (wMatch && (st.sandboxAllUnlocked || p1.unlocked[wMatch.id])) {
                    p1.currentWeapon = wMatch.id;
                    syncWeaponStateToStorage();
                }
            }

            if (p2 && !p2.isAI && !p2.isDowned) {
                if (k === p2Binds.prevWeapon) cycleWeapon(p2, -1);
                if (k === p2Binds.nextWeapon) cycleWeapon(p2, 1);
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            engineRef.current.keys.delete(e.key.toLowerCase());
        };

        window.addEventListener('keydown', onKeyDown, { passive: false });
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [
        cycleWeapon,
        gameMode,
        gameState,
        isComboModalOpen,
        isMapViewerOpen,
        onGameStateChange,
        p1Binds.down,
        p1Binds.left,
        p1Binds.nextWeapon,
        p1Binds.prevWeapon,
        p1Binds.right,
        p1Binds.shoot,
        p1Binds.up,
        p2Binds.down,
        p2Binds.left,
        p2Binds.nextWeapon,
        p2Binds.prevWeapon,
        p2Binds.right,
        p2Binds.shoot,
        p2Binds.up,
        syncWeaponStateToStorage,
    ]);

    // Main 60FPS Pseudo-3D Boxhead Loop
    useEffect(() => {
        let animId: number;
        let lastHudSync = 0;

        const tick = (now: number) => {
            const st = engineRef.current;
            const dt = Math.min(100, Math.max(0, now - st.lastTickTime));
            st.lastTickTime = now;

            const combatCtx: CombatContext = {
                st,
                floorCanvas: floorBufferRef.current,
                room,
                roomBounds,
                roomId,
                gameMode,
                friendlyFire,
                explosionPlayerDamage,
                gameSpeedMult,
            };

            if (
                gameState === 'PLAYING' &&
                loadingPhaseRef.current !== 'LOADING' &&
                !isComboModalOpen &&
                !isMapViewerOpen
            ) {
                if (st.gameOverPendingAt === null) {
                    st.survivalMs += dt;
                }
                updateFlowField(st, now);

                if (
                    gameMode !== 'DEATHMATCH_2P' &&
                    st.spawnQueue.length > 0 &&
                    now - st.lastSpawnTime >= st.spawnIntervalMs &&
                    st.enemies.length < WAVE_TUNING.spawning.maximumActiveEnemies
                ) {
                    const nextKind = st.spawnQueue.shift();
                    if (nextKind) {
                        spawnEnemyFromNode(st, room, roomBounds, worldW, diffMult, nextKind, st.wave);
                        st.lastSpawnTime = now;
                    }
                }

                // Spawn Red Box Pickups at unoccupied 'P' nodes (independent of enemy-dropped 'DROP' boxes!)
                const pNodes = room.spawnNodes.filter((n) => n.kind === 'P');
                if (now - st.lastRedBoxTime > PICKUP_TUNING.mapSpawnIntervalMs) {
                    st.lastRedBoxTime = now;
                    const availablePNodes = pNodes.filter((pn) => {
                        const safeNodePos = resolveSafeRedBoxPosition(room, roomBounds, st.placedObjects, pn.x, pn.y);
                        return !st.redBoxes.some(
                            (rb) =>
                                dist(rb.x, rb.y, pn.x, pn.y) < PICKUP_TUNING.minimumMapBoxSeparation ||
                                dist(rb.x, rb.y, safeNodePos.x, safeNodePos.y) < PICKUP_TUNING.minimumMapBoxSeparation,
                        );
                    });
                    if (availablePNodes.length > 0) {
                        const chosenP = availablePNodes[Math.floor(Math.random() * availablePNodes.length)];
                        const safePos = resolveSafeRedBoxPosition(
                            room,
                            roomBounds,
                            st.placedObjects,
                            chosenP.x,
                            chosenP.y,
                        );
                        st.redBoxes.push({
                            id: `rbox-map-${now}`,
                            x: safePos.x,
                            y: safePos.y,
                            createdAt: now,
                            source: 'MAP',
                        });
                    }
                }

                if (st.gameOverPendingAt === null && st.enemies.length > 0 && Math.random() < 0.008) {
                    soundFX.playZombieAmbience();
                }

                if (st.combo > 0 && now > st.comboExpiresAt) {
                    st.combo = 0;
                }
                st.players.forEach((p) => {
                    if (p.combo > 0 && now > p.comboExpiresAt) {
                        p.combo = 0;
                    }
                });

                // Expire floor shell casings after 5 seconds (5,000ms) to free resources!
                for (let i = st.shellCasings.length - 1; i >= 0; i--) {
                    if (now - st.shellCasings[i].createdAt >= 5000) {
                        st.shellCasings.splice(i, 1);
                    }
                }

                // Update 3D Bouncing Particles (Shell Casings, Blood Drops, Voxel Gibs)
                for (let i = st.particles3D.length - 1; i >= 0; i--) {
                    const pt = st.particles3D[i];
                    pt.x += pt.vx;
                    pt.y += pt.vy;
                    pt.z += pt.vz;
                    pt.vz -= 0.42;

                    if (pt.z <= 0) {
                        pt.z = 0;
                        pt.bounces += 1;
                        if (pt.bounces >= 2 || pt.kind === 'BLOOD') {
                            stampParticleOnFloorCanvas(st, floorBufferRef.current, pt, now);
                            st.particles3D.splice(i, 1);
                        } else {
                            pt.vz = Math.abs(pt.vz) * 0.45;
                            pt.vx *= 0.6;
                            pt.vy *= 0.6;
                        }
                    }
                }

                // Update Players
                const keys = st.keys;
                const justPressed = st.justPressedKeys;

                st.players.forEach((p, idx) => {
                    const minPX = roomBounds.x + 22;
                    const maxPX = roomBounds.x + roomBounds.w - 22;
                    const minPY = roomBounds.y + 26;
                    const maxPY = roomBounds.y + roomBounds.h - 22;

                    if (p.isDowned) {
                        st.shotgunFiringPlayers.delete(p.id);
                        p.vx *= PLAYER_MOVEMENT_TUNING.downedVelocityRetention;
                        p.vy *= PLAYER_MOVEMENT_TUNING.downedVelocityRetention;
                        p.x = clamp(p.x + p.vx, minPX, maxPX);
                        p.y = clamp(p.y + p.vy, minPY, maxPY);
                        room.obstacles.forEach((obs) => {
                            const col = circleRectCollide(p.x, p.y, p.radius, obs.x, obs.y, obs.w, obs.h);
                            if (col.hit) {
                                p.x += col.nx * col.overlap;
                                p.y += col.ny * col.overlap;
                                const vn = p.vx * col.nx + p.vy * col.ny;
                                if (vn < 0) {
                                    p.vx -= vn * col.nx;
                                    p.vy -= vn * col.ny;
                                }
                            }
                        });

                        if (gameMode === 'DEATHMATCH_2P') {
                            if (st.gameOverPendingAt === null) {
                                p.reviveTimer += 1;
                                if (p.reviveTimer > PLAYER_REVIVE_TUNING.deathmatchTicks) {
                                    p.isDowned = false;
                                    p.downedAt = 0;
                                    p.hp = p.maxHp;
                                    p.reviveTimer = 0;

                                    const opponent = st.players.find((other) => other.id !== p.id);
                                    const p2Nodes = room.spawnNodes.filter((n) => n.kind === '2');
                                    const safeNodes = opponent
                                        ? p2Nodes.filter(
                                              (n) =>
                                                  dist(n.x, n.y, opponent.x, opponent.y) >
                                                  PLAYER_REVIVE_TUNING.deathmatchSafeSpawnDistance,
                                          )
                                        : p2Nodes;
                                    const pool = safeNodes.length > 0 ? safeNodes : p2Nodes;
                                    if (pool.length > 0) {
                                        const chosen = pool[Math.floor(Math.random() * pool.length)];
                                        p.x = chosen.x;
                                        p.y = chosen.y;
                                        const ang = chosen.angle ?? 0;
                                        const snapped = snapAngleTo8Dir(Math.cos(ang), Math.sin(ang));
                                        p.dir8 = snapped.dir8;
                                        p.angle = snapped.angle;
                                    } else {
                                        p.x = idx === 0 ? roomBounds.x + 120 : roomBounds.x + roomBounds.w - 120;
                                        p.y = roomBounds.y + roomBounds.h / 2;
                                    }
                                }
                            }
                        } else {
                            const ally = st.players.find((other) => other.id !== p.id && !other.isDowned);
                            if (ally && dist(p.x, p.y, ally.x, ally.y) < PLAYER_REVIVE_TUNING.coopDistance) {
                                p.reviveTimer += 1;
                                if (p.reviveTimer >= PLAYER_REVIVE_TUNING.coopTicks) {
                                    p.isDowned = false;
                                    p.downedAt = 0;
                                    p.hp = PLAYER_REVIVE_TUNING.revivedHealth;
                                    p.reviveTimer = 0;
                                    addBannerToEngine(st, p.x, p.y - 36, `${p.label} REVIVED!`, '#4ade80');
                                }
                            }
                        }
                        return;
                    }

                    let mx = 0;
                    let my = 0;
                    let isShooting = false;
                    let isShootJustPressed = false;

                    if (idx === 0) {
                        const singlePlayerArrows = gameMode === 'SOLO' || gameMode === 'COOP_AI';
                        if (keys.has(p1Binds.up) || (singlePlayerArrows && keys.has(p2Binds.up))) my -= 1;
                        if (keys.has(p1Binds.down) || (singlePlayerArrows && keys.has(p2Binds.down))) my += 1;
                        if (keys.has(p1Binds.left) || (singlePlayerArrows && keys.has(p2Binds.left))) mx -= 1;
                        if (keys.has(p1Binds.right) || (singlePlayerArrows && keys.has(p2Binds.right))) mx += 1;

                        isShootJustPressed =
                            justPressed.has('mouse_left') ||
                            justPressed.has(p1Binds.shoot) ||
                            justPressed.has('f') ||
                            (singlePlayerArrows && justPressed.has(p2Binds.shoot));

                        isShooting =
                            isShootJustPressed ||
                            st.mouse.down ||
                            keys.has(p1Binds.shoot) ||
                            keys.has('f') ||
                            (singlePlayerArrows && keys.has(p2Binds.shoot));

                        if (useMouseAim) {
                            const splitW = Math.floor(CANVAS_WIDTH / 2);
                            const p1ViewOffsetX = gameMode === 'DEATHMATCH_2P' ? (isSplitSwapped ? splitW : 0) : 0;
                            const activeCamX = gameMode === 'DEATHMATCH_2P' ? st.camP1.x : st.camShared.x;
                            const activeCamY = gameMode === 'DEATHMATCH_2P' ? st.camP1.y : st.camShared.y;
                            const worldMouseX = (st.mouse.x - p1ViewOffsetX) / activeCameraZoom + activeCamX;
                            const worldMouseY = st.mouse.y / activeCameraZoom + activeCamY;
                            p.angle = Math.atan2(worldMouseY - p.y, worldMouseX - p.x);
                        } else if (mx !== 0 || my !== 0) {
                            const snapped = snapAngleTo8Dir(mx, my);
                            p.dir8 = snapped.dir8;
                            p.angle = snapped.angle;
                        }
                    } else if (p.isAI) {
                        const aiDecision = computeAIPlayerDecision(
                            st,
                            room,
                            p,
                            aiPartnerStrength,
                            now,
                            activeCameraZoom,
                        );
                        mx = aiDecision.mx;
                        my = aiDecision.my;
                        isShooting = aiDecision.isShooting;
                        isShootJustPressed = aiDecision.isShootJustPressed;
                    } else {
                        if (keys.has(p2Binds.up)) my -= 1;
                        if (keys.has(p2Binds.down)) my += 1;
                        if (keys.has(p2Binds.left)) mx -= 1;
                        if (keys.has(p2Binds.right)) mx += 1;

                        isShootJustPressed = justPressed.has(p2Binds.shoot) || justPressed.has('enter');
                        isShooting = isShootJustPressed || keys.has(p2Binds.shoot) || keys.has('enter');

                        if (mx !== 0 || my !== 0) {
                            const snapped = snapAngleTo8Dir(mx, my);
                            p.dir8 = snapped.dir8;
                            p.angle = snapped.angle;
                        }
                    }

                    if (isShooting) {
                        fireWeapon(combatCtx, p, now, isShootJustPressed);
                    }

                    if (st.shotgunFiringPlayers.has(p.id)) {
                        const stillHoldingShotgun =
                            isShooting &&
                            p.currentWeapon === 'shotgun' &&
                            !p.isDowned &&
                            (st.sandboxAllUnlocked || p.ammo.shotgun > 0);
                        if (!stillHoldingShotgun) {
                            st.shotgunFiringPlayers.delete(p.id);
                            soundFX.triggerShotgunReloadAfterStop(now - p.lastShotTime);
                        }
                    }

                    if (mx !== 0 || my !== 0) {
                        const len = Math.hypot(mx, my);
                        const targetVx = (mx / len) * p.speed * gameSpeedMult;
                        const targetVy = (my / len) * p.speed * gameSpeedMult;
                        p.vx =
                            p.vx * PLAYER_MOVEMENT_TUNING.velocityRetention +
                            targetVx * PLAYER_MOVEMENT_TUNING.acceleration;
                        p.vy =
                            p.vy * PLAYER_MOVEMENT_TUNING.velocityRetention +
                            targetVy * PLAYER_MOVEMENT_TUNING.acceleration;
                        p.walkCycle += 0.25 * gameSpeedMult;
                    } else {
                        p.vx *= PLAYER_MOVEMENT_TUNING.velocityRetention;
                        p.vy *= PLAYER_MOVEMENT_TUNING.velocityRetention;
                    }

                    p.x = clamp(p.x + p.vx, minPX, maxPX);
                    p.y = clamp(p.y + p.vy, minPY, maxPY);

                    const worldViewW = CANVAS_WIDTH / activeCameraZoom;
                    const worldViewH = CANVAS_HEIGHT / activeCameraZoom;
                    if (gameMode === 'COOP_2P' || gameMode === 'COOP_AI') {
                        p.x = clamp(
                            p.x,
                            Math.max(minPX, st.camShared.x + 28),
                            Math.min(maxPX, st.camShared.x + worldViewW - 28),
                        );
                        p.y = clamp(
                            p.y,
                            Math.max(minPY, st.camShared.y + 36),
                            Math.min(maxPY, st.camShared.y + worldViewH - 24),
                        );
                    }

                    for (let pass = 0; pass < 2; pass++) {
                        room.obstacles.forEach((obs) => {
                            const col = circleRectCollide(p.x, p.y, p.radius, obs.x, obs.y, obs.w, obs.h);
                            if (col.hit) {
                                p.x += col.nx * col.overlap;
                                p.y += col.ny * col.overlap;
                                const vn = p.vx * col.nx + p.vy * col.ny;
                                if (vn < 0) {
                                    p.vx -= vn * col.nx;
                                    p.vy -= vn * col.ny;
                                }
                            }
                        });

                        st.placedObjects.forEach((obj) => {
                            if ((obj.kind === 'wall' || obj.kind === 'barrel') && obj.hp > 0) {
                                const d = dist(p.x, p.y, obj.x, obj.y);
                                const minDist = p.radius + obj.radius;
                                if (obj.passThroughPlayers?.includes(p.id)) {
                                    if (d >= minDist) {
                                        obj.passThroughPlayers = obj.passThroughPlayers.filter((id) => id !== p.id);
                                    }
                                    return;
                                }
                                if (objectCollision && d < minDist) {
                                    const pushAng =
                                        d > 0.001 ? Math.atan2(p.y - obj.y, p.x - obj.x) : p.angle + Math.PI;
                                    const nx = Math.cos(pushAng);
                                    const ny = Math.sin(pushAng);
                                    p.x = clamp(obj.x + nx * minDist, minPX, maxPX);
                                    p.y = clamp(obj.y + ny * minDist, minPY, maxPY);
                                    const vn = p.vx * nx + p.vy * ny;
                                    if (vn < 0) {
                                        p.vx -= vn * nx;
                                        p.vy -= vn * ny;
                                    }
                                }
                            }
                        });
                    }
                });

                st.justPressedKeys.clear();

                // Update Camera positions using Smooth Lerp, clamped strictly to roomBounds
                const camLerp = 0.12;
                const worldViewW = CANVAS_WIDTH / activeCameraZoom;
                const worldViewH = CANVAS_HEIGHT / activeCameraZoom;
                const minCamX = roomBounds.x;
                const maxCamXShared = Math.max(roomBounds.x, roomBounds.x + roomBounds.w - worldViewW);
                const minCamY = roomBounds.y;
                const maxCamY = Math.max(roomBounds.y, roomBounds.y + roomBounds.h - worldViewH);

                if (gameMode === 'SOLO') {
                    const p1 = st.players[0];
                    if (p1) {
                        const targetX = clamp(p1.x - worldViewW / 2, minCamX, maxCamXShared);
                        const targetY = clamp(p1.y - worldViewH / 2, minCamY, maxCamY);
                        st.camShared.x += (targetX - st.camShared.x) * camLerp;
                        st.camShared.y += (targetY - st.camShared.y) * camLerp;
                    }
                } else if (gameMode === 'COOP_2P' || gameMode === 'COOP_AI') {
                    const p1 = st.players[0];
                    const p2 = st.players[1] || p1;
                    if (p1 && p2) {
                        const midX = (p1.x + p2.x) * 0.5;
                        const midY = (p1.y + p2.y) * 0.5;
                        const targetX = clamp(midX - worldViewW / 2, minCamX, maxCamXShared);
                        const targetY = clamp(midY - worldViewH / 2, minCamY, maxCamY);
                        st.camShared.x += (targetX - st.camShared.x) * camLerp;
                        st.camShared.y += (targetY - st.camShared.y) * camLerp;
                    }
                } else if (gameMode === 'DEATHMATCH_2P') {
                    const splitWorldW = Math.floor(CANVAS_WIDTH / 2) / activeCameraZoom;
                    const maxCamXSplit = Math.max(roomBounds.x, roomBounds.x + roomBounds.w - splitWorldW);
                    const p1 = st.players[0];
                    const p2 = st.players[1];
                    if (p1) {
                        const t1X = clamp(p1.x - splitWorldW / 2, minCamX, maxCamXSplit);
                        const t1Y = clamp(p1.y - worldViewH / 2, minCamY, maxCamY);
                        st.camP1.x += (t1X - st.camP1.x) * 0.14;
                        st.camP1.y += (t1Y - st.camP1.y) * 0.14;
                    }
                    if (p2) {
                        const t2X = clamp(p2.x - splitWorldW / 2, minCamX, maxCamXSplit);
                        const t2Y = clamp(p2.y - worldViewH / 2, minCamY, maxCamY);
                        st.camP2.x += (t2X - st.camP2.x) * 0.14;
                        st.camP2.y += (t2Y - st.camP2.y) * 0.14;
                    }
                }

                updatePlacedObjects(combatCtx, now);
                updateBulletsAndGrenades(combatCtx, now);
                updateEnemiesAIAndCombat(
                    st,
                    floorBufferRef.current,
                    room,
                    roomBounds,
                    roomId,
                    objectCollision,
                    gameSpeedMult,
                    now,
                );

                // Update Red Boxes (NEVER expire on a timer! Only removed when picked up by a player!)
                for (let i = st.redBoxes.length - 1; i >= 0; i--) {
                    const box = st.redBoxes[i];
                    let picked = false;
                    for (const p of st.players) {
                        if (!p.isDowned && dist(box.x, box.y, p.x, p.y) <= p.radius + PICKUP_TUNING.collisionRadius) {
                            picked = true;
                            soundFX.playPickupBox();
                            p.hp = Math.min(p.maxHp, p.hp + PICKUP_TUNING.healthRestore);

                            if (gameMode === 'DEATHMATCH_2P' && !st.sandboxAllUnlocked) {
                                const nextMilestone = COMBO_MILESTONES.find((m) => m.combo > p.maxComboReached);
                                if (nextMilestone) {
                                    p.maxComboReached = nextMilestone.combo;
                                    p.combo = nextMilestone.combo;
                                    p.comboExpiresAt = now + WEAPON_PERK_TUNING.comboDurationMs;
                                    applyMilestoneToPlayer(st, p, nextMilestone.combo);
                                    st.maxComboReached = Math.max(st.maxComboReached, p.maxComboReached);
                                }
                            }

                            const unlockedFinite = WEAPONS.filter(
                                (w) =>
                                    w.baseMaxAmmo !== -1 &&
                                    (!p.isAI || w.id === 'uzi' || w.id === 'shotgun') &&
                                    (st.sandboxAllUnlocked || p.unlocked[w.id]),
                            );
                            unlockedFinite.forEach((w) => {
                                const addAmt = Math.ceil(p.maxAmmo[w.id] * PICKUP_TUNING.ammoRestoreRatio);
                                p.ammo[w.id] = Math.min(p.maxAmmo[w.id], p.ammo[w.id] + addAmt);
                            });

                            syncWeaponStateToStorage();

                            const highlightW =
                                unlockedFinite[Math.floor(Math.random() * unlockedFinite.length)] || WEAPONS[0];
                            addBannerToEngine(
                                st,
                                box.x,
                                box.y - 26,
                                m.pickup_ammo_health({ player: p.id, weapon: getWeaponDisplay(highlightW.id) }),
                                '#ffffff',
                            );
                            break;
                        }
                    }
                    if (picked) {
                        st.redBoxes.splice(i, 1);
                    }
                }

                if (gameMode === 'DEATHMATCH_2P') {
                    const winner = st.players.find((p) => p.frags >= deathmatchFragsGoal);
                    if (winner) {
                        if (st.gameOverPendingAt === null) {
                            st.deathmatchWinner = winner.id;
                            statsStorage.updateFromRun({
                                roomId,
                                maxCombo: st.earnedMaxCombo,
                                survivalSeconds: Math.floor(st.survivalMs / 1000),
                                wave: st.wave,
                                score: st.score,
                            });
                            weaponStateStorage.clearWeaponState();
                            st.gameOverPendingAt = now + 2000;
                        } else if (now >= st.gameOverPendingAt) {
                            st.gameOverPendingAt = null;
                            soundFX.stopAllGameplaySounds();
                            onGameStateChange('GAME_OVER');
                        }
                    }
                } else {
                    if (st.players.every((p) => p.isDowned)) {
                        if (st.gameOverPendingAt === null) {
                            const res = statsStorage.updateFromRun({
                                roomId,
                                maxCombo: st.earnedMaxCombo,
                                survivalSeconds: Math.floor(st.survivalMs / 1000),
                                wave: st.wave,
                                score: st.score,
                            });
                            if (res.isNewBestCombo) st.newRecordCombo = true;
                            if (res.isNewBestTime) st.newRecordTime = true;
                            weaponStateStorage.clearWeaponState();
                            st.gameOverPendingAt = now + 2000;
                        } else if (now >= st.gameOverPendingAt) {
                            st.gameOverPendingAt = null;
                            soundFX.stopAllGameplaySounds();
                            onGameStateChange('GAME_OVER');
                        }
                    } else {
                        st.gameOverPendingAt = null;
                        if (st.spawnQueue.length === 0 && st.enemies.length === 0) {
                            const res = statsStorage.updateFromRun({
                                roomId,
                                maxCombo: st.earnedMaxCombo,
                                survivalSeconds: Math.floor(st.survivalMs / 1000),
                                wave: st.wave,
                                score: st.score,
                            });
                            if (res.isNewBestCombo) st.newRecordCombo = true;
                            if (res.isNewBestTime) st.newRecordTime = true;

                            st.wave += 1;
                            st.spawnQueue = buildWaveEnemies(st.wave);
                            st.spawnIntervalMs = getWaveSpawnIntervalMs(st.wave);
                            st.lastSpawnTime = now + WAVE_TUNING.spawning.nextWaveDelayMs;
                            st.players.forEach((p) => {
                                if (p.isDowned) {
                                    p.isDowned = false;
                                    p.downedAt = 0;
                                    p.hp = PLAYER_REVIVE_TUNING.revivedHealth;
                                    p.reviveTimer = 0;
                                }
                            });
                            st.waveBanner = {
                                text: `WAVE ${st.wave}`,
                                createdAt: now,
                                durationMs: 2400,
                            };
                        }
                    }
                }
            }

            // Update Straight-Backward Falling Corpses (Zombies & Devils)
            for (let i = st.corpses.length - 1; i >= 0; i--) {
                const c = st.corpses[i];
                if (now - c.diedAt >= c.durationMs) {
                    st.corpses.splice(i, 1);
                    continue;
                }
                c.x = clamp(c.x + c.vx, roomBounds.x + 20, roomBounds.x + roomBounds.w - 20);
                c.y = clamp(c.y + c.vy, roomBounds.y + 20, roomBounds.y + roomBounds.h - 20);
                c.vx *= 0.8;
                c.vy *= 0.8;
                room.obstacles.forEach((obs) => {
                    const col = circleRectCollide(c.x, c.y, c.radius, obs.x, obs.y, obs.w, obs.h);
                    if (col.hit) {
                        c.x += col.nx * col.overlap;
                        c.y += col.ny * col.overlap;
                    }
                });
            }

            st.wallSmokePuffs = st.wallSmokePuffs.filter((sp) => now - sp.createdAt < sp.durationMs);
            st.wallSmokePuffs.forEach((sp) => {
                sp.x += sp.vx;
                sp.y += sp.vy;
                sp.z += sp.vz;
            });
            st.explosions = st.explosions.filter((ex) => now - ex.createdAt < ex.durationMs);
            st.beams = st.beams.filter((bm) => now - bm.createdAt < bm.durationMs);
            st.banners = st.banners.filter((bn) => now - bn.createdAt < bn.durationMs);
            st.screenShake *= 0.84;

            // Render 2.5D World Canvas & Side Minimaps
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    renderBattleCanvasFrame({
                        ctx,
                        st,
                        floorCanvas: floorBufferRef.current,
                        room,
                        worldW,
                        worldH,
                        activeCameraZoom,
                        gameMode,
                        isSplitSwapped,
                        deathmatchFragsGoal,
                        getCharacterName: (characterId) => getCharacterDisplay(characterId).name,
                        getWeaponName: getWeaponDisplay,
                        now,
                    });

                    if (minimapEnabled) {
                        renderBattleMinimaps(
                            st,
                            room,
                            roomBounds,
                            worldW,
                            worldH,
                            activeCameraZoom,
                            gameMode,
                            isSplitSwapped,
                            leftMinimapCanvasRef.current,
                            rightMinimapCanvasRef.current,
                        );
                    }
                }
            }

            if (now - lastHudSync > 80) {
                lastHudSync = now;
                const ratio = st.combo > 0 ? clamp((st.comboExpiresAt - now) / 3800, 0, 1) : 0;
                const curSurvivalSecs = Math.floor(st.survivalMs / 1000);
                if (gameState === 'PLAYING' && curSurvivalSecs > 0) {
                    const res = statsStorage.updateFromRun({
                        roomId,
                        maxCombo: st.earnedMaxCombo,
                        survivalSeconds: curSurvivalSecs,
                        wave: st.wave,
                        score: st.score,
                    });
                    if (res.isNewBestCombo) st.newRecordCombo = true;
                    if (res.isNewBestTime) st.newRecordTime = true;
                }
                const stored = statsStorage.getStats();
                setHud({
                    wave: st.wave,
                    enemiesRemaining: st.spawnQueue.length + st.enemies.length,
                    score: st.score,
                    combo: st.combo,
                    maxComboReached: st.maxComboReached,
                    earnedMaxCombo: st.earnedMaxCombo,
                    survivalSeconds: curSurvivalSecs,
                    bestComboRecord: stored.bestCombo,
                    bestSurvivalSecondsRecord: stored.bestSurvivalSeconds,
                    newRecordCombo: st.newRecordCombo,
                    newRecordTime: st.newRecordTime,
                    comboRatio: ratio,
                    latestMilestoneText: st.latestMilestoneText,
                    players: st.players.map((p) => ({
                        ...p,
                        ammo: { ...p.ammo },
                        maxAmmo: { ...p.maxAmmo },
                        unlocked: { ...p.unlocked },
                        unlockedMilestones: [...p.unlockedMilestones],
                    })),
                    sandboxAllUnlocked: st.sandboxAllUnlocked,
                    deathmatchWinner: st.deathmatchWinner,
                    debugPathfinding: Boolean(st.debugPathfinding),
                    activeEnemiesCount: st.enemies.length,
                });
            }

            animId = requestAnimationFrame(tick);
        };

        animId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animId);
    }, [
        activeCameraZoom,
        buildWaveEnemies,
        deathmatchFragsGoal,
        diffMult,
        explosionPlayerDamage,
        friendlyFire,
        gameMode,
        gameSpeedMult,
        gameState,
        isComboModalOpen,
        isMapViewerOpen,
        isSplitSwapped,
        minimapEnabled,
        objectCollision,
        onGameStateChange,
        p1Binds.down,
        p1Binds.left,
        p1Binds.right,
        p1Binds.shoot,
        p1Binds.up,
        p2Binds.down,
        p2Binds.left,
        p2Binds.right,
        p2Binds.shoot,
        p2Binds.up,
        room,
        roomBounds,
        roomId,
        syncWeaponStateToStorage,
        useMouseAim,
        worldH,
        worldW,
        aiPartnerStrength,
    ]);

    const handleToggleSandboxUnlockAll = () => {
        const st = engineRef.current;
        if (!st.sandboxAllUnlocked) {
            weaponStateStorage.savePlayersWeaponState(st.players, st.maxComboReached);
            st.sandboxAllUnlocked = true;
            st.maxComboReached = PLAYER_DEFAULTS.sandboxMaxCombo;
            st.players.forEach((p) => {
                p.maxComboReached = PLAYER_DEFAULTS.sandboxMaxCombo;
                p.unlockedMilestones = COMBO_MILESTONES.filter(
                    (m) => !p.isAI || m.weaponId === 'pistol' || m.weaponId === 'uzi' || m.weaponId === 'shotgun',
                ).map((m) => m.combo);
                WEAPONS.forEach((w) => {
                    const allowedForPlayer = !p.isAI || w.id === 'pistol' || w.id === 'uzi' || w.id === 'shotgun';
                    p.unlocked[w.id] = allowedForPlayer;
                    if (w.baseMaxAmmo !== -1 && allowedForPlayer) {
                        p.maxAmmo[w.id] = w.baseMaxAmmo * 4;
                        p.ammo[w.id] = p.maxAmmo[w.id];
                    }
                });
            });
        } else {
            st.sandboxAllUnlocked = false;
            const restoredGlobalMax = weaponStateStorage.restorePlayersWeaponState(st.players);
            st.maxComboReached = restoredGlobalMax ?? 0;
        }

        setHud((prev) => ({
            ...prev,
            maxComboReached: st.maxComboReached,
            sandboxAllUnlocked: st.sandboxAllUnlocked,
            players: st.players.map((p) => ({
                ...p,
                ammo: { ...p.ammo },
                maxAmmo: { ...p.maxAmmo },
                unlocked: { ...p.unlocked },
                unlockedMilestones: [...p.unlockedMilestones],
            })),
        }));
    };

    const handleToggleDebugPathfinding = () => {
        soundFX.playClick();
        const st = engineRef.current;
        st.debugPathfinding = !st.debugPathfinding;
        setHud((prev) => ({
            ...prev,
            debugPathfinding: Boolean(st.debugPathfinding),
        }));
    };

    const handleSelectWeaponFromBar = (playerId: 'P1' | 'P2', weaponId: WeaponId) => {
        const st = engineRef.current;
        const targetPl = st.players.find((item) => item.id === playerId);
        if (targetPl?.isAI && weaponId !== 'pistol' && weaponId !== 'uzi' && weaponId !== 'shotgun') {
            return;
        }
        if (targetPl && (st.sandboxAllUnlocked || targetPl.unlocked[weaponId])) {
            targetPl.currentWeapon = weaponId;
            syncWeaponStateToStorage();
        } else {
            setIsComboModalOpen(true);
        }
    };

    const restartGame = () => {
        initNewGame();
        onGameStateChange('PLAYING');
    };

    return (
        <BattlePresentation
            gameMode={gameMode}
            difficulty={effectiveDifficulty}
            gameState={gameState}
            hud={hud}
            useMouseAim={useMouseAim}
            loadingPhase={loadingPhase}
            loadingProgress={loadingProgress}
            loadingAssetsInfo={loadingAssetsInfo}
            roomName={roomDisplay.name}
            activeTipIdx={activeTipIdx}
            minimapEnabled={minimapEnabled}
            isSplitSwapped={isSplitSwapped}
            worldW={worldW}
            worldH={worldH}
            isComboModalOpen={isComboModalOpen}
            deathmatchFragsGoal={deathmatchFragsGoal}
            canvasRef={canvasRef}
            leftMinimapCanvasRef={leftMinimapCanvasRef}
            rightMinimapCanvasRef={rightMinimapCanvasRef}
            engineRef={engineRef}
            loadingPhaseRef={loadingPhaseRef}
            onToggleMouseAim={() => setUseMouseAim((previous) => !previous)}
            onToggleDebugPathfinding={handleToggleDebugPathfinding}
            onOpenComboModal={() => {
                if (loadingPhase === 'READY') setIsComboModalOpen(true);
            }}
            onTogglePause={() => {
                if (loadingPhase === 'READY') {
                    onGameStateChange(gameState === 'PAUSED' ? 'PLAYING' : 'PAUSED');
                }
            }}
            onSelectTipIdx={setActiveTipIdx}
            onGameStateChange={onGameStateChange}
            onToggleSandboxUnlockAll={handleToggleSandboxUnlockAll}
            onToggleMinimap={onToggleMinimap}
            onRestart={restartGame}
            onReturnToTitle={onReturnToTitle}
            onToggleSplitSwap={() => {
                soundFX.playClick();
                setIsSplitSwapped((previous) => !previous);
            }}
            onSelectWeapon={handleSelectWeaponFromBar}
            onCloseComboModal={() => setIsComboModalOpen(false)}
        />
    );
};
