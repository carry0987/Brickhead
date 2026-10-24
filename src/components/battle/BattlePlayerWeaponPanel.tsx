import type { FC } from 'react';
import { getWeaponUnlockCombo } from '@/data/comboMilestones';
import { CHARACTERS } from '@/data/gameCatalog';
import { WEAPONS } from '@/data/weaponCatalog';
import { getCharacterDisplay, getWeaponDisplay } from '@/i18n/catalogI18n';
import * as m from '@/paraglide/messages';
import type { PlayerEntity, WeaponId } from '@/types/game';

interface PlayerWeaponPanelProps {
    player: PlayerEntity;
    sandboxAllUnlocked: boolean;
    onSelectWeapon: (playerId: 'P1' | 'P2', weaponId: WeaponId) => void;
}

const getAvailableWeapons = (player: PlayerEntity) =>
    WEAPONS.filter(
        (weapon) => !player.isAI || weapon.id === 'pistol' || weapon.id === 'uzi' || weapon.id === 'shotgun',
    );

const getAmmoLabel = (player: PlayerEntity, weaponId: WeaponId, sandboxAllUnlocked: boolean): string => {
    const spec = WEAPONS.find((weapon) => weapon.id === weaponId);
    if (spec?.baseMaxAmmo === -1 || sandboxAllUnlocked) return '∞';
    return String(player.ammo[weaponId]);
};

const WeaponGrid: FC<PlayerWeaponPanelProps> = ({ player, sandboxAllUnlocked, onSelectWeapon }) => (
    <div className={`grid gap-1 ${player.isAI ? 'grid-cols-3' : 'grid-cols-5'}`}>
        {getAvailableWeapons(player).map((weapon) => {
            const unlocked = sandboxAllUnlocked || player.unlocked[weapon.id];
            const active = player.currentWeapon === weapon.id;
            const ammoLabel = getAmmoLabel(player, weapon.id, sandboxAllUnlocked);
            const title = unlocked
                ? `${getWeaponDisplay(weapon.id)} · ${ammoLabel}`
                : `${getWeaponDisplay(weapon.id)} · ${m.weapon_unlocked({ combo: getWeaponUnlockCombo(weapon.id) })}`;

            return (
                <button
                    key={`${player.id}-${weapon.id}`}
                    type="button"
                    title={title}
                    onClick={() => onSelectWeapon(player.id, weapon.id)}
                    className={`min-w-0 rounded border px-0.5 py-1 text-center font-mono-tabular transition-colors select-none ${
                        active
                            ? player.id === 'P2'
                                ? 'border-sky-400 bg-sky-950/80 text-sky-200'
                                : 'border-red-500 bg-red-950/80 text-red-200'
                            : unlocked
                              ? 'border-stone-700 bg-stone-900 text-stone-300 hover:border-stone-500'
                              : 'border-stone-800 bg-stone-950/60 text-stone-600 hover:text-stone-400'
                    }`}>
                    <span className="block truncate text-[9px] font-bold">[{weapon.keyBind}]</span>
                    <span
                        className={
                            unlocked && ammoLabel === '∞'
                                ? 'block font-sans text-sm font-black leading-none text-emerald-400'
                                : 'block truncate text-[9px]'
                        }>
                        {unlocked ? ammoLabel : '--'}
                    </span>
                </button>
            );
        })}
    </div>
);

export const BattlePlayerWeaponPanel: FC<PlayerWeaponPanelProps> = (props) => {
    const { player, sandboxAllUnlocked } = props;
    const character = CHARACTERS.find((candidate) => candidate.id === player.characterId);
    const characterName = character ? getCharacterDisplay(character.id).name : player.characterId;
    const activeWeapon = getWeaponDisplay(player.currentWeapon);
    const activeAmmo = getAmmoLabel(player, player.currentWeapon, sandboxAllUnlocked);

    return (
        <section
            className={`w-full rounded-lg border p-2 flex flex-col gap-1.5 ${
                player.id === 'P2' ? 'border-sky-900/80 bg-sky-950/20' : 'border-red-900/80 bg-red-950/20'
            }`}>
            <div className="flex items-center justify-between gap-1 text-[10px]">
                <span className={`font-black ${player.id === 'P2' ? 'text-sky-400' : 'text-red-400'}`}>
                    {player.id} · {characterName}
                </span>
                <span className="font-mono-tabular text-emerald-400">
                    {player.hp}/{player.maxHp}
                </span>
            </div>

            <div className="flex items-center justify-between gap-1 border-y border-stone-800 py-1 text-[9px]">
                <span className="min-w-0 truncate font-bold text-white">{activeWeapon}</span>
                <span
                    className={
                        activeAmmo === '∞'
                            ? 'shrink-0 font-sans text-sm font-black leading-none text-emerald-400'
                            : 'shrink-0 font-mono-tabular text-amber-300'
                    }>
                    {activeAmmo}
                </span>
                <span className={`shrink-0 font-bold ${player.id === 'P2' ? 'text-sky-400' : 'text-red-400'}`}>
                    {player.combo}x
                </span>
            </div>

            <WeaponGrid {...props} />
        </section>
    );
};
