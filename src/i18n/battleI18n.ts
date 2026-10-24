import type { GameplayTipId } from '@/data/gameplayTips';
import * as m from '@/paraglide/messages';

interface GameplayTipMessageSet {
    category: () => string;
    title: () => string;
    keyHint: () => string;
    body: () => string;
}

const gameplayTipMessages: Record<GameplayTipId, GameplayTipMessageSet> = {
    controls: {
        category: m.tip_controls_category,
        title: m.tip_controls_title,
        keyHint: m.tip_controls_key,
        body: m.tip_controls_body,
    },
    combo: {
        category: m.tip_combo_category,
        title: m.tip_combo_title,
        keyHint: m.tip_combo_key,
        body: m.tip_combo_body,
    },
    choke_point: {
        category: m.tip_choke_category,
        title: m.tip_choke_title,
        keyHint: m.tip_choke_key,
        body: m.tip_choke_body,
    },
    red_devil: {
        category: m.tip_devil_category,
        title: m.tip_devil_title,
        keyHint: m.tip_devil_key,
        body: m.tip_devil_body,
    },
    supply: {
        category: m.tip_supply_category,
        title: m.tip_supply_title,
        keyHint: m.tip_supply_key,
        body: m.tip_supply_body,
    },
    coop: {
        category: m.tip_coop_category,
        title: m.tip_coop_title,
        keyHint: m.tip_coop_key,
        body: m.tip_coop_body,
    },
};

export function getGameplayTipDisplay(tipId: GameplayTipId) {
    const display = gameplayTipMessages[tipId];
    return {
        category: display.category(),
        title: display.title(),
        keyHint: display.keyHint(),
        body: display.body(),
    };
}
