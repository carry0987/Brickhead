import { CHARACTERS } from '@/data/gameCatalog';
import { WEAPON_MAP } from '@/data/weaponCatalog';
import type { WeaponId } from '@/types/game';
import { clamp } from '@/utils/battleGeometry';
import { drawBoxheadEnemy3D, drawBoxheadHuman3D } from '@/utils/rendering/isoCharacterRenderer';
import type { BattleEngineState } from '../battleTypes';
import { ENEMY_SPECS } from '../tuning/enemyTuning';
import type { WorldRenderItem, WorldVisibleBounds } from './worldRenderQueue';

export function enqueueWorldActors(
    ctx: CanvasRenderingContext2D,
    st: BattleEngineState,
    visible: WorldVisibleBounds,
    renderQueue: WorldRenderItem[],
    now: number,
    getWeaponName: (weaponId: WeaponId) => string,
): void {
    const { left: visLeft, right: visRight, top: visTop, bottom: visBottom } = visible;
    // 2.5D Box-Rigged Dying Corpses (Straight-Backward Death Fall Animation)
    st.corpses.forEach((c) => {
        if (c.x < visLeft || c.x > visRight || c.y < visTop || c.y > visBottom) {
            return;
        }
        const age = now - c.diedAt;
        const fallProgress = clamp(age / 360, 0, 1);
        const fadeAlpha = age > c.durationMs - 250 ? clamp((c.durationMs - age) / 250, 0, 1) : 1;
        renderQueue.push({
            sortY: c.y - 4,
            draw: () => {
                drawBoxheadEnemy3D(ctx, c.x, c.y, c.angle, 0, c.kind, false, fallProgress, 0, fadeAlpha);
            },
        });
    });

    // 2.5D Box-Rigged Zombies & Red Devils
    st.enemies.forEach((en) => {
        if (en.x < visLeft || en.x > visRight || en.y < visTop || en.y > visBottom) {
            return;
        }
        const hurtProgress =
            en.hurtUntil && now < en.hurtUntil ? Math.sin(clamp((en.hurtUntil - now) / 220, 0, 1) * Math.PI) : 0;
        const isDevil = en.kind === 'devil';
        const enemySpec = ENEMY_SPECS[en.kind];
        const atkTimestamp = isDevil
            ? Math.max(en.lastFireballTime || 0, en.lastAttackTime || 0)
            : en.lastAttackTime || 0;
        const atkDuration = enemySpec.render.attackDurationMs;
        const attackProgress =
            atkTimestamp > 0 && now - atkTimestamp < atkDuration ? clamp((now - atkTimestamp) / atkDuration, 0, 1) : 0;
        const isCelebrating = st.gameOverPendingAt !== null && st.players.every((p) => p.isDowned);
        renderQueue.push({
            sortY: en.y,
            draw: () => {
                drawBoxheadEnemy3D(
                    ctx,
                    en.x,
                    en.y,
                    en.angle,
                    en.walkCycle,
                    en.kind,
                    now < en.hitFlashUntil,
                    0,
                    hurtProgress,
                    1,
                    attackProgress,
                    isCelebrating,
                );
                if (en.kind === 'devil' || en.hp < en.maxHp) {
                    const bw = enemySpec.render.hpBarWidth;
                    const topY = en.y - enemySpec.render.hpBarTopOffset;
                    ctx.fillStyle = '#18181b';
                    ctx.fillRect(en.x - bw / 2, topY, bw, 4.5);
                    ctx.fillStyle = '#dc2626';
                    ctx.fillRect(en.x - bw / 2 + 1, topY + 1, (bw - 2) * clamp(en.hp / en.maxHp, 0, 1), 2.5);
                }
            },
        });
    });

    // 2.5D Box-Rigged Players
    st.players.forEach((p) => {
        const charSpec = CHARACTERS.find((c) => c.id === p.characterId) || CHARACTERS[0];
        const isMoving = Math.hypot(p.vx, p.vy) > 0.35;
        const downedProgress = p.isDowned ? (p.downedAt ? clamp((now - p.downedAt) / 360, 0, 1) : 1) : 0;
        const hurtProgress =
            !p.isDowned && p.hurtUntil && now < p.hurtUntil
                ? Math.sin(clamp((p.hurtUntil - now) / 240, 0, 1) * Math.PI)
                : 0;
        const hasMuzzleFlash = now < p.muzzleFlashUntil;
        const totalMuzzleSpan = Math.max(1, p.muzzleFlashUntil - p.lastShotTime);
        const muzzleFlashProgress = hasMuzzleFlash ? clamp((now - p.lastShotTime) / totalMuzzleSpan, 0, 1) : 0;
        const reloadCycleMs =
            p.currentWeapon === 'rocket'
                ? 760
                : p.currentWeapon === 'railgun'
                  ? 620
                  : p.currentWeapon === 'shotgun'
                    ? 520
                    : p.currentWeapon === 'uzi'
                      ? 120
                      : 240;
        const weaponReloadProgress = p.lastShotTime > 0 ? clamp((now - p.lastShotTime) / reloadCycleMs, 0, 1) : 1;
        renderQueue.push({
            sortY: p.y,
            draw: () => {
                drawBoxheadHuman3D(
                    ctx,
                    p.x,
                    p.y,
                    p.angle,
                    p.walkCycle,
                    isMoving,
                    p.isDowned,
                    hasMuzzleFlash,
                    p.currentWeapon,
                    charSpec.skinColor,
                    charSpec.hairColor,
                    charSpec.shirtColor,
                    charSpec.pantsColor,
                    charSpec.bandanaColor,
                    charSpec.glasses,
                    charSpec.id,
                    downedProgress,
                    hurtProgress,
                    muzzleFlashProgress,
                    weaponReloadProgress,
                );
            },
        });

        // Draw floating player weapon title & HP bar on top of world geometry so walls/beams never obscure HUD labels
        renderQueue.push({
            sortY: p.y + 2000,
            draw: () => {
                const wSpec = WEAPON_MAP[p.currentWeapon];
                const ammoStr =
                    wSpec.baseMaxAmmo === -1 || st.sandboxAllUnlocked ? '' : ` (${p.ammo[p.currentWeapon]})`;

                const labelY = p.y - 50;
                ctx.save();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;
                ctx.font = '900 13.5px "Outfit", "JetBrains Mono", "Noto Sans TC", sans-serif';
                ctx.textAlign = 'center';
                const weaponName = getWeaponName(p.currentWeapon);
                const titleText =
                    st.players.length > 1 ? `${p.label}: ${weaponName}${ammoStr}` : `${weaponName}${ammoStr}`;
                ctx.lineWidth = 2.4;
                ctx.strokeStyle = '#000000';
                ctx.strokeText(titleText, p.x, labelY);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(titleText, p.x, labelY);

                const barW = 40;
                const barH = 7;
                const barX = Math.round(p.x - barW / 2);
                const barY = Math.round(labelY + 4.5);
                ctx.fillStyle = '#18181b';
                ctx.fillRect(barX, barY, barW, barH);
                ctx.fillStyle = p.hp > 35 ? '#16ef16' : '#ef4444';
                ctx.fillRect(barX + 1, barY + 1, Math.max(0, (barW - 2) * clamp(p.hp / p.maxHp, 0, 1)), barH - 2);
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1.1;
                ctx.strokeRect(barX, barY, barW, barH);
                ctx.restore();
            },
        });
    });
}
