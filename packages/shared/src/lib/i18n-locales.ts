/** Supported languages and their direction, `Intl` tag and date-fns locale (split from `i18n.ts`). */
import type { Locale as DateFnsLocale } from "date-fns";
import { de as dateFnsDe } from "date-fns/locale/de";
import { enUS as dateFnsEn } from "date-fns/locale/en-US";
import { fr as dateFnsFr } from "date-fns/locale/fr";
import type { AccentId } from "./accent-preset";
import { numberingSystemForLocale } from "./arabic-numerals";
import { loadClientSettings } from "./client-settings";
import { dateFnsArGregorian } from "./date-fns-locale-ar";
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

