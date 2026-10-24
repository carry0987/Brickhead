import { type BBAssetId, type BBBoneName, BBMODEL_CATALOG, sampleBBAnimationClip } from '@/data/bbmodelCatalog';
import { drawFakeWallDamageSvgOnCanvas } from '../svgEffectRenderer';
import { renderSkeletalBBModel, type SkeletalPoseMap, tryDrawCustomSprite } from './isoModelRenderer';

export interface AssetRenderExtraOptions {
    /** For `wall`: current HP ratio from 0 to 1 for progressive monster attack cracks and damage. */
    damageRatio?: number;
    /** For `mine`: whether an enemy has stepped on it and triggered rapid red blinking. */
    isTriggered?: boolean;
    /** Current timestamp in ms for LED blinking */
    nowMs?: number;
}

/**
 * Renders the authentic Boxhead 2Play barrel:
 * - True 3D Cylinder (top cap, middle stripe, and bottom base all share identical elliptical cross-section `rx, ry`)
 * - Taller cylindrical body (`bodyH = 29 * s`)
 * - Smooth metallic grey cylindrical body with left-to-right cylindrical shading (`#5c5c5c` -> `#888888` -> `#ababab` -> `#787878`)
 * - Bold curved reddish-orange horizontal band (`#b82906` / `#cf330a`) across the middle of the cylinder
 * - Flat dark charcoal-grey elliptical top cap (`#4c4c4c`) with subtle front rim highlight and crisp dark outline (`#222222`)
 * - Soft semi-transparent left-cast floor shadow (`rgba(0, 0, 0, 0.22)`)
 */
export function drawCylinder3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number = 12.5,
    _heightZ: number = 28,
    _bodyColor: string = '#8c8c8c',
    _topColor: string = '#4c4c4c',
    _stripeColor: string = '#b82906',
) {
    if (tryDrawCustomSprite(ctx, 'barrel', cx, cy, 0, 0, false, radius * 3.8)) {
        return;
    }

    const s = radius / 12.5;
    // True cylinder geometry: top, middle stripe, and bottom share the exact same ellipse radii (rx, ry)
    const rx = 13.0 * s;
    const ry = rx * 0.66; // ~8.58 * s
    const bodyH = 29.0 * s; // Taller cylindrical body
    const botY = cy + 3.5 * s;
    const topY = botY - bodyH;

    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Left-Cast Floor Shadow
    const shadowW = 10.0 * s;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.5, topY + bodyH * 0.26);
    ctx.lineTo(cx - rx - shadowW * 0.82, topY + bodyH * 0.26);
    ctx.quadraticCurveTo(cx - rx - shadowW, topY + bodyH * 0.32, cx - rx - shadowW, botY - ry * 0.1);
    ctx.quadraticCurveTo(cx - rx - shadowW * 0.88, botY + ry * 0.68, cx - rx * 0.12, botY + ry * 0.98);
    ctx.closePath();
    ctx.fill();

    // 2. Metallic Grey Cylindrical Body (uniform cylinder from topY to botY)
    const bodyGrad = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
    bodyGrad.addColorStop(0.0, '#5c5c5c');
    bodyGrad.addColorStop(0.22, '#737373');
    bodyGrad.addColorStop(0.52, '#8c8c8c');
    bodyGrad.addColorStop(0.76, '#ababab');
    bodyGrad.addColorStop(0.9, '#969696');
    bodyGrad.addColorStop(1.0, '#757575');

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(cx - rx, topY);
    ctx.lineTo(cx - rx, botY);
    ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, topY);
    ctx.closePath();
    ctx.fill();

    // 3. Horizontal Curved Red-Orange Band across the middle of the cylinder
    // Uses the exact same (rx, ry) ellipse so the band has uniform cylindrical thickness
    const stripeTopY = topY + bodyH * 0.35;
    const stripeBotY = topY + bodyH * 0.65;

    const stripeGrad = ctx.createLinearGradient(cx - rx, cy, cx + rx, cy);
    stripeGrad.addColorStop(0.0, '#801b04');
    stripeGrad.addColorStop(0.22, '#9e2206');
    stripeGrad.addColorStop(0.54, '#bd2b08');
    stripeGrad.addColorStop(0.76, '#d4350b');
    stripeGrad.addColorStop(1.0, '#942005');

    ctx.fillStyle = stripeGrad;
    ctx.beginPath();
    ctx.ellipse(cx, stripeTopY, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, stripeBotY);
    ctx.ellipse(cx, stripeBotY, rx, ry, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.fill();

    // Subtle dark seam lines along the top & bottom of the red band
    ctx.strokeStyle = 'rgba(35, 10, 4, 0.48)';
    ctx.lineWidth = 1.05 * Math.max(0.85, s);
    ctx.beginPath();
    ctx.ellipse(cx, stripeTopY, rx, ry, 0, 0, Math.PI, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, stripeBotY, rx, ry, 0, 0, Math.PI, false);
    ctx.stroke();

    // 4. Flat Dark Charcoal-Grey Elliptical Top Cap (#4c4c4c)
    const topGrad = ctx.createLinearGradient(cx - rx * 0.7, topY - ry * 0.7, cx + rx * 0.7, topY + ry * 0.7);
    topGrad.addColorStop(0.0, '#454545');
    topGrad.addColorStop(0.55, '#4f4f4f');
    topGrad.addColorStop(1.0, '#5a5a5a');

    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle lighter grey rim highlight along the front edge of the top cap
    ctx.strokeStyle = '#787878';
    ctx.lineWidth = 1.25 * Math.max(0.85, s);
    ctx.beginPath();
    ctx.ellipse(cx, topY, rx * 0.96, ry * 0.95, 0, 0.08 * Math.PI, 0.92 * Math.PI, false);
    ctx.stroke();

    // Dark rim around the top cap
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.65 * Math.max(0.85, s);
    ctx.beginPath();
    ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Crisp Dark Outer Silhouette Outline around the Cylinder Body
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.75 * Math.max(0.85, s);
    ctx.beginPath();
    ctx.moveTo(cx - rx, topY);
    ctx.lineTo(cx - rx, botY);
    ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, topY);
    ctx.stroke();

    ctx.restore();
}

