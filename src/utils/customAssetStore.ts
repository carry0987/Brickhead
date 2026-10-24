import type { BBAssetId } from '@/data/bbmodelCatalog';

export type CustomAssetSlot = BBAssetId;

export interface CustomSpriteEntry {
    slot: CustomAssetSlot;
    dataUrl: string;
    mode: 'single_rotatable' | 'single_upright' | 'sheet_8dir';
    scale: number;
    customBBModelJson?: string;
}

const STORAGE_KEY = 'boxhead_custom_sprites_v1';

class CustomAssetManager {
    private entries = new Map<CustomAssetSlot, CustomSpriteEntry>();
    private images = new Map<CustomAssetSlot, HTMLImageElement>();
    private listeners = new Set<() => void>();

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed: CustomSpriteEntry[] = JSON.parse(raw);
            parsed.forEach((item) => {
                this.entries.set(item.slot, item);
                this.preloadImage(item.slot, item.dataUrl);
            });
        } catch {
            // Ignore storage errors
        }
    }

    private saveToStorage() {
        try {
            const arr = Array.from(this.entries.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        } catch {
            // Ignore quota errors
        }
    }

    private preloadImage(slot: CustomAssetSlot, dataUrl: string) {
        const img = new Image();
        img.onload = () => {
            this.images.set(slot, img);
            this.notify();
        };
        img.src = dataUrl;
    }

    public setAsset(
        slot: CustomAssetSlot,
        dataUrl: string,
        mode: 'single_rotatable' | 'single_upright' | 'sheet_8dir' = 'single_upright',
        scale: number = 1.0,
        customBBModelJson?: string,
    ) {
        const entry: CustomSpriteEntry = {
            slot,
            dataUrl,
            mode,
            scale,
            customBBModelJson,
        };
        this.entries.set(slot, entry);
        this.preloadImage(slot, dataUrl);
        this.saveToStorage();
        this.notify();
    }

    public removeAsset(slot: CustomAssetSlot) {
        this.entries.delete(slot);
        this.images.delete(slot);
        this.saveToStorage();
        this.notify();
    }

    public getEntry(slot: CustomAssetSlot): CustomSpriteEntry | undefined {
        return this.entries.get(slot);
    }

    public getAllEntries(): CustomSpriteEntry[] {
        return Array.from(this.entries.values());
    }

    public hasAnyCustom(): boolean {
        return this.entries.size > 0;
    }

    public clearAll() {
        this.entries.clear();
        this.images.clear();
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }
        this.notify();
    }

    public getImage(slot: CustomAssetSlot): HTMLImageElement | undefined {
        const img = this.images.get(slot);
        if (img?.complete && img.naturalWidth > 0) {
            return img;
        }
        return undefined;
    }

    public subscribe(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private notify() {
        for (const fn of this.listeners) fn();
    }
}

export const customAssetStore = new CustomAssetManager();
