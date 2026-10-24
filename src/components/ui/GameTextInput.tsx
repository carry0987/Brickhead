import { Input } from '@base-ui/react/input';
import type { ComponentProps } from 'react';

type GameTextInputProps = ComponentProps<typeof Input>;

export function GameTextInput(props: GameTextInputProps) {
    return <Input {...props} />;
}
