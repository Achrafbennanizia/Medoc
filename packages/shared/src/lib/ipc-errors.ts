/**
 * Facade over the error subsystem (`./errors`). Kept for the existing call sites:
 * `formatIpcError(e)` → localised message; `ipcErrorRaw(e)` → raw text.
 * New code should prefer `resolveAppError` to also get the support code, severity and retryability.
 */
import { useLocale, type Locale } from "./i18n";
import { errorRawText, recordError, resolveAppError } from "./errors";

/** Extract invoke error text from Tauri / fetch failures. */
export function ipcErrorRaw(err: unknown): string {
    return errorRawText(err);
}

/** Localised message for any thrown value; records it in the error journal for support. */
export function formatIpcError(err: unknown, locale?: Locale): string {
    const info = resolveAppError(err, locale);
    recordError(info);
    return info.message;
}

/** Hook-friendly IPC error formatter bound to the active locale. */
export function useFormatIpcError(): (err: unknown) => string {
    const locale = useLocale((s) => s.locale);
    return (err) => formatIpcError(err, locale);
}
