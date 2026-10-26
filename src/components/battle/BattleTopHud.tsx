import { ArrowLeftRight, Clock, Compass, Flame, Maximize2, Minimize2, Pause, Play, ShieldAlert } from 'lucide-react';
import type { FC } from 'react';
import type { HudState } from '@/engine/battleTypes';
import * as m from '@/paraglide/messages';
import type { Difficulty, GameMode, GameState } from '@/types/game';
import { formatSurvivalTime } from '@/utils/statsStorage';

interface BattleTopHudProps {
    gameMode: GameMode;
    difficulty: Difficulty;
    gameState: GameState;
    hud: HudState;
    useMouseAim: boolean;
    isSplitSwapped: boolean;
    isFullscreen: boolean;
    onToggleMouseAim: () => void;
    onToggleFullscreen: () => void;
    onToggleSplitSwap: () => void;
    onToggleDebugPathfinding?: () => void;
    onOpenComboModal: () => void;
    onTogglePause: () => void;
}

const DIFFICULTY_HUD_META: Record<Difficulty, { label: () => string; colorClass: string }> = {
    EASY: { label: m.difficulty_easy, colorClass: 'text-emerald-400' },
    NORMAL: { label: m.difficulty_normal, colorClass: 'text-sky-400' },
    HARD: { label: m.difficulty_hard, colorClass: 'text-amber-400' },
    NIGHTMARE: { label: m.difficulty_nightmare, colorClass: 'text-red-500' },
};

export const BattleTopHud: FC<BattleTopHudProps> = ({
    gameMode,
    difficulty,
    gameState,
    hud,
    useMouseAim,
    isSplitSwapped,
    isFullscreen,
    onToggleMouseAim,
    onToggleFullscreen,
    onToggleSplitSwap,
    onToggleDebugPathfinding,
    onOpenComboModal,
    onTogglePause,
}) => {
    const p1 = hud.players[0];
    const p2 = hud.players[1];
    const diffMeta = DIFFICULTY_HUD_META[difficulty] || DIFFICULTY_HUD_META.NORMAL;

    return (
        <div className="flex items-center justify-between gap-4 bg-stone-900 border border-stone-700 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-7 font-mono-tabular">
                <div className="text-left">
                    <span className="text-[11px] text-stone-400 block">
                        {gameMode === 'DEATHMATCH_2P' ? m.hud_deathmatch() : m.hud_wave_remaining()}
                    </span>
                    <span className="text-base font-bold text-white">
                        {gameMode === 'DEATHMATCH_2P'
                            ? `P1 ${p1?.frags ?? 0} : ${p2?.frags ?? 0} P2`
                            : m.hud_wave_enemies({ wave: hud.wave, count: hud.enemiesRemaining })}
                    </span>
                </div>

                {gameMode !== 'DEATHMATCH_2P' && (
                    <div className="text-left">
                        <span className="text-[11px] text-stone-400 flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-stone-400" />
                            <span>{m.hud_difficulty()}</span>
                        </span>
                        <span className={`text-base font-bold ${diffMeta.colorClass}`}>{diffMeta.label()}</span>
                    </div>
                )}

                <div className="text-left">
                    <span className="text-[11px] text-stone-400 block">{m.hud_combo()}</span>
                    <span className="text-base font-bold text-red-500">
                        {hud.combo}x{' '}
                        <span className="text-[11px] text-stone-400">
                            ({m.hud_best_combo({ combo: hud.bestComboRecord })})
                        </span>
                    </span>
                </div>

                <div className="text-left">
                    <span className="text-[11px] text-stone-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-400" />
                        <span>{m.hud_survival_time()}</span>
                    </span>
                    <span className="text-base font-bold text-emerald-400">
                        {formatSurvivalTime(hud.survivalSeconds)}
                    </span>
                </div>

                <div className="text-left">
                    <span className="text-[11px] text-stone-400 block">{m.hud_score()}</span>
                    <span className="text-base font-bold text-amber-400">{hud.score.toLocaleString()}</span>
                </div>
            </div>

            <div className="flex items-center justify-end gap-2">
                {gameMode === 'DEATHMATCH_2P' && (
                    <button
                        type="button"
                        onClick={onToggleSplitSwap}
                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border border-stone-700 bg-stone-800 text-stone-200 hover:border-amber-500/70 hover:text-amber-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none"
                        title={m.split_swap_summary({
                            left: isSplitSwapped ? 'P2' : 'P1',
                            right: isSplitSwapped ? 'P1' : 'P2',
                        })}>
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>{isSplitSwapped ? 'P2 ↔ P1' : 'P1 ↔ P2'}</span>
                    </button>
                )}

                {onToggleDebugPathfinding && (
                    <button
                        type="button"
                        onClick={onToggleDebugPathfinding}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none ${
                            hud.debugPathfinding
                                ? 'border-sky-400/80 bg-sky-950/60 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.25)]'
                                : 'border-stone-700 bg-stone-800 text-stone-300 hover:bg-stone-700'
                        }`}
                        title={m.hud_pathfinding_title()}>
                        <Compass className="w-3.5 h-3.5" />
                        <span>
                            {m.hud_pathfinding({ state: hud.debugPathfinding ? m.toggle_on() : m.toggle_off() })}
                        </span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={onToggleMouseAim}
                    className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 select-none ${
                        useMouseAim
                            ? 'border-amber-400/70 bg-amber-950/40 text-amber-300'
                            : 'border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700'
                    }`}
                    title={m.hud_aim_title()}>
                    {useMouseAim ? m.hud_aim_mouse() : m.hud_aim_keyboard()}
                </button>

                <button
                    type="button"
                    onClick={onOpenComboModal}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none">
                    <Flame className="w-3.5 h-3.5" />
                    <span>{m.hud_combo_list()}</span>
                </button>

                <button
                    type="button"
                    onClick={onToggleFullscreen}
                    className="p-2 rounded-lg border border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors shrink-0 cursor-pointer select-none"
                    aria-label={isFullscreen ? m.hud_exit_fullscreen() : m.hud_enter_fullscreen()}
                    title={isFullscreen ? m.hud_exit_fullscreen() : m.hud_enter_fullscreen()}>
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                <button
                    type="button"
                    onClick={onTogglePause}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors shrink-0 cursor-pointer select-none"
                    aria-label={m.hud_pause()}>
                    {gameState === 'PAUSED' ? (
                        <Play className="w-4 h-4 text-emerald-400" />
                    ) : (
                        <Pause className="w-4 h-4" />
                    )}
                    <span className="text-xs font-semibold">[P]</span>
                </button>
            </div>
        </div>
    );
};