/**
 * Renders the authentic Boxhead 2Play fake wall as a true 3D regular octagonal column:
 * - Regular 8-sided octagonal top face (`#ffffff`) where all 8 edges are balanced octagon segments
 * - Tall vertical 8-sided prism column (`columnH = 27 * s`) with 3 visible front vertical facets:
 *   - Left angled octagon facet: `#737373`
 *   - Center front octagon facet: `#868686`
 *   - Right angled octagon facet: `#9e9e9e`
 * - Subtle light-grey bevel lip along the front eave (`#d4d4d4`)
 * - Soft semi-transparent left-cast floor shadow (`rgba(0, 0, 0, 0.22)`)
 * - Crisp dark outer silhouette outline (`#222222`) + progressive damage cracks when attacked
 */
function renderFakeWallOctagon3DDirect(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
    const scaleX = s * 1.078;
    const scaleY = s * 1.085;

    ctx.save();
    ctx.translate(cx, cy + 2.4 * s);
    ctx.scale(scaleX, scaleY);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Left-Cast Floor Shadow (#shape0 at transform(-14.3, 6.5))
    ctx.save();
    ctx.translate(-14.3, 6.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.moveTo(0.0, 0.0);
    ctx.lineTo(7.2, 5.1);
    ctx.lineTo(0.0, 0.0);
    ctx.lineTo(-5.75, -10.2);
    ctx.lineTo(-11.55, -20.4);
    ctx.lineTo(-11.55, -34.05);
    ctx.lineTo(-4.35, -39.15);
    ctx.lineTo(10.05, -39.15);
    ctx.lineTo(7.2, -39.15);
    ctx.lineTo(0.0, -34.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Octagonal Column Facets & White Top (#shape3 at transform(0.0, -32.65))
    ctx.save();
    ctx.translate(0.0, -32.65);

    // Right-front facet (#b4b4b4)
    ctx.fillStyle = '#b4b4b4';
    ctx.beginPath();
    ctx.moveTo(14.4, 18.75);
    ctx.lineTo(14.4, 39.15);
    ctx.lineTo(7.2, 44.25);
    ctx.lineTo(7.2, 23.85);
    ctx.closePath();
    ctx.fill();

    // Center-front facet (#828282)
    ctx.fillStyle = '#828282';
    ctx.beginPath();
    ctx.moveTo(7.2, 23.85);
    ctx.lineTo(7.2, 44.25);
    ctx.lineTo(-7.2, 44.25);
    ctx.lineTo(-7.2, 23.85);
    ctx.closePath();
    ctx.fill();

    // Left-front facet (#a8a8a8)
    ctx.fillStyle = '#a8a8a8';
    ctx.beginPath();
    ctx.moveTo(-7.2, 44.25);
    ctx.lineTo(-14.4, 39.15);
    ctx.lineTo(-14.4, 18.75);
    ctx.lineTo(-7.2, 23.85);
    ctx.closePath();
    ctx.fill();

    // White octagonal top (#ffffff)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(14.4, 18.75);
    ctx.lineTo(7.2, 23.85);
    ctx.lineTo(-7.2, 23.85);
    ctx.lineTo(-14.4, 18.75);
    ctx.lineTo(-14.4, 5.1);
    ctx.lineTo(-7.2, 0.0);
    ctx.lineTo(7.2, 0.0);
    ctx.lineTo(14.4, 5.1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Crisp Dark Outer Silhouette Outline (#shape4)
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.35;
    ctx.beginPath();
    ctx.moveTo(7.3, -32.65);
    ctx.lineTo(-7.1, -32.65);
    ctx.lineTo(-14.3, -27.55);
    ctx.lineTo(-14.3, 6.5);
    ctx.lineTo(-7.1, 11.6);
    ctx.lineTo(7.3, 11.6);
    ctx.lineTo(14.5, 6.5);
    ctx.lineTo(14.5, -27.55);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
}

export function drawFakeWallOctagon3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    scaleMultiplier: number = 1.0,
    damageRatio: number = 1.0,
) {
    const hpRatio = Math.max(0.0, Math.min(1.0, damageRatio));

    // Always draw from the unified 10-frame Flash SVG sequence (fake_wall_1.svg when intact, fake_wall_2..10.svg when damaged)
    // so shadow, proportions, bevel, and outline remain 100% identical across all damage stages.
    if (drawFakeWallDamageSvgOnCanvas(ctx, cx, cy, scaleMultiplier, hpRatio)) {
        return;
    }

    // Synchronous vector fallback matching fake_wall_1.svg if SVG images are still loading
    renderFakeWallOctagon3DDirect(ctx, cx, cy, scaleMultiplier);
}

/**
 * Renders the Claymore mine in true 3D .bbmodel perspective.
 * matching the reference screenshot:
 * Cream-white 3D rectangular casing with lower bevel rim, left-side dark socket,
 * and a raised 3D red/dark-red blinking LED block that flashes rapidly when stepped on!
 */
export function drawClaymoreMine3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    angle: number = -0.14,
    scaleMultiplier: number = 1.0,
    isTriggered: boolean = false,
    nowMs: number = typeof performance !== 'undefined' ? performance.now() : Date.now(),
) {
    const blinkInterval = isTriggered ? 55 : 360;
    const isBrightRed = Math.floor(nowMs / blinkInterval) % 2 === 0;
    const ledColor = isBrightRed ? '#ef4444' : '#7f1d1d';

    const renderAngle = angle === 0 ? -0.14 : angle;

    // 3D Ground Shadow
    ctx.fillStyle = 'rgba(20, 20, 20, 0.34)';
    ctx.beginPath();
    ctx.ellipse(
        cx - 2.5 * scaleMultiplier,
        cy + 3.5 * scaleMultiplier,
        14.5 * scaleMultiplier,
        9.5 * scaleMultiplier,
        renderAngle,
        0,
        Math.PI * 2,
    );
    ctx.fill();

    // Triggered high-speed warning pulse ring on the floor when stepped on by a monster
    if (isTriggered && isBrightRed) {
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 19 * scaleMultiplier, 12.5 * scaleMultiplier, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Update the 3D LED cube color in the .bbmodel before rendering all 3D cubes
    const model = BBMODEL_CATALOG.mine;
    const ledCube = model.cubes.find((c) => c.name === 'Mine_Blinking_Red_LED');
    if (ledCube) {
        ledCube.hexColor = ledColor;
    }

    renderSkeletalBBModel(
        ctx,
        model,
        cx,
        cy,
        renderAngle,
        {},
        {
            scaleMultiplier: scaleMultiplier * 1.12,
        },
    );
}

/**
 * Renders the remote charge pack in true 3D .bbmodel perspective.
 * matching the reference screenshot:
 * 4 horizontally stacked 3D red dynamite tubes with thick black outlines,
 * upper-left dark-grey square receiver pad, and a raised 3D blinking green/dark-green LED!
 */
export function drawDynamiteChargePack3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    angle: number = -0.14,
    scaleMultiplier: number = 1.0,
    nowMs: number = typeof performance !== 'undefined' ? performance.now() : Date.now(),
) {
    const isBrightGreen = Math.floor(nowMs / 280) % 2 === 0;
    const ledColor = isBrightGreen ? '#22c55e' : '#14532d';

    const renderAngle = angle === 0 ? -0.14 : angle;

    // 3D Ground Shadow
    ctx.fillStyle = 'rgba(20, 20, 20, 0.36)';
    ctx.beginPath();
    ctx.ellipse(
        cx - 2.5 * scaleMultiplier,
        cy + 3.5 * scaleMultiplier,
        15 * scaleMultiplier,
        10 * scaleMultiplier,
        renderAngle,
        0,
        Math.PI * 2,
    );
    ctx.fill();

    const model = BBMODEL_CATALOG.charge_pack;
    for (const c of model.cubes) {
        if (c.name === 'Dynamite_Green_Blinking_LED') {
            c.hexColor = ledColor;
        } else if (c.name === 'Dynamite_Tube_Row_2' || c.name === 'Dynamite_Tube_Row_4') {
            c.hexColor = '#ef4444';
        } else if (c.name === 'Dynamite_Tube_Row_1' || c.name === 'Dynamite_Tube_Row_3') {
            c.hexColor = '#dc2626';
        }
    }

    renderSkeletalBBModel(
        ctx,
        model,
        cx,
        cy,
        renderAngle,
        {},
        {
            scaleMultiplier: scaleMultiplier * 1.12,
        },
    );
}

/**
 * Renders the red supply crate to match the authentic Boxhead reference screenshot:
 * Larger volume, oriented at an isometric angle exposing the bright orange-red Top Diamond face (#ff3b14),
 * dark-crimson Left-Front vertical face (#b52204), vivid-red Right-Front vertical face (#ea2d06),
 * left floor cast shadow, and crisp dark-brown/black edges (#280500).
 */
export function drawRedBoxCrate3D(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    angle: number = 0,
    scaleMultiplier: number = 1.0,
) {
    const s = scaleMultiplier * 0.92;
    const rot = angle === 0 ? Math.PI * 0.24 : angle + Math.PI * 0.24;
    const halfSize = 11.2 * s;
    const boxHeightZ = 13.5 * s;

    // Compute the 4 corners of the square top/bottom in rotated world space
    const localCorners = [
        [-halfSize, -halfSize],
        [halfSize, -halfSize],
        [halfSize, halfSize],
        [-halfSize, halfSize],
    ];

    const cosA = Math.cos(rot);
    const sinA = Math.sin(rot);

    const pts = localCorners.map(([lx, ly]) => {
        const wx = lx * cosA - ly * sinA;
        const wy = lx * sinA + ly * cosA;
        const bx = cx + wx;
        const by = cy + wy * 0.56;
        return {
            wx,
            wy,
            bx,
            by,
            tx: bx,
            ty: by - boxHeightZ,
        };
    });

    // Left-side semi-transparent cast shadow on the floor (matching screenshot)
    let minBx = Infinity;
    let leftPt = pts[0];
    let bottomPt = pts[0];
    for (const p of pts) {
        if (p.bx < minBx) {
            minBx = p.bx;
            leftPt = p;
        }
        if (p.by > bottomPt.by) {
            bottomPt = p;
        }
    }

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.moveTo(leftPt.bx, leftPt.ty + boxHeightZ * 0.12);
    ctx.lineTo(leftPt.bx - 4.2 * s, leftPt.ty + boxHeightZ * 0.18);
    ctx.lineTo(leftPt.bx - 4.2 * s, leftPt.by + 1.5 * s);
    ctx.lineTo(bottomPt.bx, bottomPt.by);
    ctx.lineTo(leftPt.bx, leftPt.by);
    ctx.closePath();
    ctx.fill();

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#280500';
    ctx.lineWidth = 1.5 * Math.max(0.85, scaleMultiplier);

    // Draw the front-facing vertical side quads sorted back-to-front
    const sideFaces: Array<{
        i0: number;
        i1: number;
        midX: number;
        midY: number;
    }> = [];

    for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4;
        const p0 = pts[i];
        const p1 = pts[next];
        // Outward normal in screen space
        const midY = (p0.wy + p1.wy) * 0.5;
        const midX = (p0.wx + p1.wx) * 0.5;
        if (midY > -1.5) {
            sideFaces.push({ i0: i, i1: next, midX, midY });
        }
    }

    sideFaces.sort((a, b) => a.midY - b.midY);

    for (const f of sideFaces) {
        const p0 = pts[f.i0];
        const p1 = pts[f.i1];
        // Left-facing side is in shadow (#b52204), right-facing side is lit (#ea2d06)
        ctx.fillStyle = f.midX < 0 ? '#b52204' : '#ea2d06';
        ctx.beginPath();
        ctx.moveTo(p0.tx, p0.ty);
        ctx.lineTo(p1.tx, p1.ty);
        ctx.lineTo(p1.bx, p1.by);
        ctx.lineTo(p0.bx, p0.by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // Draw the Top Diamond Face (#ff3b14)
    ctx.fillStyle = '#ff3b14';
    ctx.beginPath();
    ctx.moveTo(pts[0].tx, pts[0].ty);
    ctx.lineTo(pts[1].tx, pts[1].ty);
    ctx.lineTo(pts[2].tx, pts[2].ty);
    ctx.lineTo(pts[3].tx, pts[3].ty);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

/**
 * Renders any standalone .bbmodel asset (Weapon, Barrel, Wall, Mine, Charge Pack, Red Box)
 */
export function drawBBModelAsset3D(
    ctx: CanvasRenderingContext2D,
    assetId: BBAssetId,
    x: number,
    y: number,
    angle: number = 0,
    walkCycle: number = 0,
    scaleMultiplier: number = 1.0,
    extra?: AssetRenderExtraOptions,
) {
    if (tryDrawCustomSprite(ctx, assetId, x, y, angle, walkCycle, false, 48 * scaleMultiplier)) {
        return;
    }

    // Specialized authentic 3D renderers for tactical equipment & pickups
    if (assetId === 'red_box') {
        drawRedBoxCrate3D(ctx, x, y, angle, scaleMultiplier);
        return;
    }

    if (assetId === 'barrel') {
        drawCylinder3D(ctx, x, y, 12.5 * scaleMultiplier, 26 * scaleMultiplier, '#9ca3af', '#6b7280', '#dc2626');
        return;
    }

    if (assetId === 'wall') {
        drawFakeWallOctagon3D(ctx, x, y, scaleMultiplier, extra?.damageRatio ?? 1.0);
        return;
    }

    if (assetId === 'mine') {
        drawClaymoreMine3D(ctx, x, y, angle, scaleMultiplier, extra?.isTriggered ?? false, extra?.nowMs);
        return;
    }

    if (assetId === 'charge_pack') {
        drawDynamiteChargePack3D(ctx, x, y, angle, scaleMultiplier, extra?.nowMs);
        return;
    }

    const model = BBMODEL_CATALOG[assetId];
    if (!model) return;

    // Ground shadow
    ctx.fillStyle = 'rgba(30, 20, 10, 0.28)';
    ctx.beginPath();
    ctx.ellipse(
        x - 3 * scaleMultiplier,
        y + 3 * scaleMultiplier,
        13 * scaleMultiplier,
        8 * scaleMultiplier,
        0,
        0,
        Math.PI * 2,
    );
    ctx.fill();

    // Weapons are natively modeled around [0, 0, 0]; only apply a subtle vertical hover (ty: 6) when displayed standalone above ground
    const isHandheldWeapon = model.category === 'WEAPON' && assetId !== 'grenade';
    const pose: SkeletalPoseMap = isHandheldWeapon
        ? {
              weapon_mount_bone: {
                  pitchX: 0,
                  yawY: 0,
                  rollZ: 0,
                  tx: 0,
                  ty: 6.0,
                  tz: -4.0,
              },
          }
        : {};

    // When previewing standalone weapon animations (e.g., in Model Studio with triggerRecoil active),
    // sample the weapon's own .bbmodel `animation.boxhead.fire` and `animation.boxhead.reload` tracks!
    if (extra?.isTriggered && model.animations) {
        const cycleT = ((extra.nowMs ?? performance.now()) % 900) / 900;
        const blendClip = (clipPose: ReturnType<typeof sampleBBAnimationClip>) => {
            for (const [bKey, delta] of Object.entries(clipPose)) {
                if (!delta) continue;
                const boneName = bKey as BBBoneName;
                const cur = pose[boneName] || {
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
            }
        };
        if (model.animations['animation.boxhead.fire']) {
            blendClip(sampleBBAnimationClip(model.animations['animation.boxhead.fire'], Math.min(1, cycleT * 2.2)));
        }
        if (model.animations['animation.boxhead.reload']) {
            const reloadClipPose = sampleBBAnimationClip(model.animations['animation.boxhead.reload'], cycleT);
            for (const bKey of Object.keys(reloadClipPose)) {
                const boneName = bKey as BBBoneName;
                if (boneName !== 'weapon_mount_bone') {
                    delete pose[boneName];
                }
            }
            blendClip(reloadClipPose);
        }
    }

    renderSkeletalBBModel(ctx, model, x, y, angle, pose, {
        scaleMultiplier,
    });
}

/**
 * Draws an axis-aligned 2.5D extruded 3D architectural block matching actual Boxhead 2Play in-game graphics:
 * IMPORTANT: All Boxhead walls and pillars are Pure White (#ffffff) base structures;
 * the "grey" surfaces are semi-transparent black shadows (`rgba(0, 0, 0, ...)`) cast across their facets and floor!
 * - `pyramid_pillar`:
 *   5-sided pointed-top obelisk/pillar with Pure White base, light shadow on center pyramid triangle (`rgba(0,0,0,0.23)`),
 *   darker shadow on lower vertical shaft (`rgba(0,0,0,0.43)`), left floor cast shadow (`rgba(0,0,0,0.20)`),
 *   and a single crisp outer black outline (zero internal black lines).
 * - `vertical_wall`:
 *   Pure White flat-topped vertical wall slab with left cast shadow (`rgba(0,0,0,0.20)`) and crisp black border.
 * - `classic_blue` / `concrete`:
 *   Pure White block with lower front vertical face shaded by `rgba(0,0,0,0.43)` and crisp outer black border.
 */
