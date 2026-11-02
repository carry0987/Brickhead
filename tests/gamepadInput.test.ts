import { describe, expect, test } from 'vitest';
import { GamepadInputManager } from '../src/engine/input/gamepadInput';

function pad(index: number, options: { axes?: number[]; buttons?: Record<number, number>; id?: string } = {}): Gamepad {
    const buttons = Array.from({ length: 16 }, (_, i) => {
        const value = options.buttons?.[i] ?? 0;
        return { value, pressed: value >= 1, touched: value > 0 };
    });
    return {
        index,
        id: options.id ?? `controller-${index}`,
        connected: true,
        mapping: 'standard',
        axes: options.axes ?? [0, 0, 0, 0],
        buttons,
        timestamp: 0,
        vibrationActuator: null,
    } as unknown as Gamepad;
}

describe('gamepad input', () => {
    test('assigns two controllers independently and preserves the remaining slot on disconnect', () => {
        const manager = new GamepadInputManager();
        const first = pad(0, { axes: [1, 0] });
        const second = pad(1, { axes: [0, -1], buttons: { 7: 1 } });
        const inputs = manager.poll([first, second]);
        expect(inputs[0]).toMatchObject({ moveX: 1, moveY: 0, shooting: false });
        expect(inputs[1]).toMatchObject({ moveX: 0, moveY: -1, shooting: true, shootPressed: true });
        expect(manager.poll([null, second])[0]).toBeUndefined();
        expect(manager.poll([null, second])[1]).toMatchObject({ shooting: true, shootPressed: false });
        const reconnected = pad(2, { axes: [-1, 0] });
        const afterReconnect = manager.poll([null, second, reconnected]);
        expect(afterReconnect[0]).toMatchObject({ moveX: -1 });
        expect(afterReconnect[1]).toMatchObject({ moveY: -1 });
    });

    test('applies a radial deadzone and ignores invalid axis values', () => {
        const manager = new GamepadInputManager();
        expect(manager.poll([pad(0, { axes: [0.1, 0.1] })])[0]).toMatchObject({ moveX: 0, moveY: 0 });
        expect(manager.poll([pad(0, { axes: [0.15, 0.15] })])[0]).toMatchObject({ moveX: 0.15, moveY: 0.15 });
        expect(manager.poll([pad(0, { axes: [Number.NaN, -2] })])[0]).toMatchObject({ moveX: 0, moveY: -1 });
    });

    test('reports trigger holds and one-shot button edges', () => {
        const manager = new GamepadInputManager();
        const pressed = pad(0, { buttons: { 4: 1, 5: 1, 7: 0.7, 9: 1 } });
        const released = pad(0);
        expect(manager.poll([pressed])[0]).toMatchObject({
            shooting: true,
            shootPressed: true,
            previousWeaponPressed: true,
            nextWeaponPressed: true,
            pausePressed: true,
        });
        expect(manager.poll([pressed])[0]).toMatchObject({
            shooting: true,
            shootPressed: false,
            previousWeaponPressed: false,
            nextWeaponPressed: false,
            pausePressed: false,
        });
        expect(manager.poll([released])[0]).toMatchObject({ shooting: false, shootPressed: false });
        expect(manager.poll([pressed])[0]).toMatchObject({ shootPressed: true, pausePressed: true });
    });

    test('filters unsupported or disconnected pads and resets held buttons on reconnection', () => {
        const manager = new GamepadInputManager();
        const pressed = pad(0, { buttons: { 7: 1 } });
        expect(manager.poll([{ ...pressed, mapping: '' }])[0]).toBeUndefined();
        expect(manager.poll([pressed])[0]?.shootPressed).toBe(true);
        expect(manager.poll([{ ...pressed, connected: false }])[0]).toBeUndefined();
        expect(manager.poll([pressed])[0]?.shootPressed).toBe(true);
        expect(manager.poll([pad(0, { id: 'replacement', buttons: { 7: 1 } })])[0]?.shootPressed).toBe(true);
    });
});
