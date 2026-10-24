import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import * as m from '@/paraglide/messages';
import { getLocale, type Locale, locales, setLocale as setParaglideLocale } from '@/paraglide/runtime';

function updatePageMetadata(locale: Locale) {
    const title = m.site_title();
    const descriptionContent = m.site_description();
    document.documentElement.lang = locale;
    document.title = title;

    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = descriptionContent;

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = title;

    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = descriptionContent;
}

interface LocaleContextValue {
    locale: Locale;
    locales: readonly Locale[];
    setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
    const [locale] = useState<Locale>(() => getLocale());
    useEffect(() => {
        updatePageMetadata(locale);
    }, [locale]);

    const setLocale = useCallback(
        (nextLocale: Locale) => {
            if (nextLocale === locale) return;
            setParaglideLocale(nextLocale, { reload: true });
        },
        [locale],
    );

    return <LocaleContext.Provider value={{ locale, locales, setLocale }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
    const context = useContext(LocaleContext);
    if (!context) {
        throw new Error('useLocale must be used within LocaleProvider');
    }
    return context;
}
