import { CheckCircle2, Eye, EyeOff, GitBranch, Layers, MapPin, Maximize2, X } from 'lucide-react';
import type { FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { GameButton } from '@/components/ui/GameButton';
import { GameDialog } from '@/components/ui/GameDialog';
import { loadRoomById, ROOMS } from '@/data/gameCatalog';
import { getRoomDisplay } from '@/i18n/catalogI18n';
import * as m from '@/paraglide/messages';
import type { RoomId } from '@/types/game';
import {
    computeObstacleNeighborFlags,
    drawExtrudedBlock,
    drawExtrudedBlockShadow,
    drawRoomBoundsAndSpawnNodes,
    drawSwfFloorStain,
} from '@/utils/rendering/isoObstacleRenderer';
import { soundFX } from '@/utils/sound';

interface MapViewerModalProps {
    isOpen: boolean;
    selectedRoomId: RoomId;
    onSelectRoom: (roomId: RoomId) => void;
    onClose: () => void;
}

export const MapViewerModal: FC<MapViewerModalProps> = ({ isOpen, selectedRoomId, onSelectRoom, onClose }) => {
    const [inspectingRoomId, setInspectingRoomId] = useState<RoomId>(selectedRoomId);
    const [showNodes, setShowNodes] = useState<boolean>(true);
    const [showSwfCollision, setShowSwfCollision] = useState<boolean>(true);
    const [isPreviewReady, setIsPreviewReady] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const roomListRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            setInspectingRoomId(selectedRoomId);
        }
    }, [isOpen, selectedRoomId]);

    useEffect(() => {
        if (!isOpen) return;
        const frameId = window.requestAnimationFrame(() => {
            const selectedRoomButton = Array.from(
                roomListRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
            ).find((button) => button.dataset.roomId === inspectingRoomId);
            selectedRoomButton?.scrollIntoView({ block: 'center' });
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [inspectingRoomId, isOpen]);

    const room = ROOMS.find((r) => r.id === inspectingRoomId) || ROOMS[0];
    const roomDisplay = getRoomDisplay(room.id);

    useEffect(() => {
        if (!isOpen) return;
        let isActive = true;
        setIsPreviewReady(false);
        void loadRoomById(inspectingRoomId).then(() => {
            if (isActive) setIsPreviewReady(true);
        });
        ROOMS.forEach((r) => {
            if (!r.isLoaded) void loadRoomById(r.id);
        });
        return () => {
            isActive = false;
        };
    }, [isOpen, inspectingRoomId]);

    useEffect(() => {
        if (!isOpen || !isPreviewReady || !room.isLoaded) return;
        const frameId = window.requestAnimationFrame(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            const worldW = room.worldWidth || 721;
            const worldH = room.worldHeight || 801;
            canvas.width = worldW;
            canvas.height = worldH;

            ctx.clearRect(0, 0, worldW, worldH);

            // 1. Base warm sand/concrete floor (#sprite0 inside bounds)
            ctx.fillStyle = room.floorColor || '#ebdcc7';
            ctx.fillRect(room.bounds.x, room.bounds.y, room.bounds.w, room.bounds.h);

            // 2. Authentic SWF organic floor stain (#sprite1 / #shape1)
            drawSwfFloorStain(ctx, room.bounds, room.patchColor || '#d8cccc', room.stainTransforms);

            // 3. Sort and render all 2.5D obstacles & walls (Floor shadows first, then 3D bodies)
            const sortedObstacles = [...room.obstacles].sort((a, b) => {
                const dy = a.y + a.h - (b.y + b.h);
                if (Math.abs(dy) > 0.5) return dy;
                const aIsPillar = a.style === 'pyramid_pillar' ? 1 : 0;
                const bIsPillar = b.style === 'pyramid_pillar' ? 1 : 0;
                return aIsPillar - bIsPillar;
            });
            const neighborMap = computeObstacleNeighborFlags(sortedObstacles);

            sortedObstacles.forEach((ob) => {
                drawExtrudedBlockShadow(ctx, ob.x, ob.y, ob.w, ob.h, ob.style || 'classic_blue');
            });

            sortedObstacles.forEach((ob, idx) => {
                const style = ob.style || 'classic_blue';
                drawExtrudedBlock(
                    ctx,
                    ob.x,
                    ob.y,
                    ob.w,
                    ob.h,
                    42,
                    room.wallTopColor,
                    room.wallSideColor,
                    '#000000',
                    false,
                    style,
                    room.wallBevelColor,
                    neighborMap.get(idx),
                );
            });

            // 4. Optional SWF Spawn Nodes (1 / 2 / P / Z / D / B / W), Red Camera Extreme Limit Box & Blue CollisionSolid
            if (showNodes || showSwfCollision) {
                drawRoomBoundsAndSpawnNodes(
                    ctx,
                    room.bounds,
                    showNodes ? room.spawnNodes : [],
                    room.obstacles,
                    showSwfCollision,
                );
            }
        });

        return () => window.cancelAnimationFrame(frameId);
    }, [isOpen, isPreviewReady, room, showNodes, showSwfCollision]);

    if (!isOpen) return null;

    const countNode = (kind: '1' | '2' | 'P' | 'Z' | 'D' | 'B' | 'W') =>
        room.spawnNodes.filter((n) => n.kind === kind).length;
    const handleClose = () => {
        soundFX.playClick();
        onClose();
    };

    return (
        <GameDialog
            isOpen={isOpen}
            onClose={handleClose}
            title={m.map_viewer_title()}
            description={m.map_viewer_description()}
            className="max-w-6xl">
            {/* Top Header (Modeled directly after ModelStudioModal) */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-stone-950 border-b border-stone-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-400">
                        <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black tracking-tight text-white">{m.map_viewer_title()}</h2>
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                                {ROOMS.length} ROOMS · 2.5D SWF INSPECTOR
                            </span>
                        </div>
                        <p className="text-xs text-stone-400">{m.map_viewer_technical_overview()}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <GameButton
                        type="button"
                        onClick={() => {
                            soundFX.playClick();
                            handleClose();
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-colors shadow-md cursor-pointer select-none">
                        <X className="w-4 h-4" />
                        {m.map_viewer_close()}
                    </GameButton>
                </div>
            </div>

            {/* 3-Column Body (Matching ModelStudioModal structure) */}
            <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left Column: Room Selector List */}
                <div
                    ref={roomListRef}
                    className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-stone-800 p-4 bg-stone-950/50 space-y-2 max-h-150 overflow-y-auto">
                    <div className="flex items-center justify-between px-1 mb-1">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
                            {m.map_viewer_select_room({ count: ROOMS.length })}
                        </span>
                    </div>
                    {ROOMS.map((item) => {
                        const isSelected = inspectingRoomId === item.id;
                        const isEquipped = selectedRoomId === item.id;
                        const itemDisplay = getRoomDisplay(item.id);
                        return (
                            <GameButton
                                type="button"
                                key={item.id}
                                data-room-id={item.id}
                                onClick={() => {
                                    soundFX.playClick();
                                    setInspectingRoomId(item.id);
                                }}
                                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer select-none ${
                                    isSelected
                                        ? 'bg-red-950/40 border-red-500 text-white shadow-sm'
                                        : 'bg-stone-900/70 border-stone-800 text-stone-300 hover:border-stone-700'
                                }`}>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-xs truncate">{itemDisplay.name}</span>
                                    </div>
                                    <div className="text-[11px] text-stone-400 truncate mt-1 font-mono">
                                        {m.map_viewer_room_summary({
                                            width: item.worldWidth,
                                            height: item.worldHeight,
                                            obstacles: item.obstacles.length,
                                            nodes: item.spawnNodes.length,
                                        })}
                                    </div>
                                </div>
                                {isEquipped ? (
                                    <span className="shrink-0 px-2 py-0.5 text-[10px] font-mono text-emerald-300 bg-emerald-950/80 border border-emerald-500/50 rounded">
                                        {m.map_viewer_current_room()}
                                    </span>
                                ) : (
                                    <span className="shrink-0 px-2 py-0.5 text-[10px] font-mono text-stone-300 bg-stone-800 border border-stone-700 rounded">
                                        {m.map_viewer_map_badge()}
                                    </span>
                                )}
                            </GameButton>
                        );
                    })}
                </div>

                {/* Center Column: Interactive 2.5D Room Preview & Specs */}
                <div className="lg:col-span-5 p-5 border-b lg:border-b-0 lg:border-r border-stone-800 flex flex-col justify-between bg-stone-900">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5 text-red-400" />
                                {m.map_viewer_preview()}
                            </span>
                        </div>

                        <div className="relative rounded-xl overflow-hidden border-2 border-stone-700 shadow-inner bg-stone-950 p-2 flex items-center justify-center">
                            <canvas ref={canvasRef} className="w-full h-75 object-contain rounded-lg select-none" />
                            {!isPreviewReady && (
                                <div className="absolute inset-0 flex items-center justify-center bg-stone-950/90 text-xs font-bold text-amber-300">
                                    {m.map_viewer_loading_preview({ room: roomDisplay.name })}
                                </div>
                            )}
                            <div className="absolute top-3 left-3 px-2 py-1 rounded bg-stone-950/90 border border-stone-700 text-[10px] font-mono text-amber-300">
                                {roomDisplay.name} ({room.worldWidth}×{room.worldHeight})
                            </div>
                            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-stone-950/85 border border-stone-700 text-stone-200">
                                    {m.map_viewer_visible_bounds({
                                        width: room.bounds.w,
                                        height: room.bounds.h,
                                    })}
                                </span>
                                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-stone-950/85 border border-amber-500/40 text-amber-300">
                                    {m.map_viewer_obstacles({ count: room.obstacles.length })}
                                </span>
                            </div>
                        </div>

                        <div className="mt-3 p-3.5 rounded-xl bg-stone-950/90 border border-stone-800 space-y-1.5">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-white">{roomDisplay.name}</span>
                            </div>
                            <p className="text-xs text-stone-300 leading-relaxed">{roomDisplay.description}</p>
                        </div>
                    </div>

                    {/* Bottom Outliner Summary for Obstacles */}
                    <div className="mt-3 p-3 rounded-xl bg-stone-950/90 border border-stone-800">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                <GitBranch className="w-3.5 h-3.5" />
                                {m.map_viewer_obstacle_outliner()}
                            </span>
                            <span className="text-[10px] font-mono text-stone-400">
                                {m.map_viewer_obstacle_count({ count: room.obstacles.length })}
                            </span>
                        </div>
                        <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                            {room.obstacles.map((ob, idx) => (
                                <div
                                    key={`${ob.x}-${ob.y}-${ob.w}-${ob.h}-${ob.style}`}
                                    className="flex items-center justify-between px-2 py-1 rounded bg-stone-900/90 border border-stone-800/80 text-stone-300">
                                    <span className="truncate text-amber-300">
                                        #{idx + 1} {ob.style || 'classic_blue'}
                                    </span>
                                    <span className="text-[10px] text-stone-400">
                                        [{ob.x}, {ob.y}] · {ob.w}×{ob.h}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Tactical Deployment & Spawn Nodes Inspector */}
                <div className="lg:col-span-3 p-5 bg-stone-900 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <GameButton
                                type="button"
                                onClick={() => {
                                    soundFX.playClick();
                                    setShowNodes((prev) => !prev);
                                }}
                                className={`flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs font-bold transition-colors cursor-pointer select-none ${
                                    showNodes
                                        ? 'border-red-500 bg-red-950/70 text-red-200'
                                        : 'border-stone-700 bg-stone-800 text-stone-300 hover:bg-stone-700'
                                }`}>
                                {showNodes ? (
                                    <Eye className="w-3.5 h-3.5 text-red-400" />
                                ) : (
                                    <EyeOff className="w-3.5 h-3.5 text-stone-400" />
                                )}
                                <span>
                                    {m.map_viewer_node_toggle({ state: showNodes ? m.toggle_on() : m.toggle_off() })}
                                </span>
                            </GameButton>

                            <GameButton
                                type="button"
                                onClick={() => {
                                    soundFX.playClick();
                                    setShowSwfCollision((prev) => !prev);
                                }}
                                className={`flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-left text-xs font-bold transition-colors cursor-pointer select-none ${
                                    showSwfCollision
                                        ? 'border-indigo-500 bg-indigo-950/70 text-indigo-200'
                                        : 'border-stone-700 bg-stone-800 text-stone-300 hover:bg-stone-700'
                                }`}>
                                {showSwfCollision ? (
                                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                                ) : (
                                    <EyeOff className="w-3.5 h-3.5 text-stone-400" />
                                )}
                                <span>
                                    {m.map_viewer_collision_toggle({
                                        state: showSwfCollision ? m.toggle_on() : m.toggle_off(),
                                    })}
                                </span>
                            </GameButton>
                        </div>

                        <div className="p-3.5 rounded-xl bg-red-950/25 border border-red-500/40 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-red-300 font-bold text-xs">
                                    <Maximize2 className="w-4 h-4 shrink-0" />
                                    <span>{m.map_viewer_configuration()}</span>
                                </div>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                                    {m.map_viewer_flow_field()}
                                </span>
                            </div>
                            <p className="text-xs text-stone-300 leading-relaxed">{m.map_viewer_node_help()}</p>

                            <GameButton
                                type="button"
                                onClick={() => {
                                    soundFX.playClick();
                                    onSelectRoom(room.id);
                                }}
                                className={`w-full py-2.5 px-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md cursor-pointer select-none ${
                                    room.id === selectedRoomId
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                                }`}>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>
                                    {room.id === selectedRoomId ? m.map_viewer_selected() : m.map_viewer_select()}
                                </span>
                            </GameButton>
                        </div>

                        {/* Spawn Nodes Breakdown */}
                        <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-red-400" />
                                    {m.map_viewer_spawn_points({ count: room.spawnNodes.length })}
                                </span>
                            </div>

                            <div className="space-y-1.5 text-xs font-mono">
                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800/90">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-blue-600/60 text-white border border-blue-400 font-black flex items-center justify-center text-[11px]">
                                            1
                                        </span>
                                        <span className="text-stone-200">{m.map_viewer_spawn_p1()}</span>
                                    </div>
                                    <span className="font-bold text-white">
                                        {m.map_viewer_points({ count: countNode('1') })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800/90">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-blue-600/60 text-white border border-blue-400 font-black flex items-center justify-center text-[11px]">
                                            2
                                        </span>
                                        <span className="text-stone-200">{m.map_viewer_spawn_p2()}</span>
                                    </div>
                                    <span className="font-bold text-white">
                                        {m.map_viewer_points({ count: countNode('2') })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800/90">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-[#ff3300] text-black border border-blue-500/50 font-black flex items-center justify-center text-[11px]">
                                            P
                                        </span>
                                        <span className="text-stone-200">{m.map_viewer_spawn_pickup()}</span>
                                    </div>
                                    <span className="font-bold text-amber-400">
                                        {m.map_viewer_points({ count: countNode('P') })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800/90">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-[#999999] text-black border border-blue-500/50 font-black flex items-center justify-center text-[11px]">
                                            Z
                                        </span>
                                        <span className="text-stone-200">{m.map_viewer_spawn_zombie()}</span>
                                    </div>
                                    <span className="font-bold text-emerald-400">
                                        {m.map_viewer_points({ count: countNode('Z') })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800/90">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-[#ff0000] text-black border border-blue-500/50 font-black flex items-center justify-center text-[11px]">
                                            D
                                        </span>
                                        <span className="text-stone-200">{m.map_viewer_spawn_devil()}</span>
                                    </div>
                                    <span className="font-bold text-red-400">
                                        {m.map_viewer_points({ count: countNode('D') })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800/90">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-[#ff6600] text-black border border-blue-500/50 font-black flex items-center justify-center text-[11px]">
                                            B
                                        </span>
                                        <span className="text-stone-200">{m.map_viewer_spawn_barrel()}</span>
                                    </div>
                                    <span className="font-bold text-orange-400">
                                        {m.map_viewer_points({ count: countNode('B') })}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800/90">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded-full bg-[#cccccc] text-black border border-blue-500/50 font-black flex items-center justify-center text-[11px]">
                                            W
                                        </span>
                                        <span className="text-stone-200">{m.map_viewer_spawn_wall()}</span>
                                    </div>
                                    <span className="font-bold text-stone-300">
                                        {m.map_viewer_points({ count: countNode('W') })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </GameDialog>
    );
};
