import type { BattleEngineState } from '../battleTypes';

export function renderWorldDebugOverlay(ctx: CanvasRenderingContext2D, st: BattleEngineState): void {
    if (!st.debugPathfinding) return;

    ctx.save();

    const aiPlayer = st.players.find((pl) => pl.isAI && !pl.isDowned);
    const aiDebug = st.aiDebugTelemetry;
    if (aiPlayer && aiDebug) {
        ctx.save();
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(aiPlayer.x, aiPlayer.y, aiDebug.senseRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        if (aiDebug.pathPoints.length >= 2) {
            ctx.save();
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2.2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(aiDebug.pathPoints[0].x, aiDebug.pathPoints[0].y);
            for (let k = 1; k < aiDebug.pathPoints.length; k++) {
                ctx.lineTo(aiDebug.pathPoints[k].x, aiDebug.pathPoints[k].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            for (let k = 1; k < aiDebug.pathPoints.length - 1; k++) {
                ctx.fillStyle = '#e879f9';
                ctx.beginPath();
                ctx.arc(aiDebug.pathPoints[k].x, aiDebug.pathPoints[k].y, 2.2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        ctx.save();
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(aiDebug.goalX, aiDebug.goalY, 7, 0, Math.PI * 2);
        ctx.moveTo(aiDebug.goalX - 10, aiDebug.goalY);
        ctx.lineTo(aiDebug.goalX + 10, aiDebug.goalY);
        ctx.moveTo(aiDebug.goalX, aiDebug.goalY - 10);
        ctx.lineTo(aiDebug.goalX, aiDebug.goalY + 10);
        ctx.stroke();

        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        const badgeW = ctx.measureText(`AI: ${aiDebug.goalLabel}`).width + 8;
        ctx.fillRect(aiPlayer.x - badgeW / 2, aiPlayer.y + 16, badgeW, 13);
        ctx.fillStyle = '#e879f9';
        ctx.fillText(`AI: ${aiDebug.goalLabel}`, aiPlayer.x, aiPlayer.y + 25.5);
        ctx.restore();
    }

    for (let i = 0; i < st.enemies.length; i++) {
        const en = st.enemies[i];
        const navMode = en.debugNavMode || 'DIRECT_LOS';
        const isDevil = en.kind === 'devil';
        const strokeColor =
            navMode === 'FALLBACK_NO_PATH'
                ? '#ef4444'
                : navMode === 'DIRECT_LOS'
                  ? '#22c55e'
                  : isDevil
                    ? '#f59e0b'
                    : '#38bdf8';

        const pts = en.debugPathPoints;
        if (pts && pts.length >= 2) {
            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.globalAlpha = navMode === 'DIRECT_LOS' ? 0.55 : 0.85;
            ctx.lineWidth = isDevil ? 2.2 : 1.5;
            if (navMode === 'FALLBACK_NO_PATH') {
                ctx.setLineDash([3, 3]);
            }
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let k = 1; k < pts.length; k++) {
                ctx.lineTo(pts[k].x, pts[k].y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            if (navMode === 'FLOW_FIELD') {
                ctx.fillStyle = strokeColor;
                for (let k = 1; k < pts.length - 1; k++) {
                    ctx.beginPath();
                    ctx.arc(pts[k].x, pts[k].y, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }

        if (en.debugTargetX !== undefined && en.debugTargetY !== undefined) {
            ctx.save();
            ctx.strokeStyle = strokeColor;
            ctx.globalAlpha = 0.7;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.arc(en.debugTargetX, en.debugTargetY, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        if (en.debugWallHit) {
            ctx.save();
            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(en.x, en.y, en.radius + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        const steerAng = en.debugDesiredAngle ?? en.angle;
        const arrowLen = en.radius + 12;
        const ax = en.x + Math.cos(steerAng) * arrowLen;
        const ay = en.y + Math.sin(steerAng) * arrowLen;
        ctx.save();
        ctx.strokeStyle = '#fde047';
        ctx.fillStyle = '#fde047';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(en.x, en.y);
        ctx.lineTo(ax, ay);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - Math.cos(steerAng - 0.45) * 5, ay - Math.sin(steerAng - 0.45) * 5);
        ctx.lineTo(ax - Math.cos(steerAng + 0.45) * 5, ay - Math.sin(steerAng + 0.45) * 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const tagText =
            navMode === 'FALLBACK_NO_PATH'
                ? 'NO PATH!'
                : navMode === 'DIRECT_LOS'
                  ? 'LOS'
                  : `FLOW:${en.debugFlowDist ?? '?'}`;
        ctx.fillStyle = 'rgba(9, 9, 11, 0.82)';
        const tw = ctx.measureText(tagText).width + 6;
        ctx.fillRect(en.x - tw / 2, en.y + en.radius + 2, tw, 10.5);
        ctx.fillStyle = strokeColor;
        ctx.fillText(tagText, en.x, en.y + en.radius + 9.8);
        ctx.restore();
    }

    ctx.restore();
}
