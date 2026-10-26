import type { Dispatch, FC, RefObject, SetStateAction } from 'react';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from '@/data/gameCatalog';
import type { BattleEngineState, HudState, LoadingAssetsInfo } from '@/engine/battleTypes';
import type { Difficulty, GameMode, GameState, WeaponId } from '@/types/game';
import { ArmoryModal } from '../ArmoryModal';
import { BattleGameOverModal } from './BattleGameOverModal';
import { BattleLoadingOverlay } from './BattleLoadingOverlay';
import { BattleMinimapSidebar } from './BattleMinimapSidebar';
import { BattlePauseModal } from './BattlePauseModal';
import { BattleTopHud } from './BattleTopHud';

type LoadingPhase = 'LOADING' | 'FADING_OUT' | 'READY';

interface BattlePresentationProps {
    gameMode: GameMode;
    difficulty: Difficulty;
    gameState: GameState;
    hud: HudState;
    useMouseAim: boolean;
    loadingPhase: LoadingPhase;
    loadingProgress: number;
    loadingAssetsInfo: LoadingAssetsInfo;
    roomName: string;
    activeTipIdx: number;
    minimapEnabled: boolean;
    isSplitSwapped: boolean;
    worldW: number;
    worldH: number;
    isComboModalOpen: boolean;
    deathmatchFragsGoal: number;
    battleWorkspaceRef: RefObject<HTMLDivElement | null>;
    canvasRef: RefObject<HTMLCanvasElement | null>;
    leftMinimapCanvasRef: RefObject<HTMLCanvasElement | null>;
    rightMinimapCanvasRef: RefObject<HTMLCanvasElement | null>;
    engineRef: RefObject<BattleEngineState>;
    loadingPhaseRef: RefObject<LoadingPhase>;
    isFullscreen: boolean;
    onToggleMouseAim: () => void;
    onToggleFullscreen: () => void;
    onToggleDebugPathfinding: () => void;
    onOpenComboModal: () => void;
    onTogglePause: () => void;
    onSelectTipIdx: Dispatch<SetStateAction<number>>;
    onGameStateChange: (state: GameState) => void;
    onToggleSandboxUnlockAll: () => void;
    onToggleMinimap?: () => void;
    onRestart: () => void;
    onReturnToTitle: () => void;
    onToggleSplitSwap: () => void;
    onSelectWeapon: (playerId: 'P1' | 'P2', weaponId: WeaponId) => void;
    onCloseComboModal: () => void;
}

