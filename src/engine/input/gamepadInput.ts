export interface GamepadPlayerInput {
    moveX: number;
    moveY: number;
    shooting: boolean;
    shootPressed: boolean;
    previousWeaponPressed: boolean;
    nextWeaponPressed: boolean;
    pausePressed: boolean;
}

const DEADZONE = 0.2;
const TRIGGER_THRESHOLD = 0.5;
const BUTTONS = { previousWeapon: 4, nextWeapon: 5, shoot: 7, pause: 9 } as const;

interface GamepadSnapshot {
    index: number;
    id: string;
    connected: boolean;
    mapping: string;
    axes: readonly number[];
    buttons: ReadonlyArray<Pick<GamepadButton, 'pressed' | 'value'>>;
}

interface Slot {
    index: number;
    id: string;
    buttons: Set<number>;
}

export class GamepadInputManager {
    private slots: Array<Slot | undefined> = [undefined, undefined];

    poll(gamepads: ArrayLike<GamepadSnapshot | null>): Array<GamepadPlayerInput | undefined> {
        const connected = Array.from(gamepads).filter((pad): pad is GamepadSnapshot =>
            Boolean(pad?.connected && pad.mapping === 'standard'),
        );

        for (let i = 0; i < this.slots.length; i++) {
            const slot = this.slots[i];
            if (slot && !connected.some((pad) => pad.index === slot.index && pad.id === slot.id)) {
                this.slots[i] = undefined;
            }
        }
        for (const pad of connected) {
            if (this.slots.some((slot) => slot?.index === pad.index)) continue;
            const available = this.slots.findIndex((slot) => !slot);
            if (available === -1) break;
            this.slots[available] = { index: pad.index, id: pad.id, buttons: new Set() };
        }

        return this.slots.map((slot) => {
            if (!slot) return undefined;
            const pad = connected.find((candidate) => candidate.index === slot.index && candidate.id === slot.id);
            if (!pad) return undefined;

            const axis = (index: number) => {
                const value = pad.axes[index] ?? 0;
                return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
            };
            const x = axis(0);
            const y = axis(1);
            const moving = Math.hypot(x, y) > DEADZONE;
            const pressed = new Set<number>();
            for (const index of Object.values(BUTTONS)) {
                const button = pad.buttons[index];
                if (button && (button.pressed || (index === BUTTONS.shoot && button.value >= TRIGGER_THRESHOLD))) {
                    pressed.add(index);
                }
            }
            const justPressed = (index: number) => pressed.has(index) && !slot.buttons.has(index);
            const result = {
                moveX: moving ? x : 0,
                moveY: moving ? y : 0,
                shooting: pressed.has(BUTTONS.shoot),
                shootPressed: justPressed(BUTTONS.shoot),
                previousWeaponPressed: justPressed(BUTTONS.previousWeapon),
                nextWeaponPressed: justPressed(BUTTONS.nextWeapon),
                pausePressed: justPressed(BUTTONS.pause),
            };
            slot.buttons = pressed;
            return result;
        });
    }
}
