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
import type { Locale as DateFnsLocale } from "date-fns";
import { dateFnsArGregorian } from "./date-fns-locale-ar";

import deCatalog from "#shared-locales/de.json";
import enCatalog from "#shared-locales/en.json";
import frCatalog from "#shared-locales/fr.json";
import arCatalog from "#shared-locales/ar.json";
import type { AccentId } from "./accent-preset";
import { applyArabicNumeralsToDocument, effectiveArabicNumeralMode, numberingSystemForLocale, rewriteDigitsForMode } from "./arabic-numerals";
import { loadClientSettings } from "./client-settings";
import { practiceCurrency, subscribePracticeCurrency } from "./practice-currency";
import type { FontStackId } from "./font-stack-preset";

/**
 * Every language of the app and of its documents.
 *
 * Adding a language:
 *  1. `packages/shared/locales/<code>.json` with every key of `en.json`
 *     (the CI missing-key guard uses `localeCatalogKeys`).
 *  2. One entry in `LOCALE_REGISTRY` below (direction, Intl tag, date-fns locale).
 *  3. The server side: `crates/shared/medoc-core/src/infrastructure/pdf/locales/<code>.json`
 *     and one line in `pdf/i18n.rs` → `LOCALES`.
 */
export const SUPPORTED_LOCALES = ["en", "de", "fr", "ar"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export type PluralCategory = "zero" | "one" | "two" | "few" | "many" | "other";

type LocaleMeta = {
    dir: "ltr" | "rtl";
    /** BCP 47 tag for `Intl` (Gregorian calendar). */
    intl: () => string;
    dateFns: () => DateFnsLocale;
};

const LOCALE_REGISTRY: Record<Locale, LocaleMeta> = {
    en: { dir: "ltr", intl: () => "en-US-u-ca-gregory", dateFns: () => dateFnsEn },
    de: { dir: "ltr", intl: () => "de-DE-u-ca-gregory", dateFns: () => dateFnsDe },
    fr: { dir: "ltr", intl: () => "fr-FR-u-ca-gregory", dateFns: () => dateFnsFr },
    ar: {
        dir: "rtl",
        intl: () =>
            `ar-EG-u-ca-gregory-nu-${numberingSystemForLocale("ar", loadClientSettings().appearance?.arabicNumeralMode)}`,
        dateFns: () => dateFnsArGregorian,
    },
};

/** `"ar-MA"`, `"fr_FR"`, `"EN"` → a supported code, or `null`. */
export function normalizeLocale(raw: string | null | undefined): Locale | null {
    if (typeof raw !== "string") return null;
    const v = raw.trim().replace(/^"|"$/g, "").toLowerCase().replace("_", "-");
    if (!v) return null;
    const exact = SUPPORTED_LOCALES.find((l) => l === v);
    if (exact) return exact;
    const primary = v.split("-")[0];
    return SUPPORTED_LOCALES.find((l) => l === primary) ?? null;
}

export function localeOptionLabelKey(locale: Locale): string {
    return `settings.appearance.language.option.${locale}`;
}

export function fontStackHintKey(id: FontStackId): string {
    const slug = id === "source-sans" ? "source_sans" : id;
    return `settings.appearance.font.hint.${slug}`;
}

export function fontStackLabelKey(id: FontStackId): string {
    const slug = id === "source-sans" ? "source_sans" : id;
    return `settings.appearance.font.label.${slug}`;
}

export function accentHintKey(id: AccentId): string {
    return `settings.appearance.accent.hint.${id}`;
}

export function accentLabelKey(id: AccentId): string {
    return `settings.appearance.accent.label.${id}`;
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
    applyArabicNumeralsToDocument(locale, loadClientSettings().appearance?.arabicNumeralMode);
}

/** Apply persisted locale before React mounts (login, onboarding). */
export function bootstrapDocumentLocale(): void {
    if (typeof window === "undefined") return;
    const locale = useLocale.getState().locale;
    ensureI18n();
    void i18n.changeLanguage(locale);
    applyDocumentLocale(locale);
}

/**
 * When set, instance config file locale wins over zustand/localStorage rehydrate.
 * Prevents shared-origin LS (other MeDoc window) from flipping language back to English after boot.
 */
let localeAuthorityFromDisk: Locale | null = null;

export function diskLocaleAuthority(): Locale | null {
    return localeAuthorityFromDisk;
}

/**
 * Apply a locale loaded from the instance config file without re-writing that file.
 * Updates i18n, document lang/dir, and the zustand store (persist middleware still mirrors to localStorage).
 */
export function adoptLocaleFromDisk(locale: Locale): void {
    localeAuthorityFromDisk = locale;
    ensureI18n();
    void i18n.changeLanguage(locale);
    applyDocumentLocale(locale);
    try {
        globalThis.localStorage?.setItem("medoc-documents-locale-v1", locale);
    } catch {
        /* ignore */
    }
    useLocale.setState({ locale });
    notifyLocaleListeners();
}

const catalogs: Record<Locale, Record<string, string>> = {
    de: deCatalog as Record<string, string>,
    en: enCatalog as Record<string, string>,
    fr: frCatalog as Record<string, string>,
    ar: arCatalog as Record<string, string>,
};


/** Arabic dual/few/other; other locales use one vs other. */
export function pluralCategory(locale: Locale, n: number): PluralCategory {
    const abs = Math.abs(Math.trunc(n));
    if (locale === "ar") {
        if (abs === 0) return "zero";
        if (abs === 1) return "one";
        if (abs === 2) return "two";
        const mod100 = abs % 100;
        if (mod100 >= 3 && mod100 <= 10) return "few";
        if (mod100 >= 11 && mod100 <= 99) return "many";
        return "other";
    }
    return abs === 1 ? "one" : "other";
}

/** Read `prefix.one` / `.two` / `.few` / `.other` from the flat catalog (not i18next nesting). */
export function translatePluralUnit(locale: Locale, keyPrefix: string, n: number): string {
    const cat = pluralCategory(locale, n);
    const pack = catalogs[locale];
    return pack[`${keyPrefix}.${cat}`] ?? pack[`${keyPrefix}.other`] ?? catalogs.en[`${keyPrefix}.other`] ?? "";
}

let i18nReady = false;

function ensureI18n() {
    if (i18nReady) return;
    void i18n.use(initReactI18next).init({
        resources: Object.fromEntries(
            SUPPORTED_LOCALES.map((l) => [l, { translation: catalogs[l] }]),
        ),
        lng: "en",
        fallbackLng: "en",
        keySeparator: false,
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
            locale: "en",
            setLocale: (locale) => {
                // User choice becomes the new disk authority for this instance.
                localeAuthorityFromDisk = locale;
                ensureI18n();
                void i18n.changeLanguage(locale);
                applyDocumentLocale(locale);
                try {
                    globalThis.localStorage?.setItem("medoc-documents-locale-v1", locale);
                } catch {
                    /* ignore */
                }
                void import("@/lib/document-locale").then((m) => m.setDocumentLocale(locale));
                set({ locale });
                notifyLocaleListeners();
                // Await the instance file write so a quick refresh cannot lose the language.
                void import("@/systems/practice-host/controllers/ui-prefs.controller").then((m) =>
                    m.persistUiPrefs({ locale }),
                );
            },
        }),
        {
            name: "medoc-locale",
            onRehydrateStorage: () => (state) => {
                // File hydrate wins over shared-origin localStorage.
                const locale = localeAuthorityFromDisk ?? state?.locale;
                if (locale) {
                    ensureI18n();
                    void i18n.changeLanguage(locale);
                    applyDocumentLocale(locale);
                    try {
                        globalThis.localStorage?.setItem("medoc-documents-locale-v1", locale);
                    } catch {
                        /* ignore */
                    }
                    if (localeAuthorityFromDisk) {
                        try {
                            globalThis.localStorage?.setItem(
                                "medoc-locale",
                                JSON.stringify({ state: { locale: localeAuthorityFromDisk }, version: 0 }),
                            );
                        } catch {
                            /* ignore */
                        }
                        useLocale.setState({ locale: localeAuthorityFromDisk });
                    }
                    void import("@/lib/document-locale").then((m) => m.setDocumentLocale(locale));
                    notifyLocaleListeners();
                }
            },
        },
    ),
);