export const BattlePresentation: FC<BattlePresentationProps> = ({
    gameMode,
    difficulty,
    gameState,
    hud,
    useMouseAim,
    loadingPhase,
    loadingProgress,
    loadingAssetsInfo,
    roomName,
    activeTipIdx,
    minimapEnabled,
    isSplitSwapped,
    worldW,
    worldH,
    isComboModalOpen,
    deathmatchFragsGoal,
    battleWorkspaceRef,
    canvasRef,
    leftMinimapCanvasRef,
    rightMinimapCanvasRef,
    engineRef,
    loadingPhaseRef,
    isFullscreen,
    onToggleMouseAim,
    onToggleFullscreen,
    onToggleDebugPathfinding,
    onOpenComboModal,
    onTogglePause,
    onSelectTipIdx,
    onGameStateChange,
    onToggleSandboxUnlockAll,
    onToggleMinimap,
    onRestart,
    onReturnToTitle,
    onToggleSplitSwap,
    onSelectWeapon,
    onCloseComboModal,
}) => {
    const firstPlayer = hud.players[0];
    const secondPlayer = hud.players[1];
    const leftPlayer = gameMode === 'DEATHMATCH_2P' && isSplitSwapped ? secondPlayer : firstPlayer;
    const rightPlayer = gameMode === 'DEATHMATCH_2P' && isSplitSwapped ? firstPlayer : secondPlayer;

    return (
        <div
            ref={battleWorkspaceRef}
            className={`battle-workspace w-full mx-auto flex flex-col gap-3 ${
                isFullscreen ? 'h-full min-w-0 max-w-none justify-center p-3' : 'min-w-[1180px] max-w-385 px-5 py-3'
            }`}>
            <BattleTopHud
                gameMode={gameMode}
                difficulty={difficulty}
                gameState={gameState}
                hud={hud}
                useMouseAim={useMouseAim}
                isSplitSwapped={isSplitSwapped}
                onToggleMouseAim={onToggleMouseAim}
                isFullscreen={isFullscreen}
                onToggleFullscreen={onToggleFullscreen}
                onToggleSplitSwap={onToggleSplitSwap}
                onToggleDebugPathfinding={onToggleDebugPathfinding}
                onOpenComboModal={onOpenComboModal}
                onTogglePause={onTogglePause}
            />

            <div className="w-full rounded-xl overflow-hidden border-2 border-stone-700 bg-black shadow-2xl flex flex-row items-stretch justify-between max-h-[calc(100dvh-10.75rem)]">
                <BattleMinimapSidebar
                    side="left"
                    minimapEnabled={minimapEnabled}
                    gameMode={gameMode}
                    player={leftPlayer}
                    sandboxAllUnlocked={hud.sandboxAllUnlocked}
                    worldW={worldW}
                    worldH={worldH}
                    canvasRef={leftMinimapCanvasRef}
                    onSelectWeapon={onSelectWeapon}
                    debugPathfinding={hud.debugPathfinding}
                    activeEnemiesCount={hud.activeEnemiesCount ?? 0}
                />

                <div className="relative flex-1 min-w-0 bg-stone-950 flex flex-col items-center justify-center overflow-hidden">
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        onMouseMove={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            engineRef.current.mouse.x = ((event.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
                            engineRef.current.mouse.y = ((event.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
                        }}
                        onMouseDown={(event) => {
                            if (loadingPhaseRef.current !== 'READY' || event.button !== 0) return;
                            engineRef.current.mouse.down = true;
                            engineRef.current.justPressedKeys.add('mouse_left');
                            engineRef.current.justPressedKeys.add(' ');
                        }}
                        onMouseUp={(event) => {
                            if (event.button === 0) engineRef.current.mouse.down = false;
                        }}
                        onMouseLeave={() => {
                            engineRef.current.mouse.down = false;
                        }}
                        className="w-full h-auto max-h-[calc(100dvh-11rem)] object-contain select-none"
                    />

                    <BattleLoadingOverlay
                        loadingPhase={loadingPhase}
                        loadingProgress={loadingProgress}
                        loadingAssetsInfo={loadingAssetsInfo}
                        roomName={roomName}
                        activeTipIdx={activeTipIdx}
                        onSelectTipIdx={onSelectTipIdx}
                    />

                    {gameState === 'PAUSED' && loadingPhase === 'READY' && !isComboModalOpen && (
                        <BattlePauseModal
                            roomName={roomName}
                            maxComboReached={hud.maxComboReached}
                            sandboxAllUnlocked={hud.sandboxAllUnlocked}
                            minimapEnabled={minimapEnabled}
                            debugPathfinding={hud.debugPathfinding}
                            onResume={() => onGameStateChange('PLAYING')}
                            onToggleSandboxUnlockAll={onToggleSandboxUnlockAll}
                            onToggleMinimap={onToggleMinimap}
                            onToggleDebugPathfinding={onToggleDebugPathfinding}
                            onRestart={onRestart}
                            onReturnToTitle={onReturnToTitle}
                        />
                    )}

                    {gameState === 'GAME_OVER' && (
                        <BattleGameOverModal
                            gameMode={gameMode}
                            roomName={roomName}
                            deathmatchFragsGoal={deathmatchFragsGoal}
                            hud={hud}
                            onPlayAgain={onRestart}
                            onReturnToTitle={onReturnToTitle}
                        />
                    )}
                </div>

                <BattleMinimapSidebar
                    side="right"
                    minimapEnabled={minimapEnabled}
                    gameMode={gameMode}
                    player={rightPlayer}
                    sandboxAllUnlocked={hud.sandboxAllUnlocked}
                    worldW={worldW}
                    worldH={worldH}
                    canvasRef={rightMinimapCanvasRef}
                    onSelectWeapon={onSelectWeapon}
                />
            </div>

            <ArmoryModal
                isOpen={isComboModalOpen}
                currentWave={hud.wave}
                maxComboReached={hud.maxComboReached}
                players={hud.players}
                sandboxAllUnlocked={hud.sandboxAllUnlocked}
                onClose={onCloseComboModal}
                onToggleSandboxUnlockAll={onToggleSandboxUnlockAll}
            />
        </div>
    );
};
