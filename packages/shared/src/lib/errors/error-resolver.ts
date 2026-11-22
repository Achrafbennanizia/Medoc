/**
 * Error resolver (single responsibility: turn *anything* thrown into an {@link AppErrorInfo}).
 *
 * Pipeline: raw value → extract text → find `error.*` token → split params → catalog lookup → translate.
 * Messages without a token are classified heuristically (network / timeout / database text) so they still
 * receive a code and a manual entry instead of leaking driver text such as `Database error: …`.
 */
import { translateLocale, translateLocaleParams, useLocale, type Locale } from "../i18n";
import { ERROR_CATALOG } from "./error-catalog";
import type { AppErrorInfo, ErrorCatalogEntry } from "./error-types";

const ERROR_KEY_RE = /^error\.[a-z0-9_.]+$/i;
const EMBEDDED_TOKEN_RE = /\berror\.[a-z0-9_.]*[a-z0-9_](?:\|[^|\s=]+=[^|]*)*/i;

const BY_KEY: ReadonlyMap<string, ErrorCatalogEntry> = new Map(
    ERROR_CATALOG.filter((e) => !e.origin).map((e) => [e.key, e]),
);
const BY_CODE: ReadonlyMap<string, ErrorCatalogEntry> = new Map(ERROR_CATALOG.map((e) => [e.code, e]));
const BY_FEATURE: ReadonlyMap<string, ErrorCatalogEntry> = new Map(
    ERROR_CATALOG.filter((e) => e.origin === "feature" && e.feature).map((e) => [e.feature!, e]),
);

type CompiledTemplate = { entry: ErrorCatalogEntry; re: RegExp; names: string[] };

/** Same delimiter sanitising the backend applies to free text (`AppError::wire_code`). */
function sanitizeLikeBackend(s: string): string {
    return s.replace(/\|/g, "/").replace(/=/g, ":");
}

function compileTemplate(entry: ErrorCatalogEntry): CompiledTemplate {
    const names: string[] = [];
    let positional = 0;
    const src = sanitizeLikeBackend(entry.template ?? "")
        .split(/(\{[a-zA-Z_][a-zA-Z0-9_]*(?::[^}]*)?\}|\{\})/)
        .map((part) => {
            const m = /^\{([a-zA-Z_][a-zA-Z0-9_]*)?(?::[^}]*)?\}$/.exec(part);
            if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            names.push(m[1] ?? `p${positional++}`);
            return "([\\s\\S]+?)";
        })
        .join("");
    return { entry, re: new RegExp(`^${src}$`), names };
}

/** Text errors, most specific (longest literal) first so generic templates do not shadow others. */
const TEXT_TEMPLATES: readonly CompiledTemplate[] = ERROR_CATALOG.filter(
    (e) => (e.origin === "backend-text" || e.origin === "ui") && e.template,
)
    .map(compileTemplate)
    .sort((a, b) => b.entry.template!.replace(/\{[^}]*\}/g, "").length - a.entry.template!.replace(/\{[^}]*\}/g, "").length);

/** Find the catalog entry for a free-text message (backend `Validation`/`Conflict` detail or UI throw). */
export function matchTextError(text: string): { entry: ErrorCatalogEntry; params: Record<string, string> } | null {
    const t = text.trim();
    for (const ct of TEXT_TEMPLATES) {
        const m = ct.re.exec(t) ?? ct.re.exec(sanitizeLikeBackend(t));
        if (!m) continue;
        const params: Record<string, string> = {};
        ct.names.forEach((n, i) => (params[n] = m[i + 1] ?? ""));
        return { entry: ct.entry, params };
    }
    return null;
}

function entryOrThrow(key: string): ErrorCatalogEntry {
    const e = BY_KEY.get(key);
    if (!e) throw new Error(`error catalog is missing ${key}`);
    return e;
}

const FALLBACK = {
    unknown: entryOrThrow("error.app.unknown"),
    network: entryOrThrow("error.app.network"),
    timeout: entryOrThrow("error.app.timeout"),
    offline: entryOrThrow("error.app.offline"),
    database: entryOrThrow("error.app.database"),
    internal: entryOrThrow("error.app.internal"),
    validation: entryOrThrow("error.app.validation"),
} as const;

export function catalogEntryByKey(key: string): ErrorCatalogEntry | undefined {
    return BY_KEY.get(key);
}

export function catalogEntryByCode(code: string): ErrorCatalogEntry | undefined {
    return BY_CODE.get(code.trim().toUpperCase());
}

/** Extract text from Tauri invoke rejections, `Error`, fetch failures or plain objects. */
export function errorRawText(err: unknown): string {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    if (err && typeof err === "object") {
        const o = err as Record<string, unknown>;
        for (const k of ["error", "message", "detail"]) {
            if (typeof o[k] === "string") return o[k] as string;
        }
        try {
            return JSON.stringify(err);
        } catch {
            /* fallthrough */
        }
    }
    return String(err);
}

