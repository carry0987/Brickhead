import { Box, Check, Download, Eye, GitBranch, Layers, Swords, Upload, X } from 'lucide-react';
import type { ChangeEvent, FC } from 'react';
import { useEffect, useRef, useState } from 'react';
import { GameButton } from '@/components/ui/GameButton';
import { GameDialog } from '@/components/ui/GameDialog';
import {
    type BBAssetId,
    BBMODEL_CATALOG,
    BBMODEL_LIST,
    loadBBModelById,
    subscribeBBModels,
} from '@/data/bbmodelCatalog';
import { CHARACTERS } from '@/data/gameCatalog';
import { getBBModelDisplay, getWeaponDisplay } from '@/i18n/catalogI18n';
import * as m from '@/paraglide/messages';
import type { WeaponId } from '@/types/game';
import { compileBBModelTo8DirSheet, downloadBlockbenchStarterModel } from '@/utils/blockbenchBridge';
import { type CustomAssetSlot, customAssetStore } from '@/utils/customAssetStore';
import { drawBoxheadEnemy3D, drawBoxheadHuman3D } from '@/utils/rendering/isoCharacterRenderer';
import { drawBBModelAsset3D } from '@/utils/rendering/isoEquipmentRenderer';
import { soundFX } from '@/utils/sound';

interface ModelStudioModalProps {
    isOpen?: boolean;
    onClose: () => void;
}

const CATEGORY_TABS: Array<{
    id: 'ALL' | 'CHARACTER' | 'MONSTER' | 'WEAPON' | 'EQUIPMENT';
    label: string;
}> = [
    { id: 'ALL', label: m.model_category_all({ count: 18 }) },
    { id: 'CHARACTER', label: m.model_category_character({ count: 4 }) },
    { id: 'MONSTER', label: m.model_category_monster({ count: 3 }) },
    { id: 'WEAPON', label: m.model_category_weapon({ count: 6 }) },
    { id: 'EQUIPMENT', label: m.model_category_equipment({ count: 5 }) },
];

