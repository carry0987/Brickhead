export interface WorldRenderItem {
    sortY: number;
    draw: () => void;
}

export interface WorldVisibleBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}
