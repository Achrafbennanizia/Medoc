import { translateLocale, translateLocaleParams, useLocale, type Locale } from "./i18n";

const ERROR_KEY_RE = /^error\.[a-z0-9_.]+$/i;

/** Extract invoke error text from Tauri / fetch failures. */
export function ipcErrorRaw(err: unknown): string {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    return String(err);
}

function parseCodedError(raw: string): { key: string; params: Record<string, string> } | null {
    const pipe = raw.indexOf("|");
    if (pipe <= 0) return null;
    const key = raw.slice(0, pipe).trim();
    if (!ERROR_KEY_RE.test(key)) return null;
    const params: Record<string, string> = {};
    for (const segment of raw.slice(pipe + 1).split("|")) {
        const eq = segment.indexOf("=");
        if (eq <= 0) continue;
        params[segment.slice(0, eq).trim()] = segment.slice(eq + 1).trim();
    }
    return { key, params };
}

function resolveParamValues(loc: Locale, params: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, version] of Object.entries(params)) {
        if (ERROR_KEY_RE.test(version)) {
            const nested = translateLocale(loc, version);
            out[k] = nested !== version ? nested : version;
        } else {
            out[k] = version;
        }
    }
    return out;
}

/**
 * Map backend `AppError::ValidationCode("error.*")` (optional `|key=value` params) to localized UI text.
 * Falls back to the raw message for legacy German `Validation` strings.
 */
export function formatIpcError(err: unknown, locale?: Locale): string {
    const raw = ipcErrorRaw(err).trim();
    const loc = locale ?? useLocale.getState().locale;

    if (ERROR_KEY_RE.test(raw)) {
        const translated = translateLocale(loc, raw);
        if (translated && translated !== raw) return translated;
    }

    const coded = parseCodedError(raw);
    if (coded) {
        const params = resolveParamValues(loc, coded.params);
        const translated = translateLocaleParams(loc, coded.key, params);
        if (translated && translated !== coded.key) return translated;
    }

    return raw;
}

/** Hook-friendly IPC error formatter bound to the active locale. */
export function useFormatIpcError(): (err: unknown) => string {
    const locale = useLocale((s) => s.locale);
    return (err) => formatIpcError(err, locale);
}
