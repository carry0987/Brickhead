import { NumberField } from '@base-ui/react/number-field';

interface GameNumberFieldProps {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onValueChange: (value: number) => void;
    className?: string;
    labelClassName?: string;
}

export function GameNumberField({
    id,
    label,
    value,
    min,
    max,
    step = 1,
    onValueChange,
    className = '',
    labelClassName = 'text-white',
}: GameNumberFieldProps) {
    return (
        <NumberField.Root
            id={id}
            value={value}
            min={min}
            max={max}
            step={step}
            onValueChange={(nextValue) => {
                if (nextValue !== null) onValueChange(nextValue);
            }}
            className={`flex items-center gap-2 ${className}`}>
            <label htmlFor={id} className={`text-sm font-bold ${labelClassName}`}>
                {label}
            </label>
            <NumberField.Group className="flex h-9 overflow-hidden rounded-lg border-2 border-stone-300 bg-white">
                <NumberField.Decrement className="w-9 border-r border-stone-300 font-black text-stone-800 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
                    −
                </NumberField.Decrement>
                <NumberField.Input className="w-16 bg-white px-2 text-center font-mono-tabular text-sm font-black text-stone-900 outline-none focus:bg-red-50" />
                <NumberField.Increment className="w-9 border-l border-stone-300 font-black text-stone-800 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
                    +
                </NumberField.Increment>
            </NumberField.Group>
        </NumberField.Root>
    );
}
