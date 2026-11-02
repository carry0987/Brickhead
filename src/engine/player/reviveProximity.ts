import type { PlayerEntity } from '@/types/game';
import { dist } from '@/utils/battleGeometry';
import { PLAYER_REVIVE_TUNING } from '../tuning/playerTuning';

export function findRevivingAlly(player: PlayerEntity, players: readonly PlayerEntity[]): PlayerEntity | undefined {
    const ally = players.find((other) => other.id !== player.id && !other.isDowned);
    return ally && dist(player.x, player.y, ally.x, ally.y) < PLAYER_REVIVE_TUNING.coopDistance ? ally : undefined;
}
