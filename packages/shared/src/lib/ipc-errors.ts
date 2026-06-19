import { translateLocale, useLocale, type Locale } from "./i18n";

const ERROR_KEY_RE = /^error\.[a-z0-9_.]+$/i;

/** Extract invoke error text from Tauri / fetch failures. */
export function ipcErrorRaw(err: unknown): string {
    if (typeof err === "string") return err;
    if (err instanceof Error) return err.message;
    return String(err);
}

/**
 * Map backend `AppError::ValidationCode("error.*")` to localized UI text.
 * Falls back to the raw message for legacy German `Validation` strings.
 */
export function formatIpcError(err: unknown, locale?: Locale): string {
    const raw = ipcErrorRaw(err).trim();
    if (ERROR_KEY_RE.test(raw)) {
        const loc = locale ?? useLocale.getState().locale;
        const translated = translateLocale(loc, raw);
        if (translated && translated !== raw) return translated;
    }
    return raw;
}

/** Hook-friendly IPC error formatter bound to the active locale. */
export function useFormatIpcError(): (err: unknown) => string {
    const locale = useLocale((s) => s.locale);
    return (err) => formatIpcError(err, locale);
}
