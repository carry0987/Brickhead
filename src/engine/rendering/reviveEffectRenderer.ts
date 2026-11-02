import type { GameMode, PlayerEntity } from '@/types/game';
import { findRevivingAlly } from '../player/reviveProximity';
import { PLAYER_REVIVE_TUNING } from '../tuning/playerTuning';
import type { WorldRenderItem, WorldVisibleBounds } from './worldRenderQueue';

export function enqueueReviveEffects(
    ctx: CanvasRenderingContext2D,
    players: readonly PlayerEntity[],
    gameMode: GameMode,
    visible: WorldVisibleBounds,
    renderQueue: WorldRenderItem[],
    now: number,
): void {
    if (gameMode !== 'COOP_2P' && gameMode !== 'COOP_AI') return;

    for (const player of players) {
        if (
            !player.isDowned ||
            player.x < visible.left ||
            player.x > visible.right ||
            player.y < visible.top ||
            player.y > visible.bottom
        ) {
            continue;
        }

        const reviving = Boolean(findRevivingAlly(player, players));
        renderQueue.push({
            sortY: player.y - 0.1,
            draw: () => {
                ctx.save();
                ctx.beginPath();
                ctx.arc(player.x, player.y, PLAYER_REVIVE_TUNING.coopDistance, 0, Math.PI * 2);
                ctx.fillStyle = reviving ? 'rgba(74, 222, 128, 0.18)' : 'rgba(251, 146, 60, 0.18)';
                ctx.fill();
                ctx.strokeStyle = reviving ? 'rgba(74, 222, 128, 0.75)' : 'rgba(251, 146, 60, 0.65)';
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.restore();
            },
        });

        if (reviving) {
            renderQueue.push({
                sortY: player.y + 0.1,
                draw: () => {
                    ctx.save();
                    ctx.strokeStyle = '#86efac';
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                    for (let i = 0; i < 3; i++) {
                        const progress = ((now + i * 400) % 1200) / 1200;
                        const x = player.x + (i - 1) * 13;
                        const y = player.y - 15 - progress * 35;
                        ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.9;
                        ctx.beginPath();
                        ctx.moveTo(x - 3, y);
                        ctx.lineTo(x + 3, y);
                        ctx.moveTo(x, y - 3);
                        ctx.lineTo(x, y + 3);
                        ctx.stroke();
                    }
                    ctx.restore();
                },
            });
        }
    }
}
