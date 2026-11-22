/**
 * Facade over the error subsystem (`./errors`). Kept for the existing call sites:
 * `formatIpcError(e)` → localised message; `ipcErrorRaw(e)` → raw text; `ipcErrorCode(e)` → stable key.
 * New code should prefer `resolveAppError` to also get the support code, severity and retryability.
 */
import { useLocale, type Locale } from "./i18n";
import { errorRawText, extractErrorToken, recordError, resolveAppError } from "./errors";

/** Extract invoke error text from Tauri / fetch failures. */
export function ipcErrorRaw(err: unknown): string {
    return errorRawText(err);
}

/** Stable machine code for IPC errors (`FEATURE_DISABLED`, `error.*`), or null for uncoded text. */
export function ipcErrorCode(err: unknown): string | null {
    const raw = ipcErrorRaw(err).trim();
    if (raw === "FEATURE_DISABLED" || raw.startsWith("FEATURE_DISABLED|")) return "FEATURE_DISABLED";
    return extractErrorToken(raw)?.key ?? null;
}

/**
 * Localised message for any thrown value; records it in the error journal for support.
 * Multi-line backend errors (one problem per line) are resolved line by line.
 */
export function formatIpcError(err: unknown, locale?: Locale): string {
    const raw = ipcErrorRaw(err).trim();
    const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (lines.length <= 1) {
        const info = resolveAppError(err, locale);
        recordError(info);
        return info.message;
    }
    const infos = lines.map((line) => resolveAppError(line, locale));
    infos.forEach(recordError);
    return infos.map((i) => i.message).join(" ");
}

/** Hook-friendly IPC error formatter bound to the active locale. */
export function useFormatIpcError(): (err: unknown) => string {
    const locale = useLocale((s) => s.locale);
    return (err) => formatIpcError(err, locale);
}
