import { CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import type { FC } from 'react';
import { GAMEPLAY_TIPS, LEGO_PROGRESS_STUDS } from '@/data/gameplayTips';
import type { LoadingAssetsInfo } from '@/engine/battleTypes';
import { getGameplayTipDisplay } from '@/i18n/battleI18n';
import * as m from '@/paraglide/messages';
import { soundFX } from '@/utils/sound';

const LOADING_BRICK_IDS = Array.from({ length: LEGO_PROGRESS_STUDS }, (_, index) => `loading-brick-${index + 1}`);

interface BattleLoadingOverlayProps {
    loadingPhase: 'LOADING' | 'FADING_OUT' | 'READY';
    loadingProgress: number;
    loadingAssetsInfo: LoadingAssetsInfo;
    roomName: string;
    activeTipIdx: number;
    onSelectTipIdx: (idx: number | ((prev: number) => number)) => void;
}

export const BattleLoadingOverlay: FC<BattleLoadingOverlayProps> = ({
    loadingPhase,
    loadingProgress,
    loadingAssetsInfo,
    roomName,
    activeTipIdx,
    onSelectTipIdx,
}) => {
    if (loadingPhase === 'READY') return null;

    const tipData = GAMEPLAY_TIPS[activeTipIdx % GAMEPLAY_TIPS.length];
    const tip = getGameplayTipDisplay(tipData.id);

    return (
        <div
            className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-4 sm:p-6 transition-all duration-500 ease-out ${
                loadingPhase === 'FADING_OUT' ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
            }`}
            style={{
                backgroundColor: 'rgba(12, 10, 9, 0.94)',
                backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.06) 2px, transparent 2px)',
                backgroundSize: '20px 20px',
            }}>
            <div className="max-w-xl w-full rounded-2xl border-2 border-stone-700 bg-stone-900/95 p-5 sm:p-7 shadow-2xl flex flex-col gap-5">
                {/* Top Lego Brick Header */}
                <div className="flex items-center justify-between gap-3 border-b border-stone-800 pb-4">
                    <div className="flex items-center gap-3">
                        {/* Decorative 2x2 Red Lego Brick Icon */}
                        <div className="w-11 h-11 rounded-lg bg-red-600 border-b-4 border-red-800 p-1.5 grid grid-cols-2 gap-1 shadow-md shrink-0">
                            <span className="rounded-full bg-red-400/90 border border-red-300/60 shadow-inner" />
                            <span className="rounded-full bg-red-400/90 border border-red-300/60 shadow-inner" />
                            <span className="rounded-full bg-red-400/90 border border-red-300/60 shadow-inner" />
                            <span className="rounded-full bg-red-400/90 border border-red-300/60 shadow-inner" />
                        </div>
                        <div className="text-left">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-amber-400 text-stone-950 uppercase">
                                    BRICK ENGINE INITIALIZING
                                </span>
                                <span className="text-xs font-mono-tabular text-stone-400">{roomName}</span>
                            </div>
                            <h3 className="text-lg sm:text-xl font-extrabold text-white mt-0.5 tracking-tight">
                                {m.loading_title()}
                            </h3>
                        </div>
                    </div>
                    <div className="text-right font-mono-tabular shrink-0">
                        <span className="text-2xl sm:text-3xl font-black text-amber-400">{loadingProgress}%</span>
                    </div>
                </div>

                {/* Combined Lego Brick Progress Bar + Gameplay Tip Card */}
                <div className="rounded-xl border border-stone-700/90 bg-stone-950/90 p-4 flex flex-col gap-4 shadow-inner">
                    {/* Stage Label & Stud Count */}
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>{loadingAssetsInfo.stageLabel}</span>
                        </span>
                        <span className="font-mono-tabular text-stone-400">
                            {Math.round((loadingProgress / 100) * LEGO_PROGRESS_STUDS)} / {LEGO_PROGRESS_STUDS} STUDS
                        </span>
                    </div>

                    {/* 12-Stud Lego Brick Progress Bar */}
                    <div className="grid grid-cols-12 gap-1.5 p-2 rounded-xl bg-stone-900 border-2 border-stone-800">
                        {Array.from({ length: LEGO_PROGRESS_STUDS }).map((_, idx) => {
                            const threshold = ((idx + 1) / LEGO_PROGRESS_STUDS) * 100;
                            const isFilled = loadingProgress >= threshold - 3;
                            const isComplete = loadingProgress >= 100;
                            const brickBg = !isFilled
                                ? 'bg-stone-800/80 border-stone-700/60'
                                : isComplete
                                  ? 'bg-emerald-500 border-emerald-700'
                                  : idx < 4
                                    ? 'bg-red-600 border-red-800'
                                    : idx < 8
                                      ? 'bg-amber-500 border-amber-700'
                                      : 'bg-yellow-400 border-yellow-600';
                            const studBg = !isFilled
                                ? 'bg-stone-700/60'
                                : isComplete
                                  ? 'bg-emerald-300'
                                  : idx < 4
                                    ? 'bg-red-400'
                                    : idx < 8
                                      ? 'bg-amber-300'
                                      : 'bg-yellow-200';

                            return (
                                <div
                                    key={LOADING_BRICK_IDS[idx]}
                                    className={`relative h-8 sm:h-9 rounded-md border-b-4 transition-all duration-150 flex flex-col items-center justify-start pt-1 ${brickBg} ${
                                        isFilled ? 'translate-y-0 opacity-100 shadow-sm' : 'translate-y-0.5 opacity-45'
                                    }`}>
                                    {/* Top Lego Stud Cap */}
                                    <div
                                        className={`w-3.5 sm:w-4 h-1.5 rounded-t-sm border-t border-white/40 ${studBg}`}
                                    />
                                    {/* Glossy Plastic Highlight */}
                                    {isFilled && <div className="w-3/4 h-0.5 bg-white/30 rounded-full mt-1" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* Real-Time Resource Verification Pills (Audio / 3D Models / SVG Effects / Map Data) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono-tabular">
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                            <span className="truncate">{m.loading_sounds()}</span>
                            <span className="font-bold text-amber-400 flex items-center gap-1">
                                {loadingAssetsInfo.soundsLoaded}/{loadingAssetsInfo.soundsTotal}
                                {loadingAssetsInfo.soundsLoaded >= loadingAssetsInfo.soundsTotal && (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                )}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                            <span className="truncate">{m.loading_models()}</span>
                            <span className="font-bold text-amber-400 flex items-center gap-1">
                                {loadingAssetsInfo.modelsLoaded}/{loadingAssetsInfo.modelsTotal}
                                {loadingAssetsInfo.modelsLoaded >= loadingAssetsInfo.modelsTotal && (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                )}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                            <span className="truncate">{m.loading_effects()}</span>
                            <span className="font-bold text-amber-400 flex items-center gap-1">
                                {loadingAssetsInfo.effectsLoaded}/{loadingAssetsInfo.effectsTotal}
                                {loadingAssetsInfo.effectsTotal > 0 &&
                                    loadingAssetsInfo.effectsLoaded >= loadingAssetsInfo.effectsTotal && (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    )}
                            </span>
                        </div>
                        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-300">
                            <span className="truncate">{m.loading_map()}</span>
                            <span className="font-bold text-emerald-400 flex items-center gap-1">
                                READY
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            </span>
                        </div>
                    </div>

                    {/* Coupled Randomized Gameplay Tip Card */}
                    <div className="mt-1 rounded-xl border-2 border-amber-500/40 bg-linear-to-br from-stone-900 via-stone-900 to-stone-950 p-3.5 sm:p-4 text-left relative overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                                    style={{ backgroundColor: tipData.brickColor }}
                                />
                                <span className="text-[11px] font-bold tracking-wider uppercase text-amber-400">
                                    {m.tip_heading({
                                        current: (activeTipIdx % GAMEPLAY_TIPS.length) + 1,
                                        total: GAMEPLAY_TIPS.length,
                                        category: tip.category,
                                    })}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    soundFX.playClick();
                                    onSelectTipIdx((prev) => (prev + 1) % GAMEPLAY_TIPS.length);
                                }}
                                className="flex items-center gap-1 px-2 py-0.5 rounded bg-stone-800 hover:bg-stone-700 text-[11px] font-semibold text-stone-300 hover:text-white border border-stone-700 transition-colors cursor-pointer select-none">
                                <span>{m.tip_next()}</span>
                                <ChevronRight className="w-3 h-3 text-amber-400" />
                            </button>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                            <h4 className="text-sm sm:text-base font-extrabold text-white">{tip.title}</h4>
                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-stone-950 border border-stone-700 text-[11px] font-mono-tabular font-bold text-emerald-300 shrink-0">
                                {tip.keyHint}
                            </span>
                        </div>

                        <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">{tip.body}</p>

                        {/* Mini Tip Progress Dots */}
                        <div className="flex items-center gap-1.5 mt-3">
                            {GAMEPLAY_TIPS.map((tipItem, dotIdx) => (
                                <button
                                    key={tipItem.id}
                                    type="button"
                                    onClick={() => onSelectTipIdx(dotIdx)}
                                    aria-label={m.tip_select({ number: dotIdx + 1 })}
                                    className={`h-1.5 rounded-full transition-all cursor-pointer select-none ${
                                        dotIdx === activeTipIdx % GAMEPLAY_TIPS.length
                                            ? 'w-6 bg-amber-400'
                                            : 'w-2 bg-stone-700 hover:bg-stone-500'
                                    }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
