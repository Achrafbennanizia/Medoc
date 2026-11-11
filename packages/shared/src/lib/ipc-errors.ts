import { translateLocale, translateLocaleParams, useLocale, type Locale } from "./i18n";

const ERROR_KEY_RE = /^error\.[a-z0-9_.]+$/i;

/** Extract invoke error text from Tauri / fetch failures. */
export function ipcErrorRaw(err: unknown): string {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    return String(err);
}

/** Stable machine code for IPC errors (`FEATURE_DISABLED`, `error.app.*`). */
export function ipcErrorCode(err: unknown): string | null {
    const raw = ipcErrorRaw(err).trim();
    if (raw === "FEATURE_DISABLED" || raw.startsWith("FEATURE_DISABLED|")) {
        return "FEATURE_DISABLED";
    }
    const coded = parseCodedError(raw);
    if (coded) return coded.key;
    if (ERROR_KEY_RE.test(raw)) return raw;
    return null;
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
 * Uncoded messages are shown as received from the backend.
 */
function formatIpcErrorLine(raw: string, loc: Locale): string {
    const codedCandidate = (() => {
        if (ERROR_KEY_RE.test(raw) || parseCodedError(raw)) return raw;
        const m = raw.match(/\berror\.[a-z0-9_.]+(?:\|[^\s|]+(?:=[^\s|]*)?)*\b/i);
        return m?.[0] ?? raw;
    })();

    if (ERROR_KEY_RE.test(codedCandidate)) {
        const translated = translateLocale(loc, codedCandidate);
        if (translated && translated !== codedCandidate) return translated;
    }

    const coded = parseCodedError(codedCandidate);
    if (coded) {
        const params = resolveParamValues(loc, coded.params);
        const translated = translateLocaleParams(loc, coded.key, params);
        if (translated && translated !== coded.key) return translated;
    }

    return raw;
}

export function formatIpcError(err: unknown, locale?: Locale): string {
    const raw = ipcErrorRaw(err).trim().replace(/^Validation error:\s*/i, "");
    const loc = locale ?? useLocale.getState().locale;
    const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (lines.length === 0) return raw;
    return lines.map((line) => formatIpcErrorLine(line, loc)).join(" ");
}

/** Hook-friendly IPC error formatter bound to the active locale. */
export function useFormatIpcError(): (err: unknown) => string {
    const locale = useLocale((s) => s.locale);
    return (err) => formatIpcError(err, locale);
}
