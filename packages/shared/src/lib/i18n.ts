/**
 * i18next-backed locale catalogs (NFA-EU-10).
 * Catalogs live in `packages/shared/locales/*.json`.
 */
import { useCallback, useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import type { Locale as DateFnsLocale } from "date-fns";
import enCatalog from "#shared-locales/en.json";
import { applyArabicNumeralsToDocument, effectiveArabicNumeralMode, rewriteDigitsForMode } from "./arabic-numerals";
import { loadClientSettings } from "./client-settings";
import { practiceCurrency, subscribePracticeCurrency } from "./practice-currency";
import { SUPPORTED_LOCALES, isRtlLocale, bcp47ForLocale, collatorLocale, dateFnsLocaleFor } from "./i18n-locales";
import type { Locale, PluralCategory } from "./i18n-locales";
export { SUPPORTED_LOCALES, normalizeLocale, localeOptionLabelKey, fontStackHintKey, fontStackLabelKey, accentHintKey, accentLabelKey, isRtlLocale, bcp47ForLocale, collatorLocale, dateFnsLocaleFor } from "./i18n-locales";
export type { Locale, PluralCategory } from "./i18n-locales";

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

/**
 * Apply persisted locale before React mounts (login, onboarding): waits for the interface
 * language's catalog, then preloads the others in the background.
 */
export async function bootstrapDocumentLocale(): Promise<void> {
    if (typeof window === "undefined") return;
    const locale = useLocale.getState().locale;
    ensureI18n();
    await loadLocaleCatalog(locale).catch(() => undefined);
    void i18n.changeLanguage(locale);
    applyDocumentLocale(locale);
    window.setTimeout(() => void loadAllLocaleCatalogs().catch(() => undefined), 1500);
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
    void loadLocaleCatalog(locale);
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

type Catalog = Record<string, string>;

/**
 * English ships in the main bundle: it is the fallback of every key. The other catalogs are
 * separate chunks (about 0.5 MB each), loaded for the interface language before the first render
 * and for the rest right after start (documents can print in another language). Until a catalog
 * arrives, its keys read the English text.
 */
const catalogs: Partial<Record<Locale, Catalog>> = { en: enCatalog as Catalog };
const CATALOG_LOADERS: Record<Exclude<Locale, "en">, () => Promise<{ default: unknown }>> = {
    de: () => import("#shared-locales/de.json"),
    fr: () => import("#shared-locales/fr.json"),
    ar: () => import("#shared-locales/ar.json"),
};
const catalogLoads = new Map<Locale, Promise<void>>();
let catalogVersion = 0;
const catalogListeners = new Set<() => void>();

function subscribeCatalogs(listener: () => void) {
    catalogListeners.add(listener);
    return () => catalogListeners.delete(listener);
}

/** Loads one language's catalog (once); screens using it re-render when it arrives. */
export function loadLocaleCatalog(locale: Locale): Promise<void> {
    if (catalogs[locale]) return Promise.resolve();
    let load = catalogLoads.get(locale);
    if (!load) {
        load = CATALOG_LOADERS[locale as Exclude<Locale, "en">]()
            .then((mod) => {
                const cat = mod.default as Catalog;
                catalogs[locale] = cat;
                ensureI18n();
                i18n.addResourceBundle(locale, "translation", cat, true, true);
                catalogVersion += 1;
                for (const l of catalogListeners) l();
                notifyLocaleListeners();
            })
            .catch((e) => {
                catalogLoads.delete(locale); // a later call retries
                throw e;
            });
        catalogLoads.set(locale, load);
    }
    return load;
}

/** Every catalog (tests, and the background preload after start). */
export async function loadAllLocaleCatalogs(): Promise<void> {
    await Promise.all(SUPPORTED_LOCALES.map(loadLocaleCatalog));
}

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
    const pack = catalogs[locale] ?? catalogs.en!;
    return pack[`${keyPrefix}.${cat}`] ?? pack[`${keyPrefix}.other`] ?? catalogs.en![`${keyPrefix}.other`] ?? "";
}

let i18nReady = false;

function ensureI18n() {
    if (i18nReady) return;
    void i18n.use(initReactI18next).init({
        resources: Object.fromEntries(
            SUPPORTED_LOCALES.filter((l) => catalogs[l]).map((l) => [l, { translation: catalogs[l]! }]),
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
                void loadLocaleCatalog(locale);
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
                    void loadLocaleCatalog(locale);
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
    void loadLocaleCatalog(stored);
    void i18n.changeLanguage(stored);
    applyDocumentLocale(stored);
    try {
        globalThis.localStorage?.setItem("medoc-documents-locale-v1", stored);
    } catch {
        /* ignore */
    }
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
    return Object.keys(catalogs[locale] ?? {});
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
    const en = catalogs.en!;
    const version = t(key, { defaultValue: en[key] ?? key });
    const resolved = version === key && en[key] ? en[key]! : version;
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
    // …and when a language catalog arrives.
    const catalogs = useSyncExternalStore(subscribeCatalogs, () => catalogVersion, () => catalogVersion);
    return useCallback((key: string) => translateLocale(locale, key), [locale, currency, catalogs]);
}

export function useTParams() {
    const locale = useSyncExternalStore(subscribeLocale, () => useLocale.getState().locale);
    const currency = useSyncExternalStore(subscribePracticeCurrency, practiceCurrency, practiceCurrency);
    const catalogs = useSyncExternalStore(subscribeCatalogs, () => catalogVersion, () => catalogVersion);
    return useCallback(
        (key: string, params: Record<string, string | number>) =>
            translateLocaleParams(locale, key, params),
        [locale, currency, catalogs],
    );
}

/** Initialize i18n for non-React entry points (tests, native menu). */
export function initI18n(locale: Locale = "en") {
    ensureI18n();
    void loadLocaleCatalog(locale);
    void i18n.changeLanguage(locale);
    applyDocumentLocale(locale);
    useLocale.setState({ locale });
}
