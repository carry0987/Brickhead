import * as m from '@/paraglide/messages';
import type { AIPartnerStrength } from '@/types/game';

const aiStrengthMessages: Record<AIPartnerStrength, { label: () => string; description: () => string }> = {
    LV1: { label: m.ai_level_1, description: m.ai_level_1_description },
    LV2: { label: m.ai_level_2, description: m.ai_level_2_description },
    LV3: { label: m.ai_level_3, description: m.ai_level_3_description },
    LV4: { label: m.ai_level_4, description: m.ai_level_4_description },
};

export function getAIStrengthDisplay(strength: AIPartnerStrength) {
    const messages = aiStrengthMessages[strength];
    return {
        label: messages.label(),
        description: messages.description(),
    };
}
