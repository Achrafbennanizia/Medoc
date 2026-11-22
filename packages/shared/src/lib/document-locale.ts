/**
 * Language of official documents.
 *
 * Rule (one for every export path — HTML print and Rust PDF):
 *  - By default documents follow the UI language. Choosing a language in the
 *    app changes the language of every document from then on.
 *  - Settings may *pin* a document language (`setDocumentLocale(l, { pin: true })`);
 *    a pin wins over the UI language until it is removed.
 *
 * Every builder sends this language with its payload; the server prints the
 * document in exactly that language. `documents.locale.v1` in `app_kv` only
 * serves server-built documents that have no request (day close, period
 * report, cancellations without a stored language).
 *
 * Before: after login the practice-wide KV value (written by any user on any
 * synced device) overrode this user's UI language, so a French UI produced
 * German documents, and invoices ignored the request altogether.
 */
import { getAppKv, setAppKv } from "@/systems/practice-host/controllers/app-kv.controller";
import { isRtlLocale, normalizeLocale, useLocale, type Locale } from "@/lib/i18n";

/** Any supported UI language is a document language. */
export type DocumentLocale = Locale;

const LS_KEY = "medoc-documents-locale-v1";
const LS_PIN_KEY = "medoc-documents-locale-pinned-v1";
export const DOCUMENT_LOCALE_KV_KEY = "documents.locale.v1" as const;
export const DOCUMENT_LOCALE_PIN_KV_KEY = "documents.locale.pinned.v1" as const;

function readLs(key: string): string | null {
    try {
        return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

function writeLs(key: string, value: string | null): void {
    try {
        if (value == null) globalThis.localStorage?.removeItem(key);
        else globalThis.localStorage?.setItem(key, value);
    } catch {
        /* ignore */
    }
}

/** UI language as persisted by the `useLocale` store (written synchronously on every switch). */
function uiLocale(): DocumentLocale | null {
    const raw = readLs("medoc-locale");
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as { state?: { locale?: string } };
        return normalizeLocale(parsed.state?.locale);
    } catch {
        return null;
    }
}

/** Live UI language — last resort before anything is stored (was a hard-coded German default). */
function liveUiLocale(): DocumentLocale | null {
    try {
        return normalizeLocale(useLocale.getState().locale);
    } catch {
        return null;
    }
}

/** Pinned document language, if Settings pinned one. */
export function pinnedDocumentLocale(): DocumentLocale | null {
    return normalizeLocale(readLs(LS_PIN_KEY));
}

export function documentLocale(): DocumentLocale {
    return pinnedDocumentLocale() ?? uiLocale() ?? normalizeLocale(readLs(LS_KEY)) ?? liveUiLocale() ?? "en";
}

/** True when documents read right to left in the current document language. */
export function documentIsRtl(): boolean {
    return isRtlLocale(documentLocale());
}

/**
 * Record the document language. Called on every UI language change (no pin)
 * and by Settings to pin (`{ pin: true }`) or unpin (`{ pin: false }`).
 */
export async function setDocumentLocale(
    locale: DocumentLocale,
    opts: { pin?: boolean } = {},
): Promise<void> {
    const next = normalizeLocale(locale) ?? "en";
    if (opts.pin === true) writeLs(LS_PIN_KEY, next);
    if (opts.pin === false) writeLs(LS_PIN_KEY, null);
    // A UI change must not overwrite a pinned language.
    const effective = pinnedDocumentLocale() ?? next;
    writeLs(LS_KEY, effective);
    try {
        await setAppKv(DOCUMENT_LOCALE_KV_KEY, effective);
        if (opts.pin !== undefined) {
            await setAppKv(DOCUMENT_LOCALE_PIN_KV_KEY, opts.pin ? next : "");
        }
    } catch {
        /* offline / tests without Tauri */
    }
}

/**
 * After login: take a practice-wide pin if there is one; otherwise the UI
 * language decides and is pushed to the KV for server-only documents.
 */
export async function hydrateDocumentLocaleFromAppKv(): Promise<DocumentLocale> {
    let pin: DocumentLocale | null = null;
    try {
        pin = normalizeLocale(String((await getAppKv(DOCUMENT_LOCALE_PIN_KV_KEY)) ?? ""));
    } catch {
        /* offline / not ready */
    }
    writeLs(LS_PIN_KEY, pin);
    const next = documentLocale();
    writeLs(LS_KEY, next);
    try {
        await setAppKv(DOCUMENT_LOCALE_KV_KEY, next);
    } catch {
        /* ignore */
    }
    return next;
}

/** `documentLocale()` as UI `Locale` for `translateLocale`. */
export function documentLocaleForI18n(): Locale {
    return documentLocale();
}
