import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { loadBBModelById, loadBBModelsByIds, subscribeBBModels } from '@/data/bbmodelCatalog';
import { CHARACTERS, loadRoomById, subscribeRooms } from '@/data/gameCatalog';
import { getCharacterDisplay, getRoomDisplay } from '@/i18n/catalogI18n';
import * as m from '@/paraglide/messages';
import type { CharacterSpec, EnemyKind, RoomSpec } from '@/types/game';
import { customAssetStore } from '@/utils/customAssetStore';
import { drawBoxheadEnemy3D, drawBoxheadHuman3D } from '@/utils/rendering/isoCharacterRenderer';
import { drawBBModelAsset3D } from '@/utils/rendering/isoEquipmentRenderer';
import {
    computeObstacleNeighborFlags,
    SWF_FLOOR_STAIN_GLADIATOR_PATH_D,
    SWF_FLOOR_STAIN_PATH_D,
} from '@/utils/rendering/isoObstacleRenderer';
import { getPlayerWeaponMuzzleWorldPos, preloadAllSvgEffectsWithProgress } from '@/utils/svgEffectRenderer';

/**
 * Directly renders the actual in-game skeletal .bbmodel for a Human Character
 */
export const BoxheadCharacterAvatar: FC<{
    character: CharacterSpec;
    size?: number;
}> = ({ character, size = 68 }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            // Warm sand/concrete arena tile background
            ctx.fillStyle = '#e7decb';
            ctx.fillRect(0, 0, w, h);

            ctx.strokeStyle = 'rgba(0,0,0,0.08)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, h * 0.55);
            ctx.lineTo(w, h * 0.55);
            ctx.moveTo(w * 0.5, 0);
            ctx.lineTo(w * 0.5, h);
            ctx.stroke();

            ctx.save();
            ctx.translate(w * 0.5, h * 0.8);
            ctx.scale(2.05, 2.05);

            drawBoxheadHuman3D(
                ctx,
                0,
                0,
                Math.PI * 0.18,
                0,
                false,
                false,
                false,
                'none',
                character.skinColor,
                character.hairColor,
                character.shirtColor,
                character.pantsColor,
                character.bandanaColor,
                character.glasses,
                character.id,
            );

            ctx.restore();
        };

        void loadBBModelsByIds([character.id]);
        draw();
        const unsubCustom = customAssetStore.subscribe(draw);
        const unsubBB = subscribeBBModels(draw);
        return () => {
            unsubCustom();
            unsubBB();
        };
    }, [character]);

    return (
        <canvas
            ref={canvasRef}
            width={136}
            height={136}
            style={{ width: size, height: size }}
            className="shrink-0 rounded-xl border-2 border-stone-700 shadow-sm select-none"
            aria-label={getCharacterDisplay(character.id).name}
        />
    );
};

/**
 * Directly renders the actual in-game skeletal .bbmodel for a Zombie, Fast Zombie, or Red Devil Boss
 */
export const BoxheadEnemyBadge: FC<{ kind: EnemyKind; size?: number }> = ({ kind, size = 54 }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const draw = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            ctx.fillStyle = '#e7decb';
            ctx.fillRect(0, 0, w, h);

            ctx.strokeStyle = 'rgba(0,0,0,0.08)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, h * 0.55);
            ctx.lineTo(w, h * 0.55);
            ctx.moveTo(w * 0.5, 0);
            ctx.lineTo(w * 0.5, h);
            ctx.stroke();

            ctx.save();
            const isDevil = kind === 'devil';
            ctx.translate(w * 0.52, isDevil ? h * 0.86 : h * 0.82);
            const s = isDevil ? 1.55 : 2.0;
            ctx.scale(s, s);

            drawBoxheadEnemy3D(ctx, 0, 0, Math.PI * 0.78, 0.65, kind, false);

            ctx.restore();
        };

        void loadBBModelById(kind);
        draw();
        const unsubCustom = customAssetStore.subscribe(draw);
        const unsubBB = subscribeBBModels(draw);
        return () => {
            unsubCustom();
            unsubBB();
        };
    }, [kind]);

    return (
        <canvas
            ref={canvasRef}
            width={120}
            height={120}
            style={{ width: size, height: size }}
            className="shrink-0 rounded-xl border-2 border-stone-700 shadow-sm select-none"
            aria-label={kind}
        />
    );
};