// Sync persisted locale on first load. Only mirror into document LS here;
// `hydrateDocumentLocaleFromAppKv` after login reconciles with practice KV.
if (typeof window !== "undefined") {
    const stored = useLocale.getState().locale;
    ensureI18n();
    void i18n.changeLanguage(stored);
    applyDocumentLocale(stored);
    try {
        globalThis.localStorage?.setItem("medoc-documents-locale-v1", stored);
    } catch {
        /* ignore */
    }
}

export function isRtlLocale(locale: Locale): boolean {
    return LOCALE_REGISTRY[locale]?.dir === "rtl";
}

/** BCP 47 tag for `Intl` / `toLocaleString` formatters. Always Gregorian (`ca-gregory`). */
export function bcp47ForLocale(locale: Locale): string {
    return (LOCALE_REGISTRY[locale] ?? LOCALE_REGISTRY.de).intl();
}

/** Locale code for `String.localeCompare` (same as {@link Locale}). */
export function collatorLocale(locale: Locale): string {
    return locale;
}

export function dateFnsLocaleFor(locale: Locale): DateFnsLocale {
    return (LOCALE_REGISTRY[locale] ?? LOCALE_REGISTRY.de).dateFns();
}

/** React hook: date-fns locale matching active UI language. */
export function useDateFnsLocale(): DateFnsLocale {
    const locale = useLocale((s) => s.locale);
    return dateFnsLocaleFor(locale);
}

