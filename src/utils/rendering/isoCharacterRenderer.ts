import { type BBBoneName, BBMODEL_CATALOG, type CompiledBBModel, sampleBBAnimationClip } from '@/data/bbmodelCatalog';
import type { CharacterId, WeaponId } from '@/types/game';
import { drawAnimatedWeaponMuzzleSVG } from '../svgEffectRenderer';
import {
    ISO_Z_SCALE,
    renderSkeletalBBModel,
    type SkeletalPoseMap,
    shadeHex,
    tryDrawCustomSprite,
} from './isoModelRenderer';

const Y_PERSP = 0.86;

export function drawRotatedBox3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    zBottom: number,
    lenForward: number,
    widthSide: number,
    heightZ: number,
    angle: number,
    baseColor: string,
    outlineColor: string = '#09090b',
    outlineWidth: number = 2.0,
) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const hw = lenForward / 2;
    const hd = widthSide / 2;

    const corners = [
        { lx: hw, ly: hd },
        { lx: hw, ly: -hd },
        { lx: -hw, ly: -hd },
        { lx: -hw, ly: hd },
    ];

    const zTopOffset = (zBottom + heightZ) * ISO_Z_SCALE;
    const zBotOffset = zBottom * ISO_Z_SCALE;

    const topPts = corners.map((c) => ({
        x: cx + (c.lx * cos - c.ly * sin),
        y: cy + (c.lx * sin + c.ly * cos) * Y_PERSP - zTopOffset,
    }));

    const botPts = corners.map((c) => ({
        x: cx + (c.lx * cos - c.ly * sin),
        y: cy + (c.lx * sin + c.ly * cos) * Y_PERSP - zBotOffset,
    }));

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = outlineWidth;
    ctx.strokeStyle = outlineColor;

    for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        const p1 = topPts[i];
        const p2 = topPts[next];
        const b2 = botPts[next];
        const b1 = botPts[i];

        const edgeDx = p1.x - p2.x;
        if (edgeDx > -0.5) {
            const edgeDy = p2.y - p1.y;
            const shadeFactor = edgeDy > 0 ? 0.9 : 0.72;
            ctx.fillStyle = shadeHex(baseColor, shadeFactor);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(b2.x, b2.y);
            ctx.lineTo(b1.x, b1.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }

    ctx.fillStyle = shadeHex(baseColor, 1.07);
    ctx.beginPath();
    ctx.moveTo(topPts[0].x, topPts[0].y);
    ctx.lineTo(topPts[1].x, topPts[1].y);
    ctx.lineTo(topPts[2].x, topPts[2].y);
    ctx.lineTo(topPts[3].x, topPts[3].y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    return { topPts, botPts };
}

/**
 * Renders a Human Character (`bambo`, `bind`, `bert`, `sakamoto`) using its
 * skeletal-rigged `.bbmodel`, attaches the active weapon `.bbmodel` to `weapon_mount_bone`,
 * and renders a distinct per-weapon muzzle flash / throw / placement animation!
 */
export function drawBoxheadHuman3D(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    walkCycle: number,
    isMoving: boolean,
    isDowned: boolean,
    hasMuzzleFlash: boolean,
    weaponId: string,
    _skinColor: string,
    _hairColor: string,
    _shirtColor: string,
    _pantsColor: string,
    _bandanaColor?: string,
    _glasses?: boolean,
    characterId: CharacterId = 'bambo',
    downedProgress: number = 1,
    hurtProgress: number = 0,
    muzzleFlashProgress: number = 0,
    weaponReloadProgress: number = 1,
) {
    if (!isDowned && tryDrawCustomSprite(ctx, characterId, x, y, angle, walkCycle, isMoving, 56, false)) {
        return;
    }

    const model = BBMODEL_CATALOG[characterId] || BBMODEL_CATALOG.bambo;

    if (isDowned) {
        // Straight-backward fall death animation:
        // Negative pitchX around the feet origin [0,0,0] rotates +Y into -Z (straight behind the character's facing direction)
        const p = Math.max(0, Math.min(1, downedProgress));
        const fallCurve = 0.25 * p + 0.75 * p * p;
        const backTiltPitch = -fallCurve * 1.52;
        const liftY = Math.sin(fallCurve * 1.52) * 4.2;
        const armOut = (1 - p * 0.45) * 0.55;

        const backCos = -Math.cos(angle);
        const backSin = -Math.sin(angle);
        const shadowShift = fallCurve * 14;

        ctx.fillStyle = 'rgba(45, 32, 18, 0.36)';
        ctx.beginPath();
        ctx.ellipse(
            x - 4 + backCos * shadowShift,
            y + 4 + backSin * shadowShift * Y_PERSP,
            14 + fallCurve * 6,
            8.5 + fallCurve * 2.5,
            angle,
            0,
            Math.PI * 2,
        );
        ctx.fill();

        renderSkeletalBBModel(ctx, model, x, y, angle, {
            root: {
                pitchX: backTiltPitch,
                yawY: 0,
                rollZ: 0,
                tx: 0,
                ty: liftY,
                tz: 0,
            },
            body_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
            head_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
            left_leg_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
            left_knee_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
            right_leg_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
            right_knee_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
            left_arm_bone: {
                pitchX: -0.28 * armOut,
                yawY: -0.22 * armOut,
                rollZ: -0.15 * armOut,
                tx: 0,
                ty: 0,
                tz: 2.2 * armOut,
            },
            left_forearm_bone: {
                pitchX: -0.18 * armOut,
                yawY: 0,
                rollZ: 0,
                tx: 0,
                ty: 0,
                tz: 1.2 * armOut,
            },
            right_arm_bone: {
                pitchX: -0.28 * armOut,
                yawY: 0.22 * armOut,
                rollZ: 0.15 * armOut,
                tx: 0,
                ty: 0,
                tz: 2.2 * armOut,
            },
            right_forearm_bone: {
                pitchX: -0.18 * armOut,
                yawY: 0,
                rollZ: 0,
                tx: 0,
                ty: 0,
                tz: 1.2 * armOut,
            },
        });
        return;
    }

    // Ground Shadow
    ctx.fillStyle = 'rgba(45, 32, 18, 0.36)';
    ctx.beginPath();
    ctx.ellipse(x - 4, y + 4, 14, 8.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const isUnarmed = !weaponId || weaponId === 'none';
    const wKey = weaponId as WeaponId;
    const isPlaceable = wKey === 'barrel' || wKey === 'wall' || wKey === 'mine' || wKey === 'charge_pack';
    const isThrown = wKey === 'grenade';
    const isFirearm = !isUnarmed && !isPlaceable && !isThrown;

    // Compute natural skeletal joint rotations from walkCycle & weapon-specific action (NO vertical bobbing!)
    const s = isMoving ? Math.sin(walkCycle) : 0;
    const hipAngle = s * 0.62;
    const leftKneeBend = isMoving ? -Math.max(0, -s) * 0.52 : 0;
    const rightKneeBend = isMoving ? -Math.max(0, s) * 0.52 : 0;

    // Hit reaction with both arms extending slightly.
    const hurtAmt = Math.max(0, Math.min(1, hurtProgress));

    // Base character locomotion & hit-reaction skeletal pose
    const pose: SkeletalPoseMap = {
        body_bone: {
            pitchX: (isMoving ? 0.04 : 0) - 0.1 * hurtAmt,
            yawY: isMoving ? s * 0.06 : 0,
            rollZ: 0,
            tx: 0,
            ty: 0,
            tz: 0,
        },
        head_bone: {
            pitchX: -0.06 * hurtAmt,
            yawY: isMoving ? -s * 0.04 : 0,
            rollZ: 0,
            tx: 0,
            ty: 0,
            tz: 0,
        },
        left_leg_bone: {
            pitchX: hipAngle,
            yawY: 0,
            rollZ: 0,
            tx: 0,
            ty: 0,
            tz: 0,
        },
        left_knee_bone: {
            pitchX: leftKneeBend,
            yawY: 0,
            rollZ: 0,
            tx: 0,
            ty: 0,
            tz: 0,
        },
        right_leg_bone: {
            pitchX: -hipAngle,
            yawY: 0,
            rollZ: 0,
            tx: 0,
            ty: 0,
            tz: 0,
        },
        right_knee_bone: {
            pitchX: rightKneeBend,
            yawY: 0,
            rollZ: 0,
            tx: 0,
            ty: 0,
            tz: 0,
        },
        left_arm_bone: {
            pitchX: -s * 0.24 - 0.34 * hurtAmt,
            yawY: -0.26 * hurtAmt,
            rollZ: -0.18 * hurtAmt,
            tx: 0,
            ty: 0,
            tz: 2.8 * hurtAmt,
        },
        left_forearm_bone: {
            pitchX: -0.22 * hurtAmt,
            yawY: 0,
            rollZ: 0,
            tx: 0,
            ty: 0,
            tz: 1.6 * hurtAmt,
        },
        right_arm_bone: {
            pitchX: (isUnarmed ? s * 0.24 : wKey === 'rocket' ? s * 0.04 : s * 0.14) - 0.34 * hurtAmt,
            yawY: 0.26 * hurtAmt,
            rollZ: 0.18 * hurtAmt,
            tx: 0,
            ty: 0,
            tz: 2.8 * hurtAmt,
        },
        right_forearm_bone: {
            pitchX: -0.22 * hurtAmt,
            yawY: 0,
            rollZ: 0,
            tx: 0,
            ty: 0,
            tz: 1.6 * hurtAmt,
        },
        weapon_slide_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
        weapon_pump_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
        weapon_warhead_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
        weapon_breech_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
        weapon_coil_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
    };

    // Sample weapon/equipment animations directly from its .bbmodel `animations` array (none when unarmed)!
    const activeWeaponAsset = isUnarmed ? undefined : BBMODEL_CATALOG[wKey] || BBMODEL_CATALOG.pistol;

    // Horizontal-only shoulder recoil kickback when firing the shoulder-mounted Rocket Launcher (no upward pitch tilt)
    if (wKey === 'rocket' && hasMuzzleFlash) {
        const kickBack = Math.sin(Math.max(0, Math.min(1, muzzleFlashProgress)) * Math.PI);
        const rightArm = pose.right_arm_bone;
        if (rightArm) rightArm.tz = (rightArm.tz || 0) - kickBack * 1.8;
    }

    const blendClipIntoPose = (
        clipPose: ReturnType<typeof sampleBBAnimationClip>,
        mode: 'FIRE' | 'RELOAD' | 'GRIP',
    ) => {
        for (const [bKey, delta] of Object.entries(clipPose)) {
            if (!delta) continue;
            const boneName = bKey as BBBoneName;

            // For firearms, weapon_mount_bone in the weapon .bbmodel drives the character's right arm recoil/chambering tilt
            if (isFirearm && boneName === 'weapon_mount_bone') {
                const ra = pose.right_arm_bone;
                const rfa = pose.right_forearm_bone;
                const la = pose.left_arm_bone;
                if (!ra || !rfa || !la) continue;
                ra.pitchX += delta.pitchX * 0.85;
                ra.rollZ += delta.rollZ * 0.5;
                ra.tz = (ra.tz || 0) + delta.tz * 0.85;
                rfa.pitchX += delta.pitchX * 0.55;
                rfa.rollZ += delta.rollZ * 0.5;
                if (mode === 'FIRE') {
                    la.pitchX += delta.pitchX * 0.45;
                    la.tz = (la.tz || 0) + delta.tz * 0.45;
                }
                continue;
            }

            const isMechanicalSubBone =
                boneName === 'weapon_pump_bone' ||
                boneName === 'weapon_slide_bone' ||
                boneName === 'weapon_warhead_bone' ||
                boneName === 'weapon_breech_bone' ||
                boneName === 'weapon_coil_bone';

            const cur =
                mode === 'RELOAD' && isMechanicalSubBone
                    ? { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 }
                    : pose[boneName] || {
                          pitchX: 0,
                          yawY: 0,
                          rollZ: 0,
                          tx: 0,
                          ty: 0,
                          tz: 0,
                      };
            pose[boneName] = {
                pitchX: cur.pitchX + delta.pitchX,
                yawY: cur.yawY + delta.yawY,
                rollZ: cur.rollZ + delta.rollZ,
                tx: (cur.tx || 0) + delta.tx,
                ty: (cur.ty || 0) + delta.ty,
                tz: (cur.tz || 0) + delta.tz,
            };

            // Sync the character's left supporting hand with the weapon's moving mechanical sub-bone during reload (excluding rocket warhead)
            if (
                isFirearm &&
                mode === 'RELOAD' &&
                (boneName === 'weapon_pump_bone' || boneName === 'weapon_slide_bone' || boneName === 'weapon_coil_bone')
            ) {
                const subPullRatio = Math.min(1, Math.hypot(delta.tx, delta.ty, delta.tz) / 2.6);
                const leftArm = pose.left_arm_bone;
                const leftForearm = pose.left_forearm_bone;
                if (!leftArm || !leftForearm) continue;
                leftArm.pitchX += -0.24 * subPullRatio;
                leftArm.yawY += 0.28 * subPullRatio;
                leftArm.tz = (leftArm.tz || 0) + delta.tz * 0.45;
                leftForearm.pitchX += -0.26 * subPullRatio;
                leftForearm.yawY += 0.18 * subPullRatio;
                leftForearm.tz = (leftForearm.tz || 0) + delta.tz * 0.35;
            }
        }
    };

    if (activeWeaponAsset?.animations) {
        if (activeWeaponAsset.animations['animation.boxhead.grip']) {
            blendClipIntoPose(sampleBBAnimationClip(activeWeaponAsset.animations['animation.boxhead.grip'], 0), 'GRIP');
        }

        // Firing recoil / grenade throw / tactical placement animation (0..1 muzzleFlashProgress)
        if (hasMuzzleFlash && activeWeaponAsset.animations['animation.boxhead.fire']) {
            blendClipIntoPose(
                sampleBBAnimationClip(activeWeaponAsset.animations['animation.boxhead.fire'], muzzleFlashProgress),
                'FIRE',
            );
        }

        // Mechanical sub-bone & left-hand chambering/reload animation (0..1 weaponReloadProgress)
        if (weaponReloadProgress < 1 && activeWeaponAsset.animations['animation.boxhead.reload']) {
            blendClipIntoPose(
                sampleBBAnimationClip(activeWeaponAsset.animations['animation.boxhead.reload'], weaponReloadProgress),
                'RELOAD',
            );
        }
    }

    // Mount the equipped firearm .bbmodel onto the character's right hand bone (none when unarmed or placing tactical items/grenades)
    const attachedWeaponModel: CompiledBBModel | undefined = isFirearm ? activeWeaponAsset : undefined;

    const isFacingNorth = Math.sin(angle) < -0.35;

    if (hasMuzzleFlash && isFacingNorth) {
        drawAnimatedWeaponMuzzleSVG(ctx, x, y, angle, wKey, muzzleFlashProgress);
    }

    renderSkeletalBBModel(ctx, model, x, y, angle, pose, {
        attachedWeaponModel,
    });

    // Unified Animated SVG Muzzle / Throw / Placement Effect!
    if (hasMuzzleFlash && !isFacingNorth) {
        drawAnimatedWeaponMuzzleSVG(ctx, x, y, angle, wKey, muzzleFlashProgress);
    }
}

/**
 * Renders a Zombie (`zombie`, `fast_zombie`) or Giant Red Devil Boss (`devil`)
 * using its skeletal-rigged `.bbmodel` with hip, knee, shoulder, and elbow articulation,
 * arm-extension hit reaction, and straight-backward death fall animation!
 */
export function drawBoxheadEnemy3D(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    walkCycle: number,
    kind: 'zombie' | 'fast_zombie' | 'devil',
    isFlashing: boolean,
    downedProgress: number = 0,
    hurtProgress: number = 0,
    alpha: number = 1,
    attackProgress: number = 0,
    isCelebrating: boolean = false,
) {
    const isDevil = kind === 'devil';
    if (
        downedProgress <= 0 &&
        tryDrawCustomSprite(ctx, kind, x, y, angle, walkCycle, true, isDevil ? 78 : 54, isFlashing)
    ) {
        return;
    }

    const model = BBMODEL_CATALOG[kind];
    const shadowScale = isDevil ? 1.42 : 1.0;

    if (downedProgress > 0) {
        // Straight-backward fall death animation:
        // Negative pitchX around root [0,0,0] rotates +Y into -Z (straight backward)
        const p = Math.max(0, Math.min(1, downedProgress));
        const fallCurve = 0.25 * p + 0.75 * p * p;
        const backTiltPitch = -fallCurve * 1.52;
        const liftY = Math.sin(fallCurve * 1.52) * (isDevil ? 5.2 : 4.2);
        const armOut = (1 - p * 0.4) * 0.65;

        const backCos = -Math.cos(angle);
        const backSin = -Math.sin(angle);
        const shadowShift = fallCurve * (isDevil ? 19 : 14);

        ctx.save();
        if (alpha < 1) {
            ctx.globalAlpha = Math.max(0, alpha);
        }

        ctx.fillStyle = 'rgba(45, 32, 18, 0.36)';
        ctx.beginPath();
        ctx.ellipse(
            x - 4 * shadowScale + backCos * shadowShift,
            y + 4 * shadowScale + backSin * shadowShift * Y_PERSP,
            (13.5 + fallCurve * 6) * shadowScale,
            (8.2 + fallCurve * 2.5) * shadowScale,
            angle,
            0,
            Math.PI * 2,
        );
        ctx.fill();

        renderSkeletalBBModel(
            ctx,
            model,
            x,
            y,
            angle,
            {
                root: {
                    pitchX: backTiltPitch,
                    yawY: 0,
                    rollZ: 0,
                    tx: 0,
                    ty: liftY,
                    tz: 0,
                },
                body_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
                head_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
                left_leg_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
                left_knee_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
                right_leg_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
                right_knee_bone: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
                left_arm_bone: {
                    pitchX: (isDevil ? -0.55 : -0.32) * armOut,
                    yawY: -0.22 * armOut,
                    rollZ: -0.18 * armOut,
                    tx: 0,
                    ty: 0,
                    tz: 2.4 * armOut,
                },
                left_forearm_bone: {
                    pitchX: -0.22 * armOut,
                    yawY: 0,
                    rollZ: 0,
                    tx: 0,
                    ty: 0,
                    tz: 1.4 * armOut,
                },
                right_arm_bone: {
                    pitchX: (isDevil ? -0.55 : -0.32) * armOut,
                    yawY: 0.22 * armOut,
                    rollZ: 0.18 * armOut,
                    tx: 0,
                    ty: 0,
                    tz: 2.4 * armOut,
                },
                right_forearm_bone: {
                    pitchX: -0.22 * armOut,
                    yawY: 0,
                    rollZ: 0,
                    tx: 0,
                    ty: 0,
                    tz: 1.4 * armOut,
                },
            },
            { isFlashing },
        );

        ctx.restore();
        return;
    }

    ctx.fillStyle = 'rgba(45, 32, 18, 0.36)';
    ctx.beginPath();
    ctx.ellipse(x - 4 * shadowScale, y + 4 * shadowScale, 13.5 * shadowScale, 8.2 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    const s = Math.sin(walkCycle);
    const c = Math.cos(walkCycle);

    // Victory and game-over celebration with both arms raised:
    // When all players are downed and waiting for the Game Over screen, zombies & devils
    // raise both arms high overhead and wave them back and forth energetically!
    if (isCelebrating) {
        const waveFastS = Math.sin(walkCycle * 2.2);
        const waveFastC = Math.cos(walkCycle * 2.2);
        const cheerBobY = Math.abs(waveFastS) * (isDevil ? 2.4 : 1.8);

        const celebratePose: SkeletalPoseMap = isDevil
            ? {
                  root: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: cheerBobY, tz: 0 },
                  body_bone: {
                      pitchX: -0.08 + waveFastC * 0.08,
                      yawY: waveFastS * 0.18,
                      rollZ: waveFastS * 0.14,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
                  head_bone: {
                      pitchX: -0.14 + waveFastS * 0.1,
                      yawY: -waveFastS * 0.15,
                      rollZ: waveFastC * 0.12,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
                  left_leg_bone: {
                      pitchX: waveFastS * 0.28,
                      yawY: 0,
                      rollZ: -0.08,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
                  left_knee_bone: { pitchX: -Math.max(0, -waveFastS) * 0.35, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
                  right_leg_bone: {
                      pitchX: -waveFastS * 0.28,
                      yawY: 0,
                      rollZ: 0.08,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
                  right_knee_bone: { pitchX: -Math.max(0, waveFastS) * 0.35, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
                  // Devil's arms hang down (-Y) in rest pose; pitchX ≈ -2.85 rad raises them straight overhead (+Y)
                  left_arm_bone: {
                      pitchX: -2.82 + waveFastS * 0.42,
                      yawY: waveFastC * 0.35,
                      rollZ: -0.32 + waveFastS * 0.45,
                      tx: 0,
                      ty: 1.5,
                      tz: 0,
                  },
                  left_forearm_bone: {
                      pitchX: -0.25 + waveFastC * 0.38,
                      yawY: 0,
                      rollZ: waveFastS * 0.3,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
                  right_arm_bone: {
                      pitchX: -2.82 - waveFastS * 0.42,
                      yawY: -waveFastC * 0.35,
                      rollZ: 0.32 + waveFastS * 0.45,
                      tx: 0,
                      ty: 1.5,
                      tz: 0,
                  },
                  right_forearm_bone: {
                      pitchX: -0.25 - waveFastC * 0.38,
                      yawY: 0,
                      rollZ: waveFastS * 0.3,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
              }
            : {
                  root: { pitchX: 0, yawY: 0, rollZ: 0, tx: 0, ty: cheerBobY, tz: 0 },
                  body_bone: {
                      pitchX: -0.1 + waveFastC * 0.08,
                      yawY: waveFastS * 0.2,
                      rollZ: waveFastS * 0.16,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
                  head_bone: {
                      pitchX: -0.16 + waveFastS * 0.12,
                      yawY: -waveFastS * 0.16,
                      rollZ: waveFastC * 0.14,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
                  left_leg_bone: {
                      pitchX: waveFastS * 0.32,
                      yawY: 0,
                      rollZ: -0.06,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
                  left_knee_bone: { pitchX: -Math.max(0, -waveFastS) * 0.38, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
                  right_leg_bone: {
                      pitchX: -waveFastS * 0.32,
                      yawY: 0,
                      rollZ: 0.06,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
                  right_knee_bone: { pitchX: -Math.max(0, waveFastS) * 0.38, yawY: 0, rollZ: 0, tx: 0, ty: 0, tz: 0 },
                  // Zombie's arms extend forward (+Z) in rest pose; pitchX ≈ -1.42 rad raises both arms straight overhead (+Y)
                  left_arm_bone: {
                      pitchX: -1.42 + waveFastS * 0.46,
                      yawY: -0.25 + waveFastC * 0.38,
                      rollZ: -0.28 + waveFastS * 0.44,
                      tx: 0,
                      ty: 1.8,
                      tz: 0,
                  },
                  left_forearm_bone: {
                      pitchX: -0.22 + waveFastC * 0.42,
                      yawY: 0,
                      rollZ: waveFastS * 0.32,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
                  right_arm_bone: {
                      pitchX: -1.42 - waveFastS * 0.46,
                      yawY: 0.25 - waveFastC * 0.38,
                      rollZ: 0.28 + waveFastS * 0.44,
                      tx: 0,
                      ty: 1.8,
                      tz: 0,
                  },
                  right_forearm_bone: {
                      pitchX: -0.22 - waveFastC * 0.42,
                      yawY: 0,
                      rollZ: waveFastS * 0.32,
                      tx: 0,
                      ty: 0,
                      tz: 0,
                  },
              };

        renderSkeletalBBModel(ctx, model, x, y, angle, celebratePose, {
            isFlashing,
        });
        return;
    }

    const hipSwing = s * (isDevil ? 0.52 : 0.58);
    const leftKnee = -Math.max(0, -s) * 0.48;
    const rightKnee = -Math.max(0, s) * 0.48;

    // Hit reaction with both arms extending slightly.
    const hurtAmt = Math.max(0, Math.min(1, hurtProgress));
    const atkP = Math.max(0, Math.min(1, attackProgress));

    // 1. Devil fireball throw with both hands thrust forward to half height:
    // Devil's arms hang vertically (-Y); negative pitchX (-1.42 rad ≈ 81°) swings both arms from bottom up-and-forward to horizontal half-height!
    let devilFlipAmt = 0;
    if (isDevil && atkP > 0) {
        if (atkP < 0.35) {
            devilFlipAmt = Math.sin((atkP / 0.35) * (Math.PI / 2));
        } else if (atkP < 0.65) {
            devilFlipAmt = 1.0;
        } else {
            devilFlipAmt = Math.cos(((atkP - 0.65) / 0.35) * (Math.PI / 2));
        }
    }

    // 2. Zombie melee attack with both hands swinging downward:
    // Zombie's arms extend horizontally (+Z); negative pitchX (-0.95 rad) raises both hands high overhead (+Y),
    // then positive pitchX (+0.85 rad) chops both hands forcefully from top to bottom (-Y)!
    let zombieSwingPitch = 0;
    let zombieForearmPitch = 0;
    let zombieTorsoPitch = 0;
    if (!isDevil && atkP > 0) {
        if (atkP < 0.28) {
            const u = atkP / 0.28;
            zombieSwingPitch = -0.95 * u;
            zombieForearmPitch = -0.4 * u;
            zombieTorsoPitch = -0.1 * u;
        } else if (atkP < 0.78) {
            const u = (atkP - 0.28) / 0.5;
            zombieSwingPitch = -0.95 + 1.8 * u; // Sweeps from -0.95 (top) down to +0.85 (bottom)
            zombieForearmPitch = -0.4 + 0.9 * u;
            zombieTorsoPitch = -0.1 + 0.28 * u;
        } else {
            const u = (1 - atkP) / 0.22;
            zombieSwingPitch = 0.85 * u;
            zombieForearmPitch = 0.5 * u;
            zombieTorsoPitch = 0.18 * u;
        }
    }

    const pose: SkeletalPoseMap = isDevil
        ? {
              body_bone: {
                  pitchX: 0.05 - 0.09 * hurtAmt + 0.12 * devilFlipAmt,
                  yawY: s * 0.07 * (1 - devilFlipAmt * 0.7),
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              head_bone: {
                  pitchX: 0.03 - 0.06 * hurtAmt - 0.08 * devilFlipAmt,
                  yawY: -s * 0.04,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              left_leg_bone: {
                  pitchX: hipSwing,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              left_knee_bone: {
                  pitchX: leftKnee,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              right_leg_bone: {
                  pitchX: -hipSwing,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              right_knee_bone: {
                  pitchX: rightKnee,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              left_arm_bone: {
                  pitchX: -s * 0.38 * (1 - devilFlipAmt) - 0.62 * hurtAmt - 1.42 * devilFlipAmt,
                  yawY: -0.22 * hurtAmt,
                  rollZ: -0.08 - 0.22 * hurtAmt,
                  tx: 0,
                  ty: 0,
                  tz: 2.6 * hurtAmt + 2.4 * devilFlipAmt,
              },
              left_forearm_bone: {
                  pitchX: (0.22 + c * 0.12) * (1 - devilFlipAmt) - 0.35 * hurtAmt - 0.32 * devilFlipAmt,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 1.5 * hurtAmt + 1.6 * devilFlipAmt,
              },
              right_arm_bone: {
                  pitchX: s * 0.38 * (1 - devilFlipAmt) - 0.62 * hurtAmt - 1.42 * devilFlipAmt,
                  yawY: 0.22 * hurtAmt,
                  rollZ: 0.08 + 0.22 * hurtAmt,
                  tx: 0,
                  ty: 0,
                  tz: 2.6 * hurtAmt + 2.4 * devilFlipAmt,
              },
              right_forearm_bone: {
                  pitchX: (0.22 - c * 0.12) * (1 - devilFlipAmt) - 0.35 * hurtAmt - 0.32 * devilFlipAmt,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 1.5 * hurtAmt + 1.6 * devilFlipAmt,
              },
          }
        : {
              body_bone: {
                  pitchX: 0.06 - 0.1 * hurtAmt + zombieTorsoPitch,
                  yawY: s * 0.07,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              head_bone: {
                  pitchX: -0.03 - 0.06 * hurtAmt + zombieTorsoPitch * 0.5,
                  yawY: -s * 0.05,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              left_leg_bone: {
                  pitchX: hipSwing,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              left_knee_bone: {
                  pitchX: leftKnee,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              right_leg_bone: {
                  pitchX: -hipSwing,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              right_knee_bone: {
                  pitchX: rightKnee,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 0,
              },
              left_arm_bone: {
                  pitchX: s * 0.16 * (atkP > 0 ? 0.25 : 1) - 0.36 * hurtAmt + zombieSwingPitch,
                  yawY: -0.28 * hurtAmt,
                  rollZ: -0.18 * hurtAmt,
                  tx: 0,
                  ty: 0,
                  tz: 3.0 * hurtAmt,
              },
              left_forearm_bone: {
                  pitchX: c * 0.14 * (atkP > 0 ? 0.25 : 1) - 0.24 * hurtAmt + zombieForearmPitch,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 1.8 * hurtAmt,
              },
              right_arm_bone: {
                  pitchX: -s * 0.16 * (atkP > 0 ? 0.25 : 1) - 0.36 * hurtAmt + zombieSwingPitch,
                  yawY: 0.28 * hurtAmt,
                  rollZ: 0.18 * hurtAmt,
                  tx: 0,
                  ty: 0,
                  tz: 3.0 * hurtAmt,
              },
              right_forearm_bone: {
                  pitchX: -c * 0.14 * (atkP > 0 ? 0.25 : 1) - 0.24 * hurtAmt + zombieForearmPitch,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 0,
                  tz: 1.8 * hurtAmt,
              },
          };

    renderSkeletalBBModel(ctx, model, x, y, angle, pose, {
        isFlashing,
    });
}