export const BoxheadRoomPreviewSvg: FC<{
    room: RoomSpec;
    large?: boolean;
    showNodes?: boolean;
}> = ({ room, large = false, showNodes = false }) => {
    const [, setRoomTick] = useState(0);
    const roomDisplay = getRoomDisplay(room.id);

    useEffect(() => {
        void loadRoomById(room.id);
        return subscribeRooms(() => setRoomTick((t) => t + 1));
    }, [room.id]);

    const worldW = room.worldWidth || 721;
    const worldH = room.worldHeight || 801;
    const b = room.bounds || { x: 16, y: 103.3, w: 704, h: 544 };
    const clipId = `room-preview-clip-${room.id}-${showNodes ? 'nodes' : 'clean'}`;

    const sortedObstacles = [...room.obstacles].sort((o1, o2) => {
        const dy = o1.y + o1.h - (o2.y + o2.h);
        if (Math.abs(dy) > 0.5) return dy;
        const aIsPillar = o1.style === 'pyramid_pillar' ? 1 : 0;
        const bIsPillar = o2.style === 'pyramid_pillar' ? 1 : 0;
        return aIsPillar - bIsPillar;
    });
    const neighborMap = computeObstacleNeighborFlags(sortedObstacles);

    // In the lobby map selector (!showNodes), crop tightly to the playable room bounds (b)
    // and render ONLY the map architecture (floor, floor stain, walls & pillars) — never placeables (B/W)!
    const viewBoxStr = showNodes ? `0 0 ${worldW} ${worldH}` : `${b.x} ${b.y} ${b.w} ${b.h}`;

    return (
        <svg
            viewBox={viewBoxStr}
            preserveAspectRatio={showNodes ? 'xMidYMid meet' : 'xMidYMid slice'}
            className={`w-full block ${
                large ? 'aspect-704/544 max-h-72' : 'h-36 rounded-lg border border-stone-700'
            } ${showNodes ? 'bg-stone-950 object-contain' : 'bg-[#ebdcc7] object-cover'} select-none`}
            aria-label={roomDisplay.name}>
            <defs>
                <clipPath id={clipId}>
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} />
                </clipPath>
            </defs>

            {/* Classic Boxhead warm sand-beige arena floor (#sprite0) */}
            <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={room.floorColor || '#ebdcc7'} />

            {/* Authentic SWF organic floor stain (#sprite1 / #shape1), clipped to floor bounds */}
            <g clipPath={showNodes ? undefined : `url(#${clipId})`}>
                {(Array.isArray(room.stainTransforms) && room.stainTransforms.length > 0
                    ? room.stainTransforms
                    : ([[-0.5318, 1.1321, -0.6118, -0.9841, 340.8, 303.0]] as Array<
                          [number, number, number, number, number, number]
                      >)
                ).map(([ma, mb, mc, md, tx, ty]) => (
                    <g
                        key={`${ma}-${mb}-${mc}-${md}-${tx}-${ty}`}
                        transform={`translate(${b.x + tx}, ${b.y + ty}) matrix(${ma}, ${mb}, ${mc}, ${md}, 0, 0)`}>
                        <path
                            d={Math.abs(ma) > 1.1 ? SWF_FLOOR_STAIN_GLADIATOR_PATH_D : SWF_FLOOR_STAIN_PATH_D}
                            fill={room.patchColor || '#d8cccc'}
                            stroke="rgba(130, 118, 114, 0.45)"
                            strokeWidth="0.9"
                        />
                    </g>
                ))}
            </g>

            {/* Pass 1: Dedicated Floor-Layer Cast Shadows for all Obstacles */}
            <g>
                {sortedObstacles.map((obs) => {
                    const obstacleKey = `${obs.x}-${obs.y}-${obs.w}-${obs.h}-${obs.style}`;
                    const sx = obs.x;
                    const sy = obs.y;
                    const sw = obs.w;
                    const sh = obs.h;
                    const scaleH = sh / 64;

                    if (obs.style === 'tall_column') {
                        const csx = sw / 64;
                        const csy = sh / 64;
                        const tx = sx + 32.0 * csx;
                        const ty = sy + 32.0 * csy;
                        const shadowPts = `${tx - 57.55 * csx},${ty - 27.75 * csy} ${tx - 57.55 * csx},${ty - 43.15 * csy} ${tx - 41.55 * csx},${ty - 58.5 * csy} ${tx - 9.6 * csx},${ty - 58.5 * csy} ${tx + 6.4 * csx},${ty - 43.15 * csy} ${tx + 32.0 * csx},${ty + 2.1 * csy} ${tx + 32.0 * csx},${ty + 20.7 * csy} ${tx + 16.0 * csx},${ty + 32.0 * csy} ${tx - 16.0 * csx},${ty + 32.0 * csy} ${tx - 31.95 * csx},${ty + 17.5 * csy}`;
                        return <polygon key={`sh-${obstacleKey}`} points={shadowPts} fill="rgba(0,0,0,0.25)" />;
                    }

                    if (obs.style === 'strip_pillar') {
                        const csx = sw / 64;
                        const csy = sh / 96;
                        const tx = sx + 32.0 * csx;
                        const ty = sy + 64.0 * csy;
                        const shadowPts1 = `${tx - 33.7 * csx},${ty - 62.5 * csy} ${tx - 29.35 * csx},${ty - 66.15 * csy} ${tx - 29.85 * csx},${ty + 5.25 * csy} ${tx - 26.7 * csx},${ty + 18.75 * csy} ${tx - 9.65 * csx},${ty + 29.85 * csy} ${tx - 28.9 * csx},${ty + 25.85 * csy} ${tx - 34.25 * csx},${ty + 20.05 * csy}`;
                        const shadowPts2 = `${tx + 29.1 * csx},${ty + 16.95 * csy} ${tx + 29.05 * csx},${ty + 20.9 * csy} ${tx + 19.05 * csx},${ty + 26.6 * csy}`;
                        return (
                            <g key={`sh-${obstacleKey}`}>
                                <polygon points={shadowPts1} fill="rgba(0,0,0,0.25)" />
                                <polygon points={shadowPts2} fill="rgba(0,0,0,0.25)" />
                            </g>
                        );
                    }

                    if (obs.style === 'tight_column') {
                        const csx = sw / 64;
                        const csy = sh / 64;
                        const tx = sx + 32.0 * csx;
                        const ty = sy + 32.0 * csy;
                        const shadowPts = `${tx + 5.2 * csx},${ty - 44.3 * csy} ${tx + 6.4 * csx},${ty - 43.15 * csy} ${tx + 32.0 * csx},${ty + 2.1 * csy} ${tx + 32.0 * csx},${ty + 20.7 * csy} ${tx + 16.0 * csx},${ty + 32.0 * csy} ${tx - 16.0 * csx},${ty + 32.0 * csy} ${tx - 31.95 * csx},${ty + 17.5 * csy} ${tx - 57.5 * csx},${ty - 27.65 * csy} ${tx - 81.25 * csx},${ty - 69.5 * csy} ${tx - 81.25 * csx},${ty - 84.9 * csy} ${tx - 65.25 * csx},${ty - 100.25 * csy} ${tx - 33.3 * csx},${ty - 100.25 * csy} ${tx - 18.4 * csx},${ty - 86.0 * csy}`;
                        return <polygon key={`sh-${obstacleKey}`} points={shadowPts} fill="rgba(0,0,0,0.25)" />;
                    }

                    if (obs.style === 'beveled_block') {
                        if (sw >= 200) {
                            const bsx = sw / 256;
                            const bsy = sh / 192;
                            const tx = sx + 128.0 * bsx;
                            const ty = sy + 64.0 * bsy;
                            const shadowPts = `${tx - 128.0 * bsx},${ty - 78.8 * bsy} ${tx - 128.0 * bsx},${ty + 116.7 * bsy} ${tx - 140.8 * bsx},${ty + 94.1 * bsy} ${tx - 140.8 * bsx},${ty - 69.75 * bsy}`;
                            return <polygon key={`sh-${obstacleKey}`} points={shadowPts} fill="rgba(0,0,0,0.25)" />;
                        }
                        const bsx = sw / 128;
                        const bsy = sh / 96;
                        const tx = sx + 64.0 * bsx;
                        const ty = sy + 64.0 * bsy;
                        const shadowPts = `${tx - 64.0 * bsx},${ty - 78.85 * bsy} ${tx - 64.0 * bsx},${ty + 20.65 * bsy} ${tx - 76.8 * bsx},${ty - 1.95 * bsy} ${tx - 76.8 * bsx},${ty - 69.8 * bsy}`;
                        return <polygon key={`sh-${obstacleKey}`} points={shadowPts} fill="rgba(0,0,0,0.25)" />;
                    }

                    if (obs.style === 'pyramid_pillar') {
                        const bottomY = sy + sh;
                        const shadowW = 16 * (sw / 64);
                        const shadowTopY = sy - 9.55 * scaleH;
                        const shadowLeftBottomY = sy + 35.7 * scaleH;
                        return (
                            <polygon
                                key={`sh-${obstacleKey}`}
                                points={`${sx},${shadowTopY} ${sx - shadowW},${shadowTopY} ${sx - shadowW},${shadowLeftBottomY} ${sx},${bottomY}`}
                                fill="rgba(0,0,0,0.25)"
                            />
                        );
                    }

                    if (obs.style === 'vertical_wall') {
                        const vsx = sw / 64;
                        const vsy = sh / 128;
                        const refX = sx;
                        const refY = sy + 64.0 * vsy;
                        const shadowPts = `${refX + 9.6 * vsx},${refY - 94.35 * vsy} ${refX + 22.4 * vsx},${refY - 71.75 * vsy} ${refX + 22.4 * vsx},${refY + 64.0 * vsy} ${refX + 6.4 * vsx},${refY + 64.0 * vsy} ${refX - 6.4 * vsx},${refY + 41.4 * vsy} ${refX - 6.4 * vsx},${refY - 94.35 * vsy}`;
                        return <polygon key={`sh-${obstacleKey}`} points={shadowPts} fill="rgba(0,0,0,0.25)" />;
                    }

                    if (obs.style === 'concrete') {
                        const bottomY = sy + 64.0 * scaleH;
                        const shadowW = 12.8 * (sw / 64);
                        const shadowTopY = sy - 3.85 * scaleH;
                        const shadowLeftBottomY = sy + 41.4 * scaleH;
                        return (
                            <polygon
                                key={`sh-${obstacleKey}`}
                                points={`${sx},${shadowTopY} ${sx - shadowW},${shadowTopY} ${sx - shadowW},${shadowLeftBottomY} ${sx},${bottomY}`}
                                fill="rgba(0,0,0,0.25)"
                            />
                        );
                    }

                    const bottomY = sy + 58.0 * scaleH;
                    const shadowW = 12.8 * scaleH;
                    const shadowTopY = sy - 7.95 * scaleH;
                    const shadowLeftBottomY = sy + 35.35 * scaleH;
                    return (
                        <polygon
                            key={`sh-${obstacleKey}`}
                            points={`${sx},${shadowTopY} ${sx - shadowW},${shadowTopY} ${sx - shadowW},${shadowLeftBottomY} ${sx},${bottomY}`}
                            fill="rgba(0,0,0,0.25)"
                        />
                    );
                })}
            </g>

            {/* Pass 2: 2.5D Obstacle Bodies (Tall Octagonal Columns, Strip Pillars, Beveled Blocks, Pointed-Top Pillars & Walls) */}
            {sortedObstacles.map((obs, idx) => {
                const obstacleKey = `${obs.x}-${obs.y}-${obs.w}-${obs.h}-${obs.style}`;
                const sx = obs.x;
                const sy = obs.y;
                const sw = obs.w;
                const sh = obs.h;
                const scaleH = sh / 64;
                const neighbors = neighborMap.get(idx);

                if (obs.style === 'tall_column') {
                    const csx = sw / 64;
                    const csy = sh / 64;
                    const tx = sx + 32.0 * csx;
                    const ty = sy + 32.0 * csy;

                    const topPts = `${tx - 32.0 * csx},${ty - 43.8 * csy} ${tx - 32.0 * csx},${ty - 59.15 * csy} ${tx - 16.0 * csx},${ty - 74.5 * csy} ${tx + 16.0 * csx},${ty - 74.5 * csy} ${tx + 32.0 * csx},${ty - 59.15 * csy} ${tx + 32.0 * csx},${ty - 40.55 * csy} ${tx + 16.0 * csx},${ty - 29.25 * csy} ${tx - 16.0 * csx},${ty - 29.25 * csy}`;
                    const leftChamferPts = `${tx - 32.0 * csx},${ty - 43.8 * csy} ${tx - 16.0 * csx},${ty - 29.25 * csy} ${tx - 16.0 * csx},${ty + 32.0 * csy} ${tx - 32.0 * csx},${ty + 17.5 * csy}`;
                    const centerFrontPts = `${tx - 16.0 * csx},${ty - 29.25 * csy} ${tx + 16.0 * csx},${ty - 29.25 * csy} ${tx + 16.0 * csx},${ty + 32.0 * csy} ${tx - 16.0 * csx},${ty + 32.0 * csy}`;
                    const rightChamferPts = `${tx + 16.0 * csx},${ty - 29.25 * csy} ${tx + 32.0 * csx},${ty - 40.55 * csy} ${tx + 32.0 * csx},${ty + 20.7 * csy} ${tx + 16.0 * csx},${ty + 32.0 * csy}`;
                    const outlinePts = `${tx + 16.0 * csx},${ty - 74.5 * csy} ${tx - 16.0 * csx},${ty - 74.5 * csy} ${tx - 32.0 * csx},${ty - 59.15 * csy} ${tx - 32.0 * csx},${ty + 17.5 * csy} ${tx - 16.0 * csx},${ty + 32.0 * csy} ${tx + 16.0 * csx},${ty + 32.0 * csy} ${tx + 32.0 * csx},${ty + 20.7 * csy} ${tx + 32.0 * csx},${ty - 59.15 * csy}`;

                    return (
                        <g key={obstacleKey}>
                            <polygon points={topPts} fill="#ffffff" />
                            <polygon points={leftChamferPts} fill="#a4a4a4" />
                            <polygon points={centerFrontPts} fill="#888888" />
                            <polygon points={rightChamferPts} fill="#bbbbbb" />
                            <polygon
                                points={outlinePts}
                                fill="none"
                                stroke="#000000"
                                strokeWidth="1.2"
                                strokeLinejoin="round"
                            />
                        </g>
                    );
                }

                if (obs.style === 'strip_pillar') {
                    const csx = sw / 64;
                    const csy = sh / 96;
                    const tx = sx + 32.0 * csx;
                    const ty = sy + 64.0 * csy;

                    const facetLeft = `${tx - 29.85 * csx},${ty + 5.25 * csy} ${tx - 29.25 * csx},${ty - 77.25 * csy} ${tx - 18.2 * csx},${ty - 92.25 * csy} ${tx - 18.75 * csx},${ty - 9.75 * csy}`;
                    const facetCenter = `${tx - 18.75 * csx},${ty - 9.75 * csy} ${tx - 18.2 * csx},${ty - 92.25 * csy} ${tx + 10.2 * csx},${ty - 95.35 * csy} ${tx + 9.65 * csx},${ty - 12.85 * csy}`;
                    const facetRightUpper = `${tx + 9.65 * csx},${ty - 12.85 * csy} ${tx + 10.2 * csx},${ty - 95.35 * csy} ${tx + 27.55 * csx},${ty - 83.45 * csy} ${tx + 27.0 * csx},${ty - 0.95 * csy}`;
                    const facetRightSteep = `${tx + 27.0 * csx},${ty - 0.95 * csy} ${tx + 27.55 * csx},${ty - 83.45 * csy} ${tx + 31.3 * csx},${ty - 67.2 * csy} ${tx + 30.75 * csx},${ty + 15.3 * csy}`;
                    const frontPts = `${tx - 29.85 * csx},${ty + 5.25 * csy} ${tx - 18.75 * csx},${ty - 9.75 * csy} ${tx + 9.65 * csx},${ty - 12.85 * csy} ${tx + 27.0 * csx},${ty - 0.95 * csy} ${tx + 30.75 * csx},${ty + 15.3 * csy} ${tx + 29.1 * csx},${ty + 16.95 * csy} ${tx + 19.05 * csx},${ty + 26.6 * csy} ${tx + 18.85 * csx},${ty + 26.8 * csy} ${tx - 9.55 * csx},${ty + 29.9 * csy} ${tx - 9.65 * csx},${ty + 29.85 * csy} ${tx - 26.7 * csx},${ty + 18.75 * csy}`;
                    const eaveBevelPts = `${tx - 29.85 * csx},${ty + 5.25 * csy} ${tx - 18.75 * csx},${ty - 9.75 * csy} ${tx + 9.65 * csx},${ty - 12.85 * csy} ${tx + 27.0 * csx},${ty - 0.95 * csy} ${tx + 30.75 * csx},${ty + 15.3 * csy}`;
                    const outlinePts = `${tx + 10.2 * csx},${ty - 95.35 * csy} ${tx - 18.2 * csx},${ty - 92.25 * csy} ${tx - 29.25 * csx},${ty - 77.25 * csy} ${tx - 29.85 * csx},${ty + 5.25 * csy} ${tx - 26.7 * csx},${ty + 18.75 * csy} ${tx - 9.65 * csx},${ty + 29.85 * csy} ${tx - 9.55 * csx},${ty + 29.9 * csy} ${tx + 18.85 * csx},${ty + 26.8 * csy} ${tx + 30.75 * csx},${ty + 15.3 * csy} ${tx + 31.3 * csx},${ty - 67.2 * csy} ${tx + 27.55 * csx},${ty - 83.45 * csy}`;

                    return (
                        <g key={obstacleKey}>
                            <polygon points={facetLeft} fill="#e4e4e7" />
                            <polygon points={facetCenter} fill="#ffffff" />
                            <polygon points={facetRightUpper} fill="#f0f0f2" />
                            <polygon points={facetRightSteep} fill="#d4d4d8" />
                            <line
                                x1={tx - 18.2 * csx}
                                y1={ty - 92.25 * csy}
                                x2={tx - 18.75 * csx}
                                y2={ty - 9.75 * csy}
                                stroke="#c4c4cc"
                                strokeWidth="1.0"
                            />
                            <line
                                x1={tx + 10.2 * csx}
                                y1={ty - 95.35 * csy}
                                x2={tx + 9.65 * csx}
                                y2={ty - 12.85 * csy}
                                stroke="#c4c4cc"
                                strokeWidth="1.0"
                            />
                            <line
                                x1={tx + 27.55 * csx}
                                y1={ty - 83.45 * csy}
                                x2={tx + 27.0 * csx}
                                y2={ty - 0.95 * csy}
                                stroke="#c4c4cc"
                                strokeWidth="1.0"
                            />
                            <polygon points={frontPts} fill="#868686" />
                            <polyline points={eaveBevelPts} fill="none" stroke="#bdbdc4" strokeWidth="1.2" />
                            <polygon
                                points={outlinePts}
                                fill="none"
                                stroke="#000000"
                                strokeWidth="1.2"
                                strokeLinejoin="round"
                            />
                        </g>
                    );
                }

                if (obs.style === 'tight_column') {
                    const csx = sw / 64;
                    const csy = sh / 64;
                    const tx = sx + 32.0 * csx;
                    const ty = sy + 32.0 * csy;

                    const topPts = `${tx - 32.0 * csx},${ty - 107.8 * csy} ${tx - 32.0 * csx},${ty - 123.15 * csy} ${tx - 16.0 * csx},${ty - 138.5 * csy} ${tx + 16.0 * csx},${ty - 138.5 * csy} ${tx + 32.0 * csx},${ty - 123.15 * csy} ${tx + 32.0 * csx},${ty - 104.55 * csy} ${tx + 16.0 * csx},${ty - 93.25 * csy} ${tx - 16.0 * csx},${ty - 93.25 * csy}`;
                    const leftChamferPts = `${tx - 32.0 * csx},${ty - 107.8 * csy} ${tx - 16.0 * csx},${ty - 93.25 * csy} ${tx - 16.0 * csx},${ty + 32.0 * csy} ${tx - 32.0 * csx},${ty + 17.5 * csy}`;
                    const centerFrontPts = `${tx - 16.0 * csx},${ty - 93.25 * csy} ${tx + 16.0 * csx},${ty - 93.25 * csy} ${tx + 16.0 * csx},${ty + 32.0 * csy} ${tx - 16.0 * csx},${ty + 32.0 * csy}`;
                    const rightChamferPts = `${tx + 16.0 * csx},${ty - 93.25 * csy} ${tx + 32.0 * csx},${ty - 104.55 * csy} ${tx + 32.0 * csx},${ty + 20.7 * csy} ${tx + 16.0 * csx},${ty + 32.0 * csy}`;
                    const outlinePts = `${tx + 16.0 * csx},${ty - 138.5 * csy} ${tx - 16.0 * csx},${ty - 138.5 * csy} ${tx - 32.0 * csx},${ty - 123.15 * csy} ${tx - 32.0 * csx},${ty + 17.5 * csy} ${tx - 16.0 * csx},${ty + 32.0 * csy} ${tx + 16.0 * csx},${ty + 32.0 * csy} ${tx + 32.0 * csx},${ty + 20.7 * csy} ${tx + 32.0 * csx},${ty - 123.15 * csy}`;

                    return (
                        <g key={obstacleKey}>
                            <polygon points={topPts} fill="#ffffff" />
                            <polygon points={leftChamferPts} fill="#a4a4a4" />
                            <polygon points={centerFrontPts} fill="#888888" />
                            <polygon points={rightChamferPts} fill="#bbbbbb" />
                            <polygon
                                points={outlinePts}
                                fill="none"
                                stroke="#000000"
                                strokeWidth="1.2"
                                strokeLinejoin="round"
                            />
                        </g>
                    );
                }

                if (obs.style === 'beveled_block') {
                    if (sw >= 200) {
                        const bsx = sw / 256;
                        const bsy = sh / 192;
                        const tx = sx + 128.0 * bsx;
                        const ty = sy + 64.0 * bsy;

                        const topPts = `${tx - 128.0 * bsx},${ty + 71.45 * bsy} ${tx - 128.0 * bsx},${ty - 92.45 * bsy} ${tx - 112.0 * bsx},${ty - 103.75 * bsy} ${tx + 112.0 * bsx},${ty - 103.75 * bsy} ${tx + 128.0 * bsx},${ty - 92.45 * bsy} ${tx + 128.0 * bsx},${ty + 71.45 * bsy} ${tx + 112.0 * bsx},${ty + 82.75 * bsy} ${tx - 112.0 * bsx},${ty + 82.75 * bsy}`;
                        const centerFrontPts = `${tx + 112.0 * bsx},${ty + 82.75 * bsy} ${tx + 112.0 * bsx},${ty + 128.0 * bsy} ${tx - 112.0 * bsx},${ty + 128.0 * bsy} ${tx - 112.0 * bsx},${ty + 82.75 * bsy}`;
                        const rightChamferPts = `${tx + 128.0 * bsx},${ty + 71.45 * bsy} ${tx + 128.0 * bsx},${ty + 116.7 * bsy} ${tx + 112.0 * bsx},${ty + 128.0 * bsy} ${tx + 112.0 * bsx},${ty + 82.75 * bsy}`;
                        const leftChamferPts = `${tx - 112.0 * bsx},${ty + 128.0 * bsy} ${tx - 128.0 * bsx},${ty + 116.7 * bsy} ${tx - 128.0 * bsx},${ty + 71.45 * bsy} ${tx - 112.0 * bsx},${ty + 82.75 * bsy}`;
                        const outlinePts = `${tx + 128.0 * bsx},${ty - 92.45 * bsy} ${tx + 112.0 * bsx},${ty - 103.75 * bsy} ${tx - 112.0 * bsx},${ty - 103.75 * bsy} ${tx - 128.0 * bsx},${ty - 92.45 * bsy} ${tx - 128.0 * bsx},${ty + 116.7 * bsy} ${tx - 112.0 * bsx},${ty + 128.0 * bsy} ${tx + 112.0 * bsx},${ty + 128.0 * bsy} ${tx + 128.0 * bsx},${ty + 116.7 * bsy}`;

                        return (
                            <g key={obstacleKey}>
                                <polygon points={topPts} fill="#ffffff" />
                                <polygon points={centerFrontPts} fill="#888888" />
                                <polygon points={rightChamferPts} fill="#bbbbbb" />
                                <polygon points={leftChamferPts} fill="#9b9b9b" />
                                <polygon
                                    points={outlinePts}
                                    fill="none"
                                    stroke="#000000"
                                    strokeWidth="1.2"
                                    strokeLinejoin="round"
                                />
                            </g>
                        );
                    }

                    const bsx = sw / 128;
                    const bsy = sh / 96;
                    const tx = sx + 64.0 * bsx;
                    const ty = sy + 64.0 * bsy;

                    const topPts = `${tx + 64.0 * bsx},${ty - 24.55 * bsy} ${tx + 48.0 * bsx},${ty - 13.25 * bsy} ${tx - 48.0 * bsx},${ty - 13.25 * bsy} ${tx - 64.0 * bsx},${ty - 24.55 * bsy} ${tx - 64.0 * bsx},${ty - 92.45 * bsy} ${tx - 48.0 * bsx},${ty - 103.75 * bsy} ${tx + 48.0 * bsx},${ty - 103.75 * bsy} ${tx + 64.0 * bsx},${ty - 92.45 * bsy}`;
                    const centerFrontPts = `${tx + 48.0 * bsx},${ty - 13.25 * bsy} ${tx + 48.0 * bsx},${ty + 32.0 * bsy} ${tx - 48.0 * bsx},${ty + 32.0 * bsy} ${tx - 48.0 * bsx},${ty - 13.25 * bsy}`;
                    const rightChamferPts = `${tx + 48.0 * bsx},${ty - 13.25 * bsy} ${tx + 64.0 * bsx},${ty - 24.55 * bsy} ${tx + 64.0 * bsx},${ty + 20.7 * bsy} ${tx + 48.0 * bsx},${ty + 32.0 * bsy}`;
                    const leftChamferPts = `${tx - 64.0 * bsx},${ty - 24.55 * bsy} ${tx - 48.0 * bsx},${ty - 13.25 * bsy} ${tx - 48.0 * bsx},${ty + 32.0 * bsy} ${tx - 64.0 * bsx},${ty + 20.7 * bsy}`;
                    const outlinePts = `${tx + 48.0 * bsx},${ty - 103.75 * bsy} ${tx - 48.0 * bsx},${ty - 103.75 * bsy} ${tx - 64.0 * bsx},${ty - 92.45 * bsy} ${tx - 64.0 * bsx},${ty + 20.7 * bsy} ${tx - 48.0 * bsx},${ty + 32.0 * bsy} ${tx + 48.0 * bsx},${ty + 32.0 * bsy} ${tx + 64.0 * bsx},${ty + 20.7 * bsy} ${tx + 64.0 * bsx},${ty - 92.45 * bsy}`;

                    return (
                        <g key={obstacleKey}>
                            <polygon points={topPts} fill="#ffffff" />
                            <polygon points={centerFrontPts} fill="#888888" />
                            <polygon points={rightChamferPts} fill="#bbbbbb" />
                            <polygon points={leftChamferPts} fill="#9b9b9b" />
                            <polygon
                                points={outlinePts}
                                fill="none"
                                stroke="#000000"
                                strokeWidth="1.2"
                                strokeLinejoin="round"
                            />
                        </g>
                    );
                }

                if (obs.style === 'pyramid_pillar') {
                    const bottomY = sy + sh;
                    const eaveY = sy + 7.45 * scaleH;
                    const shoulderY = sy - 37.8 * scaleH;
                    const apexX = sx + sw * 0.5;
                    const apexY = sy - 49.15 * scaleH;
                    const polyPts = `${sx},${bottomY} ${sx},${shoulderY} ${apexX},${apexY} ${sx + sw},${shoulderY} ${sx + sw},${bottomY}`;
                    return (
                        <g key={obstacleKey}>
                            <polygon points={polyPts} fill="#ffffff" />
                            <polygon points={`${apexX},${apexY} ${sx + sw},${eaveY} ${sx},${eaveY}`} fill="#b2b2b2" />
                            <rect x={sx} y={eaveY} width={sw} height={Math.max(2, bottomY - eaveY)} fill="#888888" />
                            <line x1={sx} y1={eaveY} x2={sx + sw} y2={eaveY} stroke="#9e9e9e" strokeWidth="1.0" />
                            <polygon points={polyPts} fill="none" stroke="#000000" strokeWidth="1.2" />
                        </g>
                    );
                }

                if (obs.style === 'vertical_wall') {
                    const vsx = sw / 64;
                    const vsy = sh / 128;
                    const refX = sx;
                    const refY = sy + 64.0 * vsy;
                    const whiteBottomY = neighbors?.hasLowerPillar ? refY + 26.5 * vsy : refY + 18.75 * vsy;
                    return (
                        <g key={obstacleKey}>
                            <rect
                                x={refX + 8.0 * vsx}
                                y={refY - 117.0 * vsy}
                                width={48.0 * vsx}
                                height={whiteBottomY - (refY - 117.0 * vsy)}
                                fill="#ffffff"
                            />
                            <rect
                                x={refX + 8.0 * vsx}
                                y={whiteBottomY}
                                width={48.0 * vsx}
                                height={refY + 64.0 * vsy - whiteBottomY}
                                fill="#888888"
                            />
                            {!neighbors?.hasLowerPillar && (
                                <rect
                                    x={refX + 8.0 * vsx}
                                    y={whiteBottomY - 1.2}
                                    width={48.0 * vsx}
                                    height={2.2}
                                    fill="#d4d4d8"
                                />
                            )}
                            <rect
                                x={refX + 8.0 * vsx}
                                y={refY - 117.0 * vsy}
                                width={48.0 * vsx}
                                height={181.0 * vsy}
                                fill="none"
                                stroke="#000000"
                                strokeWidth="1.2"
                            />
                        </g>
                    );
                }

                if (obs.style === 'concrete') {
                    const topY = neighbors?.hasUpperPillar ? sy - 24.55 * scaleH : sy - 26.5 * scaleH;
                    const eaveY = neighbors?.hasLowerPillar ? sy + 26.5 * scaleH : sy + 18.75 * scaleH;
                    const bottomY = sy + 64.0 * scaleH;
                    const totalVisualH = bottomY - topY;

                    return (
                        <g key={obstacleKey}>
                            <rect x={sx} y={topY} width={sw} height={eaveY - topY} fill="#ffffff" />
                            <rect x={sx} y={eaveY} width={sw} height={Math.max(2, bottomY - eaveY)} fill="#888888" />
                            {!neighbors?.hasLowerPillar && (
                                <>
                                    <rect
                                        x={sx}
                                        y={eaveY - 1.2 * scaleH}
                                        width={sw}
                                        height={2.2 * scaleH}
                                        fill="#d4d4d8"
                                    />
                                    <line
                                        x1={sx}
                                        y1={eaveY + 1.0 * scaleH}
                                        x2={sx + sw}
                                        y2={eaveY + 1.0 * scaleH}
                                        stroke="#a8a8b0"
                                        strokeWidth="0.9"
                                    />
                                </>
                            )}
                            <rect
                                x={sx}
                                y={topY}
                                width={sw}
                                height={totalVisualH}
                                fill="none"
                                stroke="#000000"
                                strokeWidth="1.2"
                            />
                        </g>
                    );
                }

                const topY = sy - 30.55 * scaleH;
                const eaveY = sy + 12.75 * scaleH;
                const bottomY = sy + 58.0 * scaleH;
                const totalH = bottomY - topY;

                return (
                    <g key={obstacleKey}>
                        <rect x={sx} y={topY} width={sw} height={eaveY - topY} fill="#ffffff" />
                        <rect x={sx} y={eaveY} width={sw} height={Math.max(2, bottomY - eaveY)} fill="#888888" />
                        <rect x={sx} y={eaveY - 1.2 * scaleH} width={sw} height={2.2 * scaleH} fill="#d4d4d8" />
                        <line
                            x1={sx}
                            y1={eaveY + 1.0 * scaleH}
                            x2={sx + sw}
                            y2={eaveY + 1.0 * scaleH}
                            stroke="#a8a8b0"
                            strokeWidth="0.9"
                        />
                        <rect
                            x={sx}
                            y={topY}
                            width={sw}
                            height={totalH}
                            fill="none"
                            stroke="#000000"
                            strokeWidth="1.2"
                        />
                    </g>
                );
            })}

            {showNodes && (
                <>
                    {/* Red playfield boundary box (_Size) & diagonal X lines */}
                    <rect x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#ff0000" strokeWidth="2.0" />
                    <line x1={b.x} y1={b.y} x2={b.x + b.w} y2={b.y + b.h} stroke="#ff0000" strokeWidth="1.6" />
                    <line x1={b.x + b.w} y1={b.y} x2={b.x} y2={b.y + b.h} stroke="#ff0000" strokeWidth="1.6" />
                </>
            )}

            {/* Spawn Nodes ('1', '2', 'P', 'Z', 'D', 'B', 'W') */}
            {showNodes &&
                (room.spawnNodes || []).map((node) => {
                    const nx = node.x;
                    const ny = node.y;
                    const fill =
                        node.kind === '1' || node.kind === '2'
                            ? 'rgba(0,0,255,0.5)'
                            : node.kind === 'P'
                              ? '#ff3300'
                              : node.kind === 'D'
                                ? '#ff0000'
                                : node.kind === 'B'
                                  ? '#ff6600'
                                  : node.kind === 'W'
                                    ? '#cccccc'
                                    : '#999999';
                    return (
                        <g key={`n-${node.kind}-${node.x}-${node.y}`}>
                            <circle cx={nx} cy={ny} r={13} fill={fill} stroke="rgba(0,0,255,0.5)" strokeWidth="1.2" />
                            <text x={nx} y={ny + 4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#000000">
                                {node.kind}
                            </text>
                        </g>
                    );
                })}
        </svg>
    );
};

