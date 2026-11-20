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

const BY_KEY: ReadonlyMap<string, ErrorCatalogEntry> = new Map(ERROR_CATALOG.map((e) => [e.key, e]));
const BY_CODE: ReadonlyMap<string, ErrorCatalogEntry> = new Map(ERROR_CATALOG.map((e) => [e.code, e]));

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
    const text = raw.trim();
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
    const raw = errorRawText(err).trim();
    const loc = locale ?? useLocale.getState().locale;
    const token = extractErrorToken(raw);

    if (token) {
        const entry = BY_KEY.get(token.key) ?? FALLBACK.unknown;
        const params = translateParams(loc, token.params);
        const translated =
            Object.keys(params).length > 0 ? translateLocaleParams(loc, token.key, params) : translateLocale(loc, token.key);
        const message = translated && translated !== token.key ? translated : raw;
        return { entry, message, params, raw, ref: params.ref };
    }

    const entry = classifyUncoded(raw);
    // Uncoded backend text for validation is human-written; system text is not — replace it.
    const detail = raw.replace(/^(validation error|database error|internal error):\s*/i, "");
    const showRaw = entry === FALLBACK.validation || entry === FALLBACK.unknown;
    const message = showRaw
        ? detail || translateLocale(loc, entry.key)
        : translateLocaleParams(loc, entry.key, { detail });
    return { entry, message, params: { detail }, raw };
}
