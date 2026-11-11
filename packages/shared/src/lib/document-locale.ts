/**
 * Language of official documents.
 *
 * A pinned choice in `documents.locale.v1` wins. Otherwise the PDF follows
 * the UI language (`de`, `en`, `fr`, `ar`).
 *
 * Stored in `app_kv` key `documents.locale.v1` (read by the Rust renderer)
 * and mirrored to localStorage for synchronous access in layout builders.
 */
import { setAppKv } from "@/systems/practice-host/controllers/app-kv.controller";
import type { Locale } from "@/lib/i18n";

export type DocumentLocale = "de" | "en" | "fr" | "ar";

const LS_KEY = "medoc-documents-locale-v1";
export const DOCUMENT_LOCALE_KV_KEY = "documents.locale.v1" as const;

function asDocumentLocale(v: string | null | undefined): DocumentLocale | null {
    if (v === "de" || v === "en" || v === "fr" || v === "ar") return v;
    return null;
}

/** UI language, used when Settings has not pinned a document language. */
function uiLocale(): DocumentLocale | null {
    try {
        const raw = globalThis.localStorage?.getItem("medoc-locale");
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { state?: { locale?: string } };
        return asDocumentLocale(parsed.state?.locale);
    } catch {
        return null;
    }
}

export function documentLocale(): DocumentLocale {
    try {
        const pinned = asDocumentLocale(globalThis.localStorage?.getItem(LS_KEY));
        if (pinned) return pinned;
    } catch {
        /* ignore */
    }
    return uiLocale() ?? "de";
}

export async function setDocumentLocale(locale: DocumentLocale): Promise<void> {
    try {
        globalThis.localStorage?.setItem(LS_KEY, locale);
    } catch {
        /* ignore */
    }
    await setAppKv(DOCUMENT_LOCALE_KV_KEY, locale);
}

/** `documentLocale()` as UI `Locale` for `translateLocale`. */
export function documentLocaleForI18n(): Locale {
    return documentLocale() as Locale;
}