/**
 * Static Hero Poster Canvas on the Homepage:
 * Renders a crisp static 3D .bbmodel battle scene once on mount (and when custom assets update)
 * with ZERO continuous requestAnimationFrame loop to minimize GPU resource consumption.
 */
export const BoxheadHeroDioramaArt: FC = () => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const renderStaticPoster = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const staticPoseTick = 0.65;
            const staticNowMs = 0;
            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            // Warm tan outer border & classic Boxhead cream-sand arena floor
            ctx.fillStyle = '#c8a97e';
            ctx.fillRect(0, 0, w, h);

            ctx.fillStyle = '#ebdec7';
            ctx.fillRect(18, 18, w - 36, h - 36);
            ctx.strokeStyle = '#78716c';
            ctx.lineWidth = 4;
            ctx.strokeRect(18, 18, w - 36, h - 36);

            // Subtle floor tile grid
            ctx.strokeStyle = 'rgba(0,0,0,0.06)';
            ctx.lineWidth = 1;
            for (let gx = 18; gx < w - 18; gx += 44) {
                ctx.beginPath();
                ctx.moveTo(gx, 18);
                ctx.lineTo(gx, h - 18);
                ctx.stroke();
            }
            for (let gy = 18; gy < h - 18; gy += 44) {
                ctx.beginPath();
                ctx.moveTo(18, gy);
                ctx.lineTo(w - 18, gy);
                ctx.stroke();
            }

            ctx.save();
            ctx.scale(1.65, 1.65);

            // 1. Tactical Floor Equipment: Claymore Mine & Dynamite Charge Pack
            drawBBModelAsset3D(ctx, 'mine', 185, 152, 0, 0, 1.0, {
                isTriggered: false,
                nowMs: staticNowMs,
            });
            drawBBModelAsset3D(ctx, 'charge_pack', 142, 188, 0, 0, 1.0, {
                nowMs: staticNowMs,
            });

            // 2. Two cylindrical barrels at top-center
            drawBBModelAsset3D(ctx, 'barrel', 155, 82, 0, 0, 1.1);
            drawBBModelAsset3D(ctx, 'barrel', 212, 82, 0, 0, 1.1);

            // 3. Classic red supply box
            drawBBModelAsset3D(ctx, 'red_box', 92, 95, 0, 0, 1.05);

            // 4. Pure white octagonal fake wall with battle damage cracks
            drawBBModelAsset3D(ctx, 'wall', 228, 134, 0, 0, 1.05, {
                damageRatio: 0.55,
            });

            // 5. Jon Bambo (Left-Center) firing Pistol toward the zombie horde (with authentic SVG muzzle flash & white hitscan bullet line)
            const bamboSpec = CHARACTERS[0];
            const bamboX = 78;
            const bamboY = 148;
            const bamboAng = 0.08;
            const muzzlePos = getPlayerWeaponMuzzleWorldPos(bamboX, bamboY, bamboAng, 'pistol');
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            ctx.moveTo(muzzlePos.screenX, muzzlePos.screenY);
            ctx.lineTo(muzzlePos.screenX + Math.cos(bamboAng) * 165, muzzlePos.screenY + Math.sin(bamboAng) * 165);
            ctx.stroke();
            ctx.restore();

            drawBoxheadHuman3D(
                ctx,
                bamboX,
                bamboY,
                bamboAng,
                staticPoseTick,
                true,
                false,
                true,
                'pistol',
                bamboSpec.skinColor,
                bamboSpec.hairColor,
                bamboSpec.shirtColor,
                bamboSpec.pantsColor,
                bamboSpec.bandanaColor,
                bamboSpec.glasses,
                'bambo',
                1,
                0,
                0.25,
                1,
            );

            // 6. Giant Red Devil Boss (Top-Right) & Glowing Fireball
            drawBoxheadEnemy3D(ctx, 318, 112, Math.PI * 0.88, staticPoseTick * 0.85, 'devil', false);

            // Fireball sphere in flight from Devil toward center
            const fbX = 258;
            const fbY = 104;
            ctx.fillStyle = 'rgba(245, 158, 11, 0.42)';
            ctx.beginPath();
            ctx.arc(fbX, fbY, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fde047';
            ctx.strokeStyle = '#ea580c';
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.arc(fbX, fbY, 11.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 7. Three Zombies Marching in Formation (Bottom-Right)
            drawBoxheadEnemy3D(ctx, 245, 188, Math.PI * 0.82, staticPoseTick, 'zombie', false);
            drawBoxheadEnemy3D(ctx, 292, 205, Math.PI * 0.85, staticPoseTick + 1.2, 'fast_zombie', false);
            drawBoxheadEnemy3D(ctx, 336, 184, Math.PI * 0.8, staticPoseTick + 2.4, 'zombie', false);

            ctx.restore();
        };

        let cancelled = false;
        void loadBBModelsByIds([
            'bambo',
            'zombie',
            'fast_zombie',
            'devil',
            'pistol',
            'mine',
            'charge_pack',
            'barrel',
            'red_box',
            'wall',
        ]);
        void preloadAllSvgEffectsWithProgress().then(() => {
            if (!cancelled) {
                renderStaticPoster();
            }
        });
        renderStaticPoster();
        const unsubCustom = customAssetStore.subscribe(renderStaticPoster);
        const unsubBB = subscribeBBModels(renderStaticPoster);
        return () => {
            cancelled = true;
            unsubCustom();
            unsubBB();
        };
    }, []);

    return (
        <div className="relative w-full h-full min-h-90 rounded-xl overflow-hidden border border-stone-700 bg-stone-900 flex flex-col justify-between p-6 select-none">
            <canvas
                ref={canvasRef}
                width={640}
                height={420}
                className="absolute inset-0 w-full h-full object-cover"
                aria-label={m.poster_label()}
            />

            {/* Bottom Scrim Overlay */}
            <div className="relative z-10 mt-auto pt-24 bg-linear-to-t from-stone-950/95 via-stone-950/75 to-transparent -mx-6 -mb-6 p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium text-red-400">{m.poster_caption()}</p>
                        <h3 className="text-lg font-bold text-white mt-0.5">{m.poster_description()}</h3>
                    </div>
                    <div className="text-right font-mono-tabular text-xs text-stone-300">
                        <span>{m.poster_modes()}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
