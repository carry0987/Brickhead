import type { BlastDamageMode, GameMode, RoomId, RoomSpec } from '@/types/game';
import type { BattleEngineState, RoomBounds } from '../battleTypes';

export interface CombatContext {
    st: BattleEngineState;
    floorCanvas: HTMLCanvasElement | null;
    room: RoomSpec;
    roomBounds: RoomBounds;
    roomId: RoomId;
    gameMode: GameMode;
    friendlyFire: boolean;
    explosionPlayerDamage: BlastDamageMode;
    gameSpeedMult: number;
}
