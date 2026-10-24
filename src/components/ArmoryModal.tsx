import { Flame, ShieldAlert, User, X } from 'lucide-react';
import type { FC } from 'react';
import { useState } from 'react';
import { COMBO_MILESTONES, getWeaponUnlockCombo } from '@/data/comboMilestones';
import { WEAPONS } from '@/data/weaponCatalog';
import { getComboMilestoneDisplay, getWeaponDisplay } from '@/i18n/catalogI18n';
import * as m from '@/paraglide/messages';
import type { PlayerEntity } from '@/types/game';

interface ComboTreeModalProps {
    isOpen: boolean;
    currentWave: number;
    maxComboReached: number;
    players: PlayerEntity[];
    sandboxAllUnlocked: boolean;
    onClose: () => void;
    onToggleSandboxUnlockAll: () => void;
}

export const ArmoryModal: FC<ComboTreeModalProps> = ({
    isOpen,
    currentWave,
    players,
    sandboxAllUnlocked,
    onClose,
    onToggleSandboxUnlockAll,
}) => {
    const [selectedPlayerId, setSelectedPlayerId] = useState<'P1' | 'P2'>('P1');

    if (!isOpen) return null;

    const p1 = players[0];
    const p2 = players[1];
    const activePlayer = selectedPlayerId === 'P2' && p2 ? p2 : p1;

    const isMilestoneAchieved = (pl: PlayerEntity | undefined, comboReq: number) => {
        if (!pl) return false;
        const m = COMBO_MILESTONES.find((item) => item.combo === comboReq);
        if (pl.isAI && m && m.weaponId !== 'pistol' && m.weaponId !== 'uzi' && m.weaponId !== 'shotgun') {
            return false;
        }
        if (sandboxAllUnlocked) return true;
        return (
            pl.maxComboReached >= comboReq ||
            (Array.isArray(pl.unlockedMilestones) && pl.unlockedMilestones.includes(comboReq))
        );
    };

    const col1 = COMBO_MILESTONES.filter((m) => m.combo <= 40);
    const col2 = COMBO_MILESTONES.filter((m) => m.combo >= 41 && m.combo <= 64);
    const col3 = COMBO_MILESTONES.filter((m) => m.combo >= 66);

    return (
        <div className="fixed inset-0 z-50 bg-stone-950/88 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-5xl rounded-xl border border-stone-700 bg-stone-900 shadow-2xl overflow-hidden my-auto">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-stone-800 bg-stone-950">
                    <div>
                        <p className="text-xs text-red-400 font-mono-tabular">
                            {m.armory_header({ wave: currentWave })}
                        </p>
                        <h2 className="text-xl font-black text-white tracking-wide mt-0.5">{m.armory_title()}</h2>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Player Switcher for P1 / P2 independent evolution tables */}
                        {p2 && (
                            <div className="flex items-center gap-1.5 bg-stone-900 border border-stone-700 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlayerId('P1')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors select-none ${
                                        activePlayer?.id === 'P1'
                                            ? 'bg-red-600 text-white'
                                            : 'text-stone-400 hover:text-white'
                                    }`}>
                                    <User className="w-3.5 h-3.5" />
                                    <span>
                                        {m.armory_player_evolution({
                                            player: 'P1',
                                            combo: sandboxAllUnlocked ? '125x' : `${p1?.maxComboReached ?? 0}x`,
                                        })}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPlayerId('P2')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors select-none ${
                                        activePlayer?.id === 'P2'
                                            ? 'bg-sky-600 text-white'
                                            : 'text-stone-400 hover:text-white'
                                    }`}>
                                    <User className="w-3.5 h-3.5" />
                                    <span>
                                        {m.armory_player_evolution({
                                            player: 'P2',
                                            combo: sandboxAllUnlocked ? '125x' : `${p2?.maxComboReached ?? 0}x`,
                                        })}
                                    </span>
                                </button>
                            </div>
                        )}

                        <div className="text-right font-mono-tabular">
                            <span className="text-xs text-stone-400 block">
                                {m.armory_highest_evolution({ player: activePlayer?.id ?? 'P1' })}
                            </span>
                            <span
                                className={`text-xl font-bold ${activePlayer?.id === 'P2' ? 'text-sky-400' : 'text-red-500'}`}>
                                {sandboxAllUnlocked ? '125x MAX' : `${activePlayer?.maxComboReached ?? 0}x MULTIPLE`}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors select-none"
                            aria-label={m.close_window()}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Sandbox Full Arsenal Unlock Bar */}
                <div className="px-6 py-3 bg-stone-900 border-b border-stone-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="text-xs text-stone-300">{m.armory_storage_hint()}</div>

                    <button
                        type="button"
                        onClick={onToggleSandboxUnlockAll}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 select-none ${
                            sandboxAllUnlocked
                                ? 'bg-emerald-500 text-stone-950'
                                : 'border border-red-500/60 bg-red-950/50 text-red-300 hover:bg-red-900/60'
                        }`}>
                        <Flame className="w-4 h-4" />
                        <span>{sandboxAllUnlocked ? m.armory_disable_sandbox() : m.armory_enable_sandbox()}</span>
                    </button>
                </div>

                <div className="p-5 space-y-5 max-h-[66vh] overflow-y-auto">
                    {/* Active Player's Weapons Status (3 weapons for AI Partner, 10 for Human) */}
                    <div
                        className={
                            activePlayer?.isAI
                                ? 'grid grid-cols-1 sm:grid-cols-3 gap-2'
                                : 'grid grid-cols-2 sm:grid-cols-5 gap-2'
                        }>
                        {WEAPONS.filter(
                            (w) => !activePlayer?.isAI || w.id === 'pistol' || w.id === 'uzi' || w.id === 'shotgun',
                        ).map((w) => {
                            const unlocked = sandboxAllUnlocked || (activePlayer ? activePlayer.unlocked[w.id] : false);
                            const ammo = activePlayer ? activePlayer.ammo[w.id] : w.baseMaxAmmo;
                            const maxAmmo = activePlayer ? activePlayer.maxAmmo[w.id] : w.baseMaxAmmo;
                            return (
                                <div
                                    key={w.id}
                                    className={`px-3 py-2 rounded-lg border ${
                                        unlocked
                                            ? 'border-stone-700 bg-stone-950'
                                            : 'border-stone-800/60 bg-stone-950/40 opacity-50'
                                    }`}>
                                    <div className="flex items-center justify-between text-[11px] font-mono-tabular">
                                        <span
                                            className={`font-bold ${activePlayer?.id === 'P2' ? 'text-sky-400' : 'text-red-400'}`}>
                                            {activePlayer?.id ?? 'P1'} · Key [{w.keyBind}]
                                        </span>
                                        <span className={unlocked ? 'text-emerald-400 font-bold' : 'text-stone-400'}>
                                            {unlocked
                                                ? m.armory_unlocked()
                                                : m.weapon_unlocked({ combo: getWeaponUnlockCombo(w.id) })}
                                        </span>
                                    </div>
                                    <div className="text-xs font-bold text-white mt-0.5">{getWeaponDisplay(w.id)}</div>
                                    <div className="text-[11px] font-mono-tabular text-stone-300 mt-0.5">
                                        {w.baseMaxAmmo === -1 || sandboxAllUnlocked
                                            ? m.weapon_ammo_infinite()
                                            : m.weapon_ammo({ ammo, maxAmmo })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Authentic 3-Column Boxhead 2Play UPGRADE LIST Table */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
                        {[col1, col2, col3].map((col) => (
                            <div
                                key={col[0]?.combo}
                                className="border border-stone-600 bg-stone-950/90 rounded overflow-hidden text-xs font-mono-tabular">
                                {col.map((m) => {
                                    const milestoneDisplay = getComboMilestoneDisplay(m);
                                    const achieved = isMilestoneAchieved(activePlayer, m.combo);
                                    const p1Has = isMilestoneAchieved(p1, m.combo);
                                    const p2Has = p2 ? isMilestoneAchieved(p2, m.combo) : false;
                                    const isUnlock = m.effectType === 'UNLOCK';
                                    return (
                                        <div
                                            key={m.combo}
                                            title={milestoneDisplay.title}
                                            className={`grid grid-cols-[44px_1fr_auto] items-center border-b last:border-b-0 border-stone-700/80 transition-colors ${
                                                achieved
                                                    ? isUnlock
                                                        ? 'bg-emerald-950/35'
                                                        : 'bg-stone-900/90'
                                                    : 'bg-stone-950/40 opacity-45'
                                            }`}>
                                            <div
                                                className={`px-2 py-1 text-right border-r border-stone-700/80 font-bold ${
                                                    achieved ? 'text-white' : 'text-stone-400'
                                                }`}>
                                                {m.combo}
                                            </div>
                                            <div
                                                className={`px-2.5 py-1 truncate font-semibold ${
                                                    isUnlock
                                                        ? 'text-[#22c55e] font-bold'
                                                        : achieved
                                                          ? 'text-stone-100'
                                                          : 'text-stone-400'
                                                }`}>
                                                {milestoneDisplay.title}
                                            </div>
                                            {p2 && (
                                                <div className="flex items-center gap-1 pr-2">
                                                    <span
                                                        className={`px-1 rounded text-[9px] font-bold ${
                                                            p1Has
                                                                ? 'bg-red-600/80 text-white'
                                                                : 'bg-stone-800 text-stone-500'
                                                        }`}>
                                                        P1
                                                    </span>
                                                    <span
                                                        className={`px-1 rounded text-[9px] font-bold ${
                                                            p2Has
                                                                ? 'bg-sky-600/80 text-white'
                                                                : 'bg-stone-800 text-stone-500'
                                                        }`}>
                                                        P2
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3.5 bg-stone-950 border-t border-stone-800 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-xs text-stone-400">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{m.armory_weapon_hint()}</span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 select-none">
                        {m.armory_return()}
                    </button>
                </div>
            </div>
        </div>
    );
};
