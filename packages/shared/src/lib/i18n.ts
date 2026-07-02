/**
 * i18next-backed locale catalogs (NFA-EU-10).
 * Catalogs live in `packages/shared/locales/*.json`.
 */
import { useCallback, useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { de as dateFnsDe } from "date-fns/locale/de";
import { enUS as dateFnsEn } from "date-fns/locale/en-US";
import { fr as dateFnsFr } from "date-fns/locale/fr";
import { arSA as dateFnsAr } from "date-fns/locale/ar-SA";
import type { Locale as DateFnsLocale } from "date-fns";

import deCatalog from "#shared-locales/de.json";
import enCatalog from "#shared-locales/en.json";
import frCatalog from "#shared-locales/fr.json";
import arCatalog from "#shared-locales/ar.json";
import type { AccentId } from "./accent-preset";
import type { FontStackId } from "./font-stack-preset";

export type Locale = "de" | "en" | "fr" | "ar";

/** UI language picker order (English code, translated labels in catalogs). */
export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "de", "fr", "ar"];

export function localeOptionLabelKey(locale: Locale): string {
    return `settings.appearance.language.option.${locale}`;
}

export function fontStackHintKey(id: FontStackId): string {
    const slug = id === "source-sans" ? "source_sans" : id;
    return `settings.appearance.font.hint.${slug}`;
}

export function accentHintKey(id: AccentId): string {
    return `settings.appearance.accent.hint.${id}`;
}

/** Sync `html` lang, text direction, and Arabic font hint for RTL layout. */
export function applyDocumentLocale(locale: Locale): void {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.lang = locale;
    root.dir = isRtlLocale(locale) ? "rtl" : "ltr";
    if (isRtlLocale(locale)) {
        root.dataset.arabicFont = "1";
    } else {
        delete root.dataset.arabicFont;
    }
}

/** Apply persisted locale before React mounts (login, onboarding). */
export function bootstrapDocumentLocale(): void {
    if (typeof window === "undefined") return;
    const locale = useLocale.getState().locale;
    ensureI18n();
    void i18n.changeLanguage(locale);
    applyDocumentLocale(locale);
}

const catalogs: Record<Locale, Record<string, string>> = {
    de: deCatalog as Record<string, string>,
    en: enCatalog as Record<string, string>,
    fr: frCatalog as Record<string, string>,
    ar: arCatalog as Record<string, string>,
};

let i18nReady = false;

function ensureI18n() {
    if (i18nReady) return;
    void i18n.use(initReactI18next).init({
        resources: {
            de: { translation: catalogs.de },
            en: { translation: catalogs.en },
            fr: { translation: catalogs.fr },
            ar: { translation: catalogs.ar },
        },
        lng: "de",
        fallbackLng: "en",
        keySeparator: ".",
        interpolation: { escapeValue: false },
        returnEmptyString: false,
    });
    i18nReady = true;
}

ensureI18n();

const localeListeners = new Set<() => void>();

function notifyLocaleListeners() {
    for (const l of localeListeners) l();
}

function subscribeLocale(listener: () => void) {
    localeListeners.add(listener);
    return () => localeListeners.delete(listener);
}

interface LocaleStore {
    locale: Locale;
    setLocale: (l: Locale) => void;
}

export const useLocale = create<LocaleStore>()(
    persist(
        (set) => ({
            locale: "de",
            setLocale: (locale) => {
                ensureI18n();
                void i18n.changeLanguage(locale);
                applyDocumentLocale(locale);
                set({ locale });
                notifyLocaleListeners();
            },
        }),
        {
            name: "medoc-locale",
            onRehydrateStorage: () => (state) => {
                if (state?.locale) {
                    ensureI18n();
                    void i18n.changeLanguage(state.locale);
                    applyDocumentLocale(state.locale);
                    notifyLocaleListeners();
                }
            },
        },
    ),
);

// Sync persisted locale on first load.
if (typeof window !== "undefined") {
    const stored = useLocale.getState().locale;
    ensureI18n();
    void i18n.changeLanguage(stored);
    applyDocumentLocale(stored);
}

export function isRtlLocale(locale: Locale): boolean {
    return locale === "ar";
}

export function dateFnsLocaleFor(locale: Locale): DateFnsLocale {
    switch (locale) {
        case "en":
            return dateFnsEn;
        case "fr":
            return dateFnsFr;
        case "ar":
            return dateFnsAr;
        default:
            return dateFnsDe;
    }
}

/** React hook: date-fns locale matching active UI language. */
export function useDateFnsLocale(): DateFnsLocale {
    const locale = useLocale((s) => s.locale);
    return dateFnsLocaleFor(locale);
}

/** Keys present in the catalog for a locale (CI missing-key guard). */
export function localeCatalogKeys(locale: Locale): string[] {
    return Object.keys(catalogs[locale]);
}

function interpolateParams(text: string, params?: Record<string, string | number>): string {
    if (!params) return text;
    let s = text;
    for (const [k, v] of Object.entries(params)) {
        s = s.replaceAll(`{${k}}`, String(v));
        s = s.replaceAll(`{{${k}}}`, String(v));
    }
    return s;
}

/** Explicit locale (effects, native menu sync). */
export function translateLocale(locale: Locale, key: string): string {
    ensureI18n();
    const t = i18n.getFixedT(locale);
    const v = t(key, { defaultValue: catalogs.en[key] ?? key });
    return v === key && catalogs.en[key] ? catalogs.en[key]! : v;
}

export function translateLocaleWithFallback(locale: Locale, key: string, fallback: string): string {
    const v = translateLocale(locale, key);
    return v === key ? fallback : v;
}

export function translateLocaleParams(
    locale: Locale,
    key: string,
    params: Record<string, string | number>,
): string {
    return interpolateParams(translateLocale(locale, key), params);
}

export function t(key: string): string {
    return translateLocale(useLocale.getState().locale, key);
}

export function useT() {
    const locale = useSyncExternalStore(subscribeLocale, () => useLocale.getState().locale);
    return useCallback((key: string) => translateLocale(locale, key), [locale]);
}

export function useTParams() {
    const locale = useSyncExternalStore(subscribeLocale, () => useLocale.getState().locale);
    return useCallback(
        (key: string, params: Record<string, string | number>) =>
            translateLocaleParams(locale, key, params),
        [locale],
    );
}

/** Initialize i18n for non-React entry points (tests, native menu). */
export function initI18n(locale: Locale = "de") {
    ensureI18n();
    void i18n.changeLanguage(locale);
    applyDocumentLocale(locale);
    useLocale.setState({ locale });
}