type Token = { key: string; params: Record<string, string> };

function splitToken(token: string): Token {
    const [key, ...segments] = token.split("|");
    const params: Record<string, string> = {};
    for (const seg of segments) {
        const eq = seg.indexOf("=");
        if (eq <= 0) continue;
        params[seg.slice(0, eq).trim()] = seg.slice(eq + 1).trim();
    }
    return { key: key.trim(), params };
}

/** Find the coded token in a raw message (whole string or embedded in a wrapper such as `LAN HTTP 400: …`). */
export function extractErrorToken(raw: string): Token | null {
    // Legacy machine code from `AppError::FeatureDisabled` → catalog key.
    const text = raw.trim().replace(/^FEATURE_DISABLED(?=\||$)/, "error.app.feature_disabled");
    const head = text.split("|")[0]?.trim() ?? "";
    if (ERROR_KEY_RE.test(head)) return splitToken(text);
    const m = text.match(EMBEDDED_TOKEN_RE);
    return m ? splitToken(m[0]) : null;
}

function classifyUncoded(raw: string): ErrorCatalogEntry {
    const s = raw.toLowerCase();
    if (typeof navigator !== "undefined" && navigator.onLine === false) return FALLBACK.offline;
    if (/abort|timed? ?out|timeout/.test(s)) return FALLBACK.timeout;
    if (/failed to fetch|networkerror|network error|load failed|econnrefused|connection refused|unreachable/.test(s)) {
        return FALLBACK.network;
    }
    if (/^database error|sqlite|sqlx|constraint failed/.test(s)) return FALLBACK.database;
    if (/^internal error/.test(s)) return FALLBACK.internal;
    if (/^validation error:/.test(s)) return FALLBACK.validation;
    return FALLBACK.unknown;
}

function textInfo(
    entry: ErrorCatalogEntry,
    params: Record<string, string>,
    detail: string,
    raw: string,
    loc: Locale,
): AppErrorInfo {
    if (entry.translated) {
        const translated = translateLocaleParams(loc, entry.key, params);
        if (translated && translated !== entry.key) return { entry, message: translated, params, raw };
    }
    return { entry, message: detail, params, raw };
}

function translateParams(loc: Locale, params: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
        if (ERROR_KEY_RE.test(v)) {
            const nested = translateLocale(loc, v);
            out[k] = nested !== v ? nested : v;
        } else {
            out[k] = v;
        }
    }
    return out;
}

/** Resolve any thrown value into a display-ready, coded error. */
export function resolveAppError(err: unknown, locale?: Locale): AppErrorInfo {
    const raw = errorRawText(err).trim().replace(/^Validation error:\s*(?=error\.)/i, "");
    const loc = locale ?? useLocale.getState().locale;
    const token = extractErrorToken(raw);

    if (token) {
        // Free-text detail from `AppError::Validation/Conflict` → its own catalog entry and translation.
        if ((token.key === "error.app.validation" || token.key === "error.app.conflict") && token.params.detail) {
            const hit = matchTextError(token.params.detail);
            if (hit) return textInfo(hit.entry, hit.params, token.params.detail, raw, loc);
        }
        if (token.key === "error.app.feature_disabled") {
            const feature = token.params.feature ?? "";
            const entry = BY_FEATURE.get(feature) ?? entryOrThrow("error.app.feature_disabled");
            const name = translateLocale(loc, `errors.feature.${feature}`);
            const message = translateLocaleParams(loc, "error.app.feature_disabled", {
                feature: name !== `errors.feature.${feature}` ? name : feature,
            });
            return { entry, message, params: { feature }, raw };
        }
        const entry = BY_KEY.get(token.key) ?? FALLBACK.unknown;
        const params = translateParams(loc, token.params);
        const translated =
            Object.keys(params).length > 0 ? translateLocaleParams(loc, token.key, params) : translateLocale(loc, token.key);
        const message = translated && translated !== token.key ? translated : raw;
        return { entry, message, params, raw, ref: params.ref };
    }

    // UI-thrown text and legacy backend text without a token.
    const uiHit = matchTextError(raw.replace(/^(validation error|conflict):\s*/i, ""));
    if (uiHit) return textInfo(uiHit.entry, uiHit.params, raw, raw, loc);

    const entry = classifyUncoded(raw);
    // Uncoded backend text for validation is human-written; system text is not — replace it.
    const detail = raw.replace(/^(validation error|database error|internal error):\s*/i, "");
    const showRaw = entry === FALLBACK.validation || entry === FALLBACK.unknown;
    const message = showRaw
        ? detail || translateLocale(loc, entry.key)
        : translateLocaleParams(loc, entry.key, { detail });
    return { entry, message, params: { detail }, raw };
}
