import { Dialog } from '@base-ui/react/dialog';
import type { ReactNode } from 'react';
import * as m from '@/paraglide/messages';

interface GameDialogProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    children: ReactNode;
    className?: string;
}

export function GameDialog({ isOpen, onClose, title, description, children, className = '' }: GameDialogProps) {
    return (
        <Dialog.Root
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}>
            <Dialog.Portal className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-5">
                <Dialog.Backdrop className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                <Dialog.Popup
                    className={`relative z-10 my-auto w-full overflow-hidden rounded-2xl border-2 border-stone-700 bg-stone-900 text-stone-100 shadow-2xl ${className}`}>
                    <Dialog.Title className="sr-only">{title}</Dialog.Title>
                    <Dialog.Description className="sr-only">{description}</Dialog.Description>
                    <Dialog.Close className="sr-only">{m.close_dialog()}</Dialog.Close>
                    {children}
                </Dialog.Popup>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
