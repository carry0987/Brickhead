import type { FC, RefObject } from 'react';
import * as m from '@/paraglide/messages';
import type { GameMode, PlayerEntity, WeaponId } from '@/types/game';
import { BattlePlayerWeaponPanel } from './BattlePlayerWeaponPanel';

interface BattleMinimapSidebarProps {
    side: 'left' | 'right';
    minimapEnabled: boolean;
    gameMode: GameMode;
    player?: PlayerEntity;
    sandboxAllUnlocked: boolean;
    worldW: number;
    worldH: number;
    canvasRef: RefObject<HTMLCanvasElement | null>;
    onSelectWeapon: (playerId: 'P1' | 'P2', weaponId: WeaponId) => void;
    debugPathfinding?: boolean;
    activeEnemiesCount?: number;
}

const MinimapLegend: FC<{ gameMode: GameMode }> = ({ gameMode }) => (
    <div className="grid w-full grid-cols-2 gap-x-1.5 gap-y-1 text-[10px] font-mono-tabular text-stone-400 pt-1 px-0.5">
        <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
            <span>{m.minimap_legend_p1()}</span>
        </span>
        {gameMode !== 'SOLO' && (
            <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400 inline-block shrink-0" />
                <span>{gameMode === 'COOP_AI' ? m.minimap_legend_ai() : m.minimap_legend_p2()}</span>
            </span>
        )}
        <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block shrink-0" />
            <span>{m.minimap_legend_zombies()}</span>
        </span>
        <span className="flex items-center gap-1">
            <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0 overflow-visible inline-block" aria-hidden="true">
                <polygon points="2.2,4.8 0.6,0.8 4.6,3.2" fill="#ef4444" />
                <polygon points="9.8,4.8 11.4,0.8 7.4,3.2" fill="#ef4444" />
                <circle cx="6" cy="7" r="3.8" fill="#ef4444" />
            </svg>
            <span>{m.minimap_legend_devil()}</span>
        </span>
        <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-xs bg-yellow-400 inline-block shrink-0" />
            <span>{m.minimap_legend_supply()}</span>
        </span>
        <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shrink-0" />
            <span>{m.minimap_legend_barrel()}</span>
        </span>
        <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block shrink-0" />
            <span>{m.minimap_legend_mine()}</span>
        </span>
    </div>
);

const DebugPathfindingSidebarCard: FC<{ activeEnemiesCount: number }> = ({ activeEnemiesCount }) => (
    <div className="flex w-full flex-col gap-1.5 mt-2 rounded border border-sky-500/60 bg-stone-950/95 p-2 text-[10px] font-mono-tabular text-stone-300 shadow-md select-none">
        <div className="flex items-center justify-between border-b border-stone-800 pb-1">
            <span className="font-bold text-sky-400">{m.debug_pathfinding()}</span>
            <span className="text-sky-300 font-bold">{m.debug_tracked({ count: activeEnemiesCount })}</span>
        </div>
        <div className="flex flex-col gap-1 text-[9.5px] leading-snug text-stone-300">
            <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-emerald-400 shrink-0 rounded-full" />
                <span>{m.debug_los()}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-sky-400 shrink-0 rounded-full" />
                <span>{m.debug_zombie_flow()}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-amber-400 shrink-0 rounded-full" />
                <span>{m.debug_devil_flow()}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 border-b border-dashed border-red-400 shrink-0" />
                <span>{m.debug_no_path()}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-fuchsia-400 shrink-0 rounded-full" />
                <span>{m.debug_ai_path()}</span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border border-yellow-300 shrink-0 inline-block" />
                <span>{m.debug_wall_slide()}</span>
            </div>
        </div>
    </div>
);

export const BattleMinimapSidebar: FC<BattleMinimapSidebarProps> = ({
    side,
    minimapEnabled,
    gameMode,
    player,
    sandboxAllUnlocked,
    worldW,
    worldH,
    canvasRef,
    onSelectWeapon,
    debugPathfinding = false,
    activeEnemiesCount = 0,
}) => {
    const heightPx = Math.round(164 * (worldH / worldW));

    if (side === 'left') {
        return (
            <div className="flex w-46 shrink-0 overflow-y-auto bg-black border-r border-stone-800/80 p-2.5 flex-col items-center justify-start gap-2">
                {minimapEnabled && (
                    <div className="w-full flex flex-col items-center gap-1.5">
                        <div className="w-full flex items-center justify-between px-1 text-[10px] font-mono-tabular text-stone-400">
                            <span className="font-bold text-red-400">
                                {player?.id === 'P2' ? m.minimap_p2() : m.minimap_p1()}
                            </span>
                            <span className="text-emerald-400">LIVE</span>
                        </div>
                        <canvas
                            ref={canvasRef}
                            width={164}
                            height={heightPx}
                            className="w-full max-w-41 h-auto rounded border border-stone-700 bg-stone-950 shadow-md select-none"
                        />
                        <MinimapLegend gameMode={gameMode} />
                    </div>
                )}
                {debugPathfinding && <DebugPathfindingSidebarCard activeEnemiesCount={activeEnemiesCount} />}
                {player && (
                    <BattlePlayerWeaponPanel
                        player={player}
                        sandboxAllUnlocked={sandboxAllUnlocked}
                        onSelectWeapon={onSelectWeapon}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="flex w-46 shrink-0 overflow-y-auto bg-black border-l border-stone-800/80 p-2.5 flex-col items-center justify-start gap-2">
            {minimapEnabled && (gameMode === 'COOP_2P' || gameMode === 'DEATHMATCH_2P') && (
                <div className="w-full flex flex-col items-center gap-1.5">
                    <div className="w-full flex items-center justify-between px-1 text-[10px] font-mono-tabular text-stone-400">
                        <span className="font-bold text-sky-400">
                            {player?.id === 'P1' ? m.minimap_p1() : m.minimap_p2()}
                        </span>
                        <span className="text-emerald-400">LIVE</span>
                    </div>
                    <canvas
                        ref={canvasRef}
                        width={164}
                        height={heightPx}
                        className="w-full max-w-41 h-auto rounded border border-stone-700 bg-stone-950 shadow-md select-none"
                    />
                    <MinimapLegend gameMode={gameMode} />
                </div>
            )}
            {player && (
                <BattlePlayerWeaponPanel
                    player={player}
                    sandboxAllUnlocked={sandboxAllUnlocked}
                    onSelectWeapon={onSelectWeapon}
                />
            )}
        </div>
    );
};
