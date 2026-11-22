/**
 * Error journal — in-memory ring buffer of recently shown errors (support / Help → "Recent errors").
 * Also lets presentation (toasts) find the code for a message without changing 60+ call sites that pass
 * a plain string (`toast(errorMessage(e), "error")`).
 */
import type { AppErrorInfo } from "./error-types";
import { extractErrorRef, reportClientEvent } from "../client-log";

export type JournalEntry = {
    readonly at: number;
    readonly code: string;
    readonly key: string;
    readonly message: string;
    readonly raw: string;
    readonly route: string;
};

const MAX = 50;
const entries: JournalEntry[] = [];
const byMessage = new Map<string, string>();

export function recordError(info: AppErrorInfo): void {
    const route = typeof window !== "undefined" ? window.location.pathname : "";
    entries.unshift({ at: Date.now(), code: info.entry.code, key: info.entry.key, message: info.message, raw: info.raw, route });
    // Every error the user sees is also written to client.log / errors.log, joined to the backend line by ref.
    reportClientEvent({ level: "error", code: info.entry.code, message: info.message, route, errorRef: extractErrorRef(info.raw), context: { key: info.entry.key } });
    if (entries.length > MAX) entries.length = MAX;
    byMessage.set(info.message, info.entry.code);
    if (byMessage.size > MAX * 2) {
        const first = byMessage.keys().next().value;
        if (first !== undefined) byMessage.delete(first);
    }
}

/** Support code for a message produced by the resolver in this session, if any. */
export function codeForMessage(message: string): string | undefined {
    return byMessage.get(message);
}

export function recentErrors(): readonly JournalEntry[] {
    return entries;
}

export function clearErrorJournal(): void {
    entries.length = 0;
    byMessage.clear();
}
