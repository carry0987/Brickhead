import type { FC } from 'react';
import * as m from '@/paraglide/messages';
import { soundFX } from '@/utils/sound';

interface BattlePauseModalProps {
    roomName: string;
    maxComboReached: number;
    sandboxAllUnlocked: boolean;
    minimapEnabled: boolean;
    debugPathfinding?: boolean;
    onResume: () => void;
    onToggleSandboxUnlockAll: () => void;
    onToggleMinimap?: () => void;
    onToggleDebugPathfinding?: () => void;
    onRestart: () => void;
    onReturnToTitle: () => void;
}

export const BattlePauseModal: FC<BattlePauseModalProps> = ({
    roomName,
    maxComboReached,
    sandboxAllUnlocked,
    minimapEnabled,
    debugPathfinding = false,
    onResume,
    onToggleSandboxUnlockAll,
    onToggleMinimap,
    onToggleDebugPathfinding,
    onRestart,
    onReturnToTitle,
}) => {
    return (
        <div className="absolute inset-0 bg-stone-950/80 backdrop-blur-xs flex items-center justify-center p-6">
            <div className="max-w-md w-full rounded-xl border border-stone-700 bg-stone-900 p-6 text-center">
                <h2 className="text-2xl font-bold text-white">{m.pause_title()}</h2>
                <p className="text-sm text-stone-400 mt-1">
                    {m.pause_room_combo({ room: roomName, combo: maxComboReached })}
                </p>
                <div className="mt-6 flex flex-col gap-2.5">
                    <button
                        type="button"
                        onClick={onResume}
                        className="w-full py-2.5 px-4 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition-colors select-none">
                        {m.pause_resume()}
                    </button>
                    <button
                        type="button"
                        onClick={onToggleSandboxUnlockAll}
                        className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold border border-stone-700 bg-stone-800 text-amber-300 hover:bg-stone-700 transition-colors select-none">
                        {sandboxAllUnlocked ? m.pause_disable_sandbox() : m.pause_enable_sandbox()}
                    </button>
                    {onToggleDebugPathfinding && (
                        <button
                            type="button"
                            onClick={() => {
                                soundFX.playClick();
                                onToggleDebugPathfinding();
                            }}
                            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold border border-stone-700 bg-stone-800 text-sky-300 hover:bg-stone-700 transition-colors cursor-pointer select-none">
                            {m.pause_pathfinding({
                                state: debugPathfinding ? m.state_enabled() : m.state_disabled(),
                            })}
                        </button>
                    )}
                    {onToggleMinimap && (
                        <button
                            type="button"
                            onClick={() => {
                                soundFX.playClick();
                                onToggleMinimap();
                            }}
                            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold border border-stone-700 bg-stone-800 text-emerald-300 hover:bg-stone-700 transition-colors cursor-pointer select-none">
                            {m.pause_minimap_state({
                                state: minimapEnabled ? m.state_enabled() : m.state_disabled(),
                            })}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onRestart}
                        className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold border border-stone-800 text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer select-none">
                        {m.pause_restart()}
                    </button>
                    <button
                        type="button"
                        onClick={onReturnToTitle}
                        className="w-full py-2 px-4 rounded-lg text-xs font-medium text-stone-400 hover:text-white transition-colors select-none">
                        {m.pause_return_lobby()}
                    </button>
                </div>
            </div>
        </div>
    );
};