/** React hook: BCP 47 tag for `Intl` / `toLocaleString`. */
export function useIntlLocaleTag(): string {
    const locale = useLocale((s) => s.locale);
    return bcp47ForLocale(locale);
}

/** React hook: locale code for `String.localeCompare`. */
export function useCollatorLocale(): string {
    const locale = useLocale((s) => s.locale);
    return collatorLocale(locale);
}

/** Keys present in the catalog for a locale (CI missing-key guard). */
export function localeCatalogKeys(locale: Locale): string[] {
    return Object.keys(catalogs[locale]);
}

function interpolateParams(text: string, params?: Record<string, string | number>): string {
    if (!params) return text;
    let s = text;
    for (const [k, version] of Object.entries(params)) {
        const value = String(version);
        // Replace `{{k}}` before `{k}` so `My tasks ({{count}})` does not become `My tasks ({15})`.
        s = s.replaceAll(`{{${k}}}`, value);
        s = s.replaceAll(`{${k}}`, value);
    }
    return s;
}

/**
 * Practice money labels follow Settings → Practice. Vendor subscription
 * prices stay in euro. The default EUR catalog text is left as written.
 */
function stampPracticeCurrency(key: string, text: string): string {
    if (key.startsWith("onboarding.subscription.")) return text;
    const code = practiceCurrency();
    if (code === "EUR") return text;
    return text.replace(/\bEUR\b/g, code).replaceAll("€", code);
}

/** Explicit locale (effects, native menu sync). */
export function translateLocale(locale: Locale, key: string): string {
    ensureI18n();
    const t = i18n.getFixedT(locale);
    const version = t(key, { defaultValue: catalogs.en[key] ?? key });
    const resolved = version === key && catalogs.en[key] ? catalogs.en[key]! : version;
    return stampPracticeCurrency(key, resolved);
}

export function translateLocaleWithFallback(locale: Locale, key: string, fallback: string): string {
    const version = translateLocale(locale, key);
    return version === key ? fallback : version;
}

export function translateLocaleParams(
    locale: Locale,
    key: string,
    params: Record<string, string | number>,
): string {
    const text = interpolateParams(translateLocale(locale, key), params);
    if (
        key.startsWith("settings.appearance.arabic_numerals") ||
        key === "settings.pairing.confirm_code" ||
        key === "settings.pairing.confirm_pin_toast"
    ) {
        return text;
    }
    return rewriteDigitsForMode(
        text,
        effectiveArabicNumeralMode(locale, loadClientSettings().appearance?.arabicNumeralMode),
    );
}

export function t(key: string): string {
    return translateLocale(useLocale.getState().locale, key);
}

export function useT() {
    const locale = useSyncExternalStore(subscribeLocale, () => useLocale.getState().locale);
    // Re-render when practice currency changes so EUR→MAD stamps refresh without a full remount.
    const currency = useSyncExternalStore(subscribePracticeCurrency, practiceCurrency, practiceCurrency);
    return useCallback((key: string) => translateLocale(locale, key), [locale, currency]);
}

export function useTParams() {
    const locale = useSyncExternalStore(subscribeLocale, () => useLocale.getState().locale);
    const currency = useSyncExternalStore(subscribePracticeCurrency, practiceCurrency, practiceCurrency);
    return useCallback(
        (key: string, params: Record<string, string | number>) =>
            translateLocaleParams(locale, key, params),
        [locale, currency],
    );
}

/** Initialize i18n for non-React entry points (tests, native menu). */
export function initI18n(locale: Locale = "en") {
    ensureI18n();
    void i18n.changeLanguage(locale);
    applyDocumentLocale(locale);
    useLocale.setState({ locale });
}
