import { Slider } from '@base-ui/react/slider';

interface GameSliderProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    onValueChange: (value: number) => void;
    onValueCommitted?: () => void;
    className?: string;
}

export function GameSlider({
    value,
    min,
    max,
    step = 1,
    label,
    onValueChange,
    onValueCommitted,
    className = '',
}: GameSliderProps) {
    return (
        <Slider.Root
            value={value}
            min={min}
            max={max}
            step={step}
            onValueChange={onValueChange}
            onValueCommitted={onValueCommitted}
            className={className}>
            <Slider.Control className="relative flex w-full touch-none items-center py-3 select-none">
                <Slider.Track className="box-border h-3 w-full overflow-hidden rounded-full border-2 border-stone-400 bg-stone-100 select-none">
                    <Slider.Indicator className="absolute! inset-y-0! h-auto! rounded-full bg-red-600 select-none" />
                </Slider.Track>
                <Slider.Thumb
                    aria-label={label}
                    className="relative size-6 rounded-full border-4 border-red-700 bg-white transition-transform active:scale-95 select-none after:absolute after:inset-1.25 after:rounded-full after:bg-red-600 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-red-600"
                />
            </Slider.Control>
        </Slider.Root>
    );
}
