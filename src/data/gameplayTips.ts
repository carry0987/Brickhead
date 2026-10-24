export const WORLD_CAMERA_ZOOM = 1.32;
export const LEGO_PROGRESS_STUDS = 12;

export type GameplayTipId = 'controls' | 'combo' | 'choke_point' | 'red_devil' | 'supply' | 'coop';

export interface GameplayTipItem {
    id: GameplayTipId;
    brickColor: string;
}

export const GAMEPLAY_TIPS: GameplayTipItem[] = [
    {
        id: 'controls',
        brickColor: '#ef4444',
    },
    {
        id: 'combo',
        brickColor: '#f59e0b',
    },
    {
        id: 'choke_point',
        brickColor: '#10b981',
    },
    {
        id: 'red_devil',
        brickColor: '#dc2626',
    },
    {
        id: 'supply',
        brickColor: '#3b82f6',
    },
    {
        id: 'coop',
        brickColor: '#8b5cf6',
    },
];
