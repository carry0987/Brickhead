import { Menu } from '@base-ui/react/menu';
import { Check, Globe2 } from 'lucide-react';
import { useMemo } from 'react';
import { useLocale } from '@/i18n/LocaleProvider';
import * as m from '@/paraglide/messages';
import { soundFX } from '@/utils/sound';

export function LanguageMenu() {
    const { locale, locales, setLocale } = useLocale();
    const displayNames = useMemo(() => new Intl.DisplayNames([locale], { type: 'language' }), [locale]);

    return (
        <Menu.Root>
            <Menu.Trigger
                aria-label={m.language_switcher_label()}
                className="flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 font-mono-tabular text-xs font-semibold text-stone-200 transition-colors hover:bg-stone-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 select-none">
                <Globe2 className="size-3.5 text-amber-400" />
                <span>{locale}</span>
            </Menu.Trigger>
            <Menu.Portal>
                <Menu.Positioner sideOffset={8} align="end" className="z-60 outline-none select-none">
                    <Menu.Popup className="relative min-w-44 origin-(--transform-origin) rounded-xl border border-stone-700 bg-stone-900 p-1.5 text-stone-100 shadow-2xl outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 select-none">
                        <p className="px-2.5 py-1.5 text-[10px] font-black tracking-wider text-stone-500 uppercase">
                            {m.language_switcher_label()}
                        </p>
                        <Menu.RadioGroup
                            value={locale}
                            onValueChange={(nextLocale) => {
                                const supportedLocale = locales.find((candidate) => candidate === nextLocale);
                                if (!supportedLocale) return;
                                soundFX.playClick();
                                setLocale(supportedLocale);
                            }}>
                            {locales.map((supportedLocale) => {
                                const label = displayNames.of(supportedLocale) ?? supportedLocale;
                                return (
                                    <Menu.RadioItem
                                        key={supportedLocale}
                                        value={supportedLocale}
                                        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-bold text-stone-200 outline-none transition-colors data-highlighted:bg-stone-800 data-highlighted:text-white select-none">
                                        <span className="flex-1">{label}</span>
                                        <Menu.RadioItemIndicator className="ml-auto flex size-4 items-center justify-center rounded-full bg-amber-400 text-stone-950">
                                            <Check className="size-3 stroke-3" />
                                        </Menu.RadioItemIndicator>
                                    </Menu.RadioItem>
                                );
                            })}
                        </Menu.RadioGroup>
                    </Menu.Popup>
                </Menu.Positioner>
            </Menu.Portal>
        </Menu.Root>
    );
}
