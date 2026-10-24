import type { BBAssetId } from '@/data/bbmodelCatalog';
import * as m from '@/paraglide/messages';
import type { BuiltInRoomId, CharacterId, ComboPerkMilestone, RoomId, UpgradeEffectType, WeaponId } from '@/types/game';

interface RoomMessageSet {
    name: () => string;
    subtitle: () => string;
    description: () => string;
}

const characterMessages: Record<CharacterId, { name: () => string; subtitle: () => string }> = {
    bambo: { name: m.character_bambo_name, subtitle: m.character_bambo_subtitle },
    bind: { name: m.character_bind_name, subtitle: m.character_bind_subtitle },
    bert: { name: m.character_bert_name, subtitle: m.character_bert_subtitle },
    sakamoto: { name: m.character_sakamoto_name, subtitle: m.character_sakamoto_subtitle },
};

const weaponMessages: Record<WeaponId, () => string> = {
    pistol: m.weapon_pistol_name,
    uzi: m.weapon_uzi_name,
    shotgun: m.weapon_shotgun_name,
    barrel: m.weapon_barrel_name,
    grenade: m.weapon_grenade_name,
    wall: m.weapon_wall_name,
    mine: m.weapon_mine_name,
    rocket: m.weapon_rocket_name,
    charge_pack: m.weapon_charge_pack_name,
    railgun: m.weapon_railgun_name,
};

const weaponDescriptionMessages: Record<WeaponId, () => string> = {
    pistol: m.weapon_pistol_description,
    uzi: m.weapon_uzi_description,
    shotgun: m.weapon_shotgun_description,
    barrel: m.weapon_barrel_description,
    grenade: m.weapon_grenade_description,
    wall: m.weapon_wall_description,
    mine: m.weapon_mine_description,
    rocket: m.weapon_rocket_description,
    charge_pack: m.weapon_charge_pack_description,
    railgun: m.weapon_railgun_description,
};

const upgradeMessages: Record<Exclude<UpgradeEffectType, 'UNLOCK'>, () => string> = {
    FAST_FIRE: m.upgrade_fast_fire,
    RAPID_FIRE: m.upgrade_rapid_fire,
    DOUBLE_DAMAGE: m.upgrade_double_damage,
    QUAD_DAMAGE: m.upgrade_quad_damage,
    DOUBLE_AMMO: m.upgrade_double_ammo,
    QUAD_AMMO: m.upgrade_quad_ammo,
    LONG_SHOT: m.upgrade_long_shot,
    INFINITE_RANGE: m.upgrade_infinite_range,
    WIDE_SHOT: m.upgrade_wide_shot,
    WIDER_SHOT: m.upgrade_wider_shot,
    BIG_BANG: m.upgrade_big_bang,
    BIGGER_BANG: m.upgrade_bigger_bang,
    CLUSTER: m.upgrade_cluster,
};

const weaponKeys: Record<WeaponId, string> = {
    pistol: '1',
    uzi: '2',
    shotgun: '3',
    barrel: '4',
    grenade: '5',
    wall: '6',
    mine: '7',
    rocket: '8',
    charge_pack: '9',
    railgun: '0',
};

const roomMessages: Record<BuiltInRoomId, RoomMessageSet> = {
    room_01: { name: m.room_01_name, subtitle: m.room_01_subtitle, description: m.room_01_description },
    room_02: { name: m.room_02_name, subtitle: m.room_02_subtitle, description: m.room_02_description },
    room_03: { name: m.room_03_name, subtitle: m.room_03_subtitle, description: m.room_03_description },
    room_04: { name: m.room_04_name, subtitle: m.room_04_subtitle, description: m.room_04_description },
    room_05: { name: m.room_05_name, subtitle: m.room_05_subtitle, description: m.room_05_description },
    room_06: { name: m.room_06_name, subtitle: m.room_06_subtitle, description: m.room_06_description },
    room_07: { name: m.room_07_name, subtitle: m.room_07_subtitle, description: m.room_07_description },
    room_08: { name: m.room_08_name, subtitle: m.room_08_subtitle, description: m.room_08_description },
    room_09: { name: m.room_09_name, subtitle: m.room_09_subtitle, description: m.room_09_description },
    room_10: { name: m.room_10_name, subtitle: m.room_10_subtitle, description: m.room_10_description },
    room_11: { name: m.room_11_name, subtitle: m.room_11_subtitle, description: m.room_11_description },
    room_12: { name: m.room_12_name, subtitle: m.room_12_subtitle, description: m.room_12_description },
    room_13: { name: m.room_13_name, subtitle: m.room_13_subtitle, description: m.room_13_description },
    room_14: { name: m.room_14_name, subtitle: m.room_14_subtitle, description: m.room_14_description },
    room_15: { name: m.room_15_name, subtitle: m.room_15_subtitle, description: m.room_15_description },
    room_16: { name: m.room_16_name, subtitle: m.room_16_subtitle, description: m.room_16_description },
    room_17: { name: m.room_17_name, subtitle: m.room_17_subtitle, description: m.room_17_description },
    room_18: { name: m.room_18_name, subtitle: m.room_18_subtitle, description: m.room_18_description },
};

const bbModelMessages: Record<BBAssetId, () => string> = {
    bambo: m.character_bambo_name,
    bind: m.character_bind_name,
    bert: m.character_bert_name,
    sakamoto: m.character_sakamoto_name,
    zombie: m.model_zombie_name,
    fast_zombie: m.model_fast_zombie_name,
    devil: m.model_devil_name,
    pistol: m.weapon_pistol_name,
    uzi: m.weapon_uzi_name,
    shotgun: m.weapon_shotgun_name,
    barrel: m.weapon_barrel_name,
    grenade: m.weapon_grenade_name,
    wall: m.weapon_wall_name,
    mine: m.weapon_mine_name,
    rocket: m.weapon_rocket_name,
    charge_pack: m.weapon_charge_pack_name,
    railgun: m.weapon_railgun_name,
    red_box: m.model_red_box_name,
};

export function getCharacterDisplay(characterId: CharacterId) {
    const display = characterMessages[characterId];
    return {
        name: display.name(),
        subtitle: display.subtitle(),
    };
}

export function getWeaponDisplay(weaponId: WeaponId): string {
    return weaponMessages[weaponId]();
}

export function getWeaponDetails(weaponId: WeaponId) {
    return {
        name: weaponMessages[weaponId](),
        description: weaponDescriptionMessages[weaponId](),
    };
}

export function getComboMilestoneDisplay(milestone: ComboPerkMilestone) {
    const weapon = getWeaponDisplay(milestone.weaponId);
    const title =
        milestone.effectType === 'UNLOCK'
            ? m.milestone_unlock({ weapon, key: weaponKeys[milestone.weaponId] })
            : m.milestone_upgrade({ weapon, upgrade: upgradeMessages[milestone.effectType]() });
    return {
        title,
        summary: (player: string) => m.milestone_summary({ player, combo: milestone.combo, title }),
    };
}

export function getRoomDisplay(roomId: RoomId) {
    const display = roomMessages[roomId as BuiltInRoomId];
    if (!display) {
        throw new Error(`Missing localized room display for "${roomId}"`);
    }

    return {
        name: display.name(),
        subtitle: display.subtitle(),
        description: display.description(),
    };
}

export function getBBModelDisplay(assetId: BBAssetId): string {
    return bbModelMessages[assetId]();
}
