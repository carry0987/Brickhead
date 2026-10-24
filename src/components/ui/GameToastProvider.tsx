import { Toast } from '@base-ui/react/toast';
import { CheckCircle2, Info, Volume2, VolumeX, X } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext } from 'react';
import * as m from '@/paraglide/messages';

type GameToastKind = 'success' | 'info' | 'muted' | 'volume';

interface GameToastOptions {
    title: string;
    description?: string;
    kind?: GameToastKind;
    id?: string;
}

interface GameToastContextValue {
    notify: (options: GameToastOptions) => void;
}

const GameToastContext = createContext<GameToastContextValue | null>(null);

function GameToastLayer({ children }: { children: ReactNode }) {
    const toastManager = Toast.useToastManager<{ kind: GameToastKind }>();
    const notify = useCallback(
        ({ title, description, kind = 'info', id }: GameToastOptions) => {
            toastManager.add({
                id,
                title,
                description,
                timeout: 3600,
                data: { kind },
            });
        },
        [toastManager],
    );

    return (
        <GameToastContext.Provider value={{ notify }}>
            {children}
            <Toast.Portal>
                <Toast.Viewport className="fixed top-18 right-4 z-60 w-[calc(100vw-2rem)] max-w-sm sm:right-6">
                    {toastManager.toasts.map((toast) => {
                        const kind = toast.data?.kind ?? 'info';
                        const Icon =
                            kind === 'success'
                                ? CheckCircle2
                                : kind === 'muted'
                                  ? VolumeX
                                  : kind === 'volume'
                                    ? Volume2
                                    : Info;
                        const colorClass =
                            kind === 'success' || kind === 'volume'
                                ? 'border-emerald-500/70 bg-emerald-950/95 text-emerald-100'
                                : kind === 'muted'
                                  ? 'border-red-500/70 bg-red-950/95 text-red-100'
                                  : 'border-sky-500/70 bg-sky-950/95 text-sky-100';

                        return (
                            <Toast.Root
                                key={toast.id}
                                toast={toast}
                                className={`mb-3 w-full rounded-xl border shadow-2xl backdrop-blur-md transition-all duration-300 data-ending-style:translate-x-8 data-ending-style:opacity-0 data-starting-style:translate-x-8 data-starting-style:opacity-0 ${colorClass}`}>
                                <Toast.Content className="flex items-start gap-3 p-3.5">
                                    <Icon className="mt-0.5 size-4 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <Toast.Title className="text-sm font-black" />
                                        {toast.description && (
                                            <Toast.Description className="mt-0.5 text-xs font-medium opacity-90" />
                                        )}
                                    </div>
                                    <Toast.Close
                                        aria-label={m.close_notification()}
                                        className="rounded p-0.5 opacity-70 transition-opacity hover:opacity-100">
                                        <X className="size-4" />
                                    </Toast.Close>
                                </Toast.Content>
                            </Toast.Root>
                        );
                    })}
                </Toast.Viewport>
            </Toast.Portal>
        </GameToastContext.Provider>
    );
}

export function GameToastProvider({ children }: { children: ReactNode }) {
    return (
        <Toast.Provider limit={3} timeout={3600}>
            <GameToastLayer>{children}</GameToastLayer>
        </Toast.Provider>
    );
}

export function useGameToast() {
    const context = useContext(GameToastContext);
    if (!context) {
        throw new Error('useGameToast must be used within GameToastProvider');
    }
    return context;
}