export const ModelStudioModal: FC<ModelStudioModalProps> = ({ isOpen = true, onClose }) => {
    const [selectedSlot, setSelectedSlot] = useState<CustomAssetSlot>('bambo');
    const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'CHARACTER' | 'MONSTER' | 'WEAPON' | 'EQUIPMENT'>(
        'ALL',
    );
    const [previewAngle, setPreviewAngle] = useState<number>(Math.PI * 0.25);
    const [autoRotate, setAutoRotate] = useState<boolean>(true);
    const [isMovingAnim, setIsMovingAnim] = useState<boolean>(true);
    const [equippedWeapon, setEquippedWeapon] = useState<WeaponId>('pistol');
    const [triggerRecoil] = useState<boolean>(false);
    const [_customVersion, setCustomVersion] = useState<number>(0);
    const [bbImportNotice, setBbImportNotice] = useState<string | null>(null);

    const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const bbFileInputRef = useRef<HTMLInputElement | null>(null);
    const angleRef = useRef<number>(Math.PI * 0.25);
    const walkCycleRef = useRef<number>(0);

    useEffect(() => {
        const unsubCustom = customAssetStore.subscribe(() => {
            setCustomVersion((v) => v + 1);
        });
        const unsubBB = subscribeBBModels(() => {
            setCustomVersion((v) => v + 1);
        });
        return () => {
            unsubCustom();
            unsubBB();
        };
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        void loadBBModelById(selectedSlot);
        if (
            selectedSlot === 'bambo' ||
            selectedSlot === 'bind' ||
            selectedSlot === 'bert' ||
            selectedSlot === 'sakamoto'
        ) {
            void loadBBModelById(equippedWeapon);
        }
    }, [isOpen, selectedSlot, equippedWeapon]);

    // Sync manual slider angle to ref when user drags slider
    useEffect(() => {
        angleRef.current = previewAngle;
    }, [previewAngle]);

    const currentModel = BBMODEL_CATALOG[selectedSlot];

    // Live 60FPS Skeletal Rigging & Joint Animation Preview Loop (zero React state updates per frame!)
    useEffect(() => {
        if (!isOpen) return;
        let rafId = 0;

        const renderPreview = () => {
            const canvas = previewCanvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    const w = canvas.width;
                    const h = canvas.height;
                    ctx.clearRect(0, 0, w, h);

                    // Warm beige-sand floor matching classic Boxhead 2Play Rooms
                    ctx.fillStyle = '#ddd3be';
                    ctx.fillRect(0, 0, w, h);

                    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
                    ctx.lineWidth = 1;
                    for (let gx = 0; gx < w; gx += 32) {
                        ctx.beginPath();
                        ctx.moveTo(gx, 0);
                        ctx.lineTo(gx, h);
                        ctx.stroke();
                    }
                    for (let gy = 0; gy < h; gy += 32) {
                        ctx.beginPath();
                        ctx.moveTo(0, gy);
                        ctx.lineTo(w, gy);
                        ctx.stroke();
                    }

                    if (autoRotate) {
                        angleRef.current = (angleRef.current + 0.016) % (Math.PI * 2);
                    }

                    if (isMovingAnim) {
                        walkCycleRef.current += 0.16;
                    }

                    const currentAngle = angleRef.current;
                    const walkCycle = walkCycleRef.current;

                    ctx.save();
                    ctx.translate(w / 2, h * 0.66);
                    ctx.scale(2.15, 2.15);

                    if (
                        selectedSlot === 'bambo' ||
                        selectedSlot === 'bind' ||
                        selectedSlot === 'bert' ||
                        selectedSlot === 'sakamoto'
                    ) {
                        const spec = CHARACTERS.find((c) => c.id === selectedSlot) || CHARACTERS[0];
                        const cycleT = triggerRecoil ? (performance.now() % 900) / 900 : 1;
                        const previewMuzzleProgress = triggerRecoil ? Math.min(1, cycleT * 2.2) : 0;
                        drawBoxheadHuman3D(
                            ctx,
                            0,
                            0,
                            currentAngle,
                            walkCycle,
                            isMovingAnim,
                            false,
                            triggerRecoil && cycleT < 0.45,
                            equippedWeapon,
                            spec.skinColor,
                            spec.hairColor,
                            spec.shirtColor,
                            spec.pantsColor,
                            spec.bandanaColor,
                            spec.glasses,
                            spec.id,
                            0,
                            0,
                            previewMuzzleProgress,
                            cycleT,
                        );
                    } else if (
                        selectedSlot === 'zombie' ||
                        selectedSlot === 'fast_zombie' ||
                        selectedSlot === 'devil'
                    ) {
                        const previewAtkProg = triggerRecoil ? (performance.now() % 420) / 420 : 0;
                        drawBoxheadEnemy3D(
                            ctx,
                            0,
                            0,
                            currentAngle,
                            walkCycle,
                            selectedSlot,
                            false,
                            0,
                            0,
                            1,
                            previewAtkProg,
                        );
                    } else {
                        drawBBModelAsset3D(ctx, selectedSlot as BBAssetId, 0, 0, currentAngle, walkCycle, 1.25, {
                            damageRatio: triggerRecoil ? 0.32 : 1.0,
                            isTriggered: triggerRecoil,
                            nowMs: performance.now(),
                        });
                    }

                    ctx.restore();
                }
            }
            rafId = requestAnimationFrame(renderPreview);
        };

        rafId = requestAnimationFrame(renderPreview);
        return () => cancelAnimationFrame(rafId);
    }, [isOpen, selectedSlot, autoRotate, isMovingAnim, equippedWeapon, triggerRecoil]);

    if (!isOpen) {
        return null;
    }

    const handleBBModelUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            await compileBBModelTo8DirSheet(text, selectedSlot);
            customAssetStore.removeAsset(selectedSlot);
            setCustomVersion((v) => v + 1);
            setBbImportNotice(m.model_import_success({ file: file.name }));
            setTimeout(() => setBbImportNotice(null), 6000);
        } catch (err) {
            setBbImportNotice(
                m.model_import_failure({ error: err instanceof Error ? err.message : m.model_format_error() }),
            );
        }
        e.target.value = '';
    };

    const filteredAssets = BBMODEL_LIST.filter((item) => categoryFilter === 'ALL' || item.category === categoryFilter);

    const boneEntries = Object.entries(currentModel.bones);
    const handleClose = () => {
        soundFX.playClick();
        onClose();
    };

    return (
        <GameDialog
            isOpen={isOpen}
            onClose={handleClose}
            title={m.model_studio_title()}
            description={m.model_studio_description()}
            className="max-w-6xl">
            {/* Top Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-stone-950 border-b border-stone-800">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                        <Box className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black tracking-tight text-white">{m.model_studio_title()}</h2>
                            <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded">
                                18 ASSETS · SKELETAL RIGGED v4.5
                            </span>
                        </div>
                        <p className="text-xs text-stone-400">{m.model_studio_overview()}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <GameButton
                        type="button"
                        onClick={handleClose}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-colors shadow-md cursor-pointer select-none">
                        <X className="w-4 h-4" />
                        {m.model_studio_close()}
                    </GameButton>
                </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 px-6 py-2.5 bg-stone-900/90 border-b border-stone-800">
                {CATEGORY_TABS.map((tab) => (
                    <GameButton
                        type="button"
                        key={tab.id}
                        onClick={() => {
                            setCategoryFilter(tab.id);
                            const firstInCategory = BBMODEL_LIST.find(
                                (item) => tab.id === 'ALL' || item.category === tab.id,
                            );
                            if (firstInCategory) {
                                setSelectedSlot(firstInCategory.id);
                            }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer select-none ${
                            categoryFilter === tab.id
                                ? 'bg-red-600 text-white shadow-sm'
                                : 'bg-stone-800/80 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                        }`}>
                        {tab.label}
                    </GameButton>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12">
                {/* Left Column: All 18 .bbmodel Asset Selector */}
                <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-stone-800 p-4 bg-stone-950/50 space-y-2 max-h-150 overflow-y-auto">
                    <div className="flex items-center justify-between px-1 mb-1">
                        <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
                            {m.model_studio_select_model({ count: filteredAssets.length })}
                        </span>
                    </div>
                    {filteredAssets.map((item) => {
                        const isSelected = selectedSlot === item.id;
                        const boneCount = Object.keys(item.bones).length;
                        return (
                            <GameButton
                                type="button"
                                key={item.id}
                                onClick={() => setSelectedSlot(item.id)}
                                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer select-none ${
                                    isSelected
                                        ? 'bg-red-950/40 border-red-500 text-white shadow-sm'
                                        : 'bg-stone-900/70 border-stone-800 text-stone-300 hover:border-stone-700'
                                }`}>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-amber-300 border border-stone-700">
                                            {item.category}
                                        </span>
                                        <span className="font-bold text-xs truncate">{getBBModelDisplay(item.id)}</span>
                                    </div>
                                    <div className="text-[11px] text-stone-400 truncate mt-1 font-mono">
                                        {m.model_studio_blocks_bones({ blocks: item.cubes.length, bones: boneCount })}
                                    </div>
                                </div>
                            </GameButton>
                        );
                    })}
                </div>

                {/* Center Column: Interactive 3D Skeletal Preview & Bone Rigging Inspector */}
                <div className="lg:col-span-4 p-5 border-b lg:border-b-0 lg:border-r border-stone-800 flex flex-col justify-between bg-stone-900">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5 text-red-400" />
                                {m.model_studio_preview()}
                            </span>
                        </div>

                        <div className="relative rounded-xl overflow-hidden border-2 border-stone-700 shadow-inner bg-[#ddd3be] flex items-center justify-center">
                            <canvas
                                ref={previewCanvasRef}
                                width={320}
                                height={230}
                                className="w-full h-53.75 object-contain"
                            />
                            <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded bg-stone-950/85 border border-stone-700 text-[10px] font-mono text-amber-300">
                                {currentModel.filePath}
                            </div>
                            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                                <GameButton
                                    type="button"
                                    onClick={() => setAutoRotate((r) => !r)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer select-none ${
                                        autoRotate
                                            ? 'bg-stone-900/90 border-amber-500/60 text-amber-300'
                                            : 'bg-stone-900/80 border-stone-700 text-stone-300'
                                    }`}>
                                    {autoRotate ? m.model_studio_auto_rotate() : m.model_studio_fixed_view()}
                                </GameButton>

                                <GameButton
                                    type="button"
                                    onClick={() => setIsMovingAnim((m) => !m)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer select-none ${
                                        isMovingAnim
                                            ? 'bg-stone-900/90 border-emerald-500/60 text-emerald-300'
                                            : 'bg-stone-900/80 border-stone-700 text-stone-300'
                                    }`}>
                                    {isMovingAnim ? m.model_studio_walk_enabled() : m.model_studio_idle_enabled()}
                                </GameButton>
                            </div>
                        </div>

                        {/* Manual Angle Slider */}
                        <div className="mt-3 space-y-2.5">
                            <div className="flex items-center gap-2.5">
                                <span className="text-xs font-bold text-stone-300 shrink-0">
                                    {m.model_studio_view_angle()}
                                </span>
                                <input
                                    type="range"
                                    min={0}
                                    max={Math.PI * 2}
                                    step={0.05}
                                    value={previewAngle}
                                    onChange={(e) => {
                                        const val = parseFloat(e.target.value);
                                        setAutoRotate(false);
                                        setPreviewAngle(val);
                                        angleRef.current = val;
                                    }}
                                    className="flex-1 accent-red-500 cursor-pointer"
                                />
                            </div>

                            {/* Weapon Mount Selector for Human Characters */}
                            {currentModel.category === 'CHARACTER' && (
                                <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800">
                                    <div className="text-[11px] font-bold text-stone-300 mb-1.5 flex items-center gap-1.5">
                                        <Swords className="w-3.5 h-3.5 text-amber-400" />
                                        {m.model_weapon_mount()}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {(['pistol', 'uzi', 'shotgun', 'rocket', 'railgun'] as WeaponId[]).map(
                                            (wId) => {
                                                return (
                                                    <GameButton
                                                        type="button"
                                                        key={wId}
                                                        onClick={() => setEquippedWeapon(wId)}
                                                        className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer select-none ${
                                                            equippedWeapon === wId
                                                                ? 'bg-amber-500 text-stone-950'
                                                                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                                                        }`}>
                                                        {getWeaponDisplay(wId)}
                                                    </GameButton>
                                                );
                                            },
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Live Bone Outliner Inspector */}
                    <div className="mt-3 p-3 rounded-xl bg-stone-950/90 border border-stone-800">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                <GitBranch className="w-3.5 h-3.5" />
                                {m.model_studio_bone_outliner()}
                            </span>
                            <span className="text-[10px] font-mono text-stone-400">
                                {m.model_studio_bones_blocks({
                                    bones: boneEntries.length,
                                    blocks: currentModel.cubes.length,
                                })}
                            </span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1 font-mono text-[11px]">
                            {boneEntries.map(([boneName, info]) => (
                                <div
                                    key={boneName}
                                    className="flex items-center justify-between px-2 py-1 rounded bg-stone-900/90 border border-stone-800/80 text-stone-300">
                                    <span className="truncate text-amber-300">{boneName}</span>
                                    <span className="text-[10px] text-stone-400">pivot [{info.origin.join(', ')}]</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Blockbench .bbmodel Export / Import & Cube Mesh Inspector */}
                <div className="lg:col-span-4 p-5 bg-stone-900 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                        <div className="p-3.5 rounded-xl bg-amber-950/25 border border-amber-500/40 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                                    <Box className="w-4 h-4 shrink-0" />
                                    <span>{m.model_studio_export_import()}</span>
                                </div>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                    {m.model_texture_animation_badge()}
                                </span>
                            </div>
                            <p className="text-xs text-stone-300 leading-relaxed">{m.model_texture_animation_help()}</p>

                            <div className="grid grid-cols-1 gap-2 pt-1">
                                <GameButton
                                    type="button"
                                    onClick={() => downloadBlockbenchStarterModel(selectedSlot)}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs transition-colors shadow-md cursor-pointer select-none">
                                    <Download className="w-4 h-4" />
                                    {m.model_studio_download({ model: selectedSlot })}
                                </GameButton>

                                <GameButton
                                    type="button"
                                    onClick={() => bbFileInputRef.current?.click()}
                                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors shadow-md cursor-pointer select-none">
                                    <Upload className="w-4 h-4" />
                                    {m.model_studio_upload()}
                                </GameButton>
                            </div>

                            <input
                                ref={bbFileInputRef}
                                type="file"
                                accept=".bbmodel,.json,application/json"
                                onChange={handleBBModelUpload}
                                className="hidden"
                            />

                            {bbImportNotice && (
                                <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
                                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>{bbImportNotice}</span>
                                </div>
                            )}
                        </div>

                        {/* 3D Cube Elements & Bone Binding List */}
                        <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                                    {m.model_studio_cube_inspector({ count: currentModel.cubes.length })}
                                </span>
                            </div>
                            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                                {currentModel.cubes.map((cube) => {
                                    const parentBone = cube.bonePath[cube.bonePath.length - 1] || 'root';
                                    return (
                                        <div
                                            key={cube.uuid}
                                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-stone-900 border border-stone-800/90">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className="w-3 h-3 rounded-sm border border-stone-600 shrink-0"
                                                    style={{ backgroundColor: cube.hexColor }}
                                                />
                                                <span className="text-stone-200 truncate">{cube.name}</span>
                                            </div>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-800 text-emerald-300 shrink-0">
                                                ↳ {parentBone}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </GameDialog>
    );
};
