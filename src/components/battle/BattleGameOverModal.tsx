import { RotateCcw } from 'lucide-react';
import type { FC } from 'react';
import type { HudState } from '@/engine/battleTypes';
import * as m from '@/paraglide/messages';
import type { GameMode } from '@/types/game';
import { formatSurvivalTime } from '@/utils/statsStorage';

interface BattleGameOverModalProps {
    gameMode: GameMode;
    roomName: string;
    deathmatchFragsGoal: number;
    hud: HudState;
    onPlayAgain: () => void;
    onReturnToTitle: () => void;
}

export const BattleGameOverModal: FC<BattleGameOverModalProps> = ({
    gameMode,
    roomName,
    deathmatchFragsGoal,
    hud,
    onPlayAgain,
    onReturnToTitle,
}) => {
    return (
        <div className="absolute inset-0 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="max-w-lg w-full rounded-xl border border-stone-700 bg-stone-900 p-8 text-center shadow-2xl">
                <p className="text-xs font-mono-tabular text-red-400">
                    {gameMode === 'DEATHMATCH_2P' ? m.game_over_deathmatch_finished() : m.game_over_defeat()}
                </p>
                <h2 className="text-3xl font-extrabold text-white mt-1">
                    {gameMode === 'DEATHMATCH_2P'
                        ? m.game_over_winner({ player: hud.deathmatchWinner ?? '' })
                        : m.game_over()}
                </h2>
                <p className="text-sm text-stone-400 mt-2">
                    {gameMode === 'DEATHMATCH_2P'
                        ? m.game_over_deathmatch_summary({ goal: deathmatchFragsGoal })
                        : m.game_over_survival_summary({ room: roomName, wave: hud.wave })}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 p-4 rounded-lg bg-stone-950 border border-stone-800 font-mono-tabular">
                    <div>
                        <span className="text-xs text-stone-400 block">{m.game_over_score()}</span>
                        <span className="text-xl font-bold text-white">{hud.score.toLocaleString()}</span>
                    </div>
                    <div>
                        <span className="text-xs text-stone-400 block">{m.game_over_max_combo()}</span>
                        <span className="text-xl font-bold text-red-500">{hud.earnedMaxCombo}x</span>
                        <span className="block text-[11px] text-stone-400 mt-0.5">
                            {hud.newRecordCombo ? (
                                <span className="text-amber-300 font-bold">{m.game_over_new_record()}</span>
                            ) : (
                                m.game_over_personal_best({ value: `${hud.bestComboRecord}x` })
                            )}
                        </span>
                    </div>
                    <div>
                        <span className="text-xs text-stone-400 block">{m.game_over_survival_time()}</span>
                        <span className="text-xl font-bold text-emerald-400">
                            {formatSurvivalTime(hud.survivalSeconds)}
                        </span>
                        <span className="block text-[11px] text-stone-400 mt-0.5">
                            {hud.newRecordTime ? (
                                <span className="text-amber-300 font-bold">{m.game_over_new_record()}</span>
                            ) : (
                                m.game_over_personal_best({ value: formatSurvivalTime(hud.bestSurvivalSecondsRecord) })
                            )}
                        </span>
                    </div>
                    <div>
                        <span className="text-xs text-stone-400 block">{m.game_over_wave()}</span>
                        <span className="text-xl font-bold text-amber-400">W{hud.wave}</span>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={onPlayAgain}
                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 select-none">
                        <RotateCcw className="w-4 h-4" />
                        <span>{m.game_over_play_again()}</span>
                    </button>
                    <button
                        type="button"
                        onClick={onReturnToTitle}
                        className="px-5 py-3 rounded-lg text-sm font-semibold border border-stone-700 bg-stone-800 text-stone-200 hover:bg-stone-700 transition-colors whitespace-nowrap shrink-0 select-none">
                        {m.game_over_return_lobby()}
                    </button>
                </div>
            </div>
        </div>
    );
};
