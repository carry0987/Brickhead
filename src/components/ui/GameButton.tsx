import { Button } from '@base-ui/react/button';
import type { ComponentProps } from 'react';

type GameButtonProps = ComponentProps<typeof Button>;

export function GameButton({ type = 'button', ...props }: GameButtonProps) {
    return <Button type={type} {...props} />;
}
