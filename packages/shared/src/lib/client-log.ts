/**
 * Client log — UI-side errors and warnings written to the desktop log files (`client.log`, and
 * `errors.log` for warn/error). See docs/architecture/logging.md.
 *
 * Dependency inversion: this module only knows a `ClientLogSink`. The desktop app installs one that calls
 * the `log_client_event` command (main.tsx); tests and the browser build install none, so reporting is a
 * no-op there. Reports are de-duplicated (same code + message within a short window) so a re-rendering
 * component cannot flood the log; the backend also rate-limits.
 */
export type ClientLogLevel = "error" | "warn" | "info";

export type ClientLogEvent = {
    readonly level: ClientLogLevel;
    /** Error catalogue code (`MD-…`) or wire key (`error.…`); empty when unknown. */
    readonly code: string;
    readonly message: string;
    /** Path only, never the query string (it can hold search terms). */
    readonly route: string;
    /** Backend `ref=` of the failed command, so UI and backend lines can be joined. */
    readonly errorRef?: string;
    readonly context?: Record<string, unknown>;
};

export type ClientLogSink = (event: ClientLogEvent) => void | Promise<void>;

const DEDUPE_MS = 5_000;
let sink: ClientLogSink | null = null;
const lastSent = new Map<string, number>();

export function setClientLogSink(next: ClientLogSink | null): void {
    sink = next;
}

/** `ref=AB12CD34` inside a wire error (`error.app.internal|ref=…`) or a message. */
export function extractErrorRef(raw: string): string | undefined {
    const m = /(?:^|[|\s(])ref=([A-Z0-9]{6,32})/.exec(raw);
    return m?.[1];
}

function currentRoute(): string {
    if (typeof window === "undefined") return "";
    return window.location.pathname;
}

export function reportClientEvent(event: Omit<ClientLogEvent, "route"> & { route?: string }): void {
    if (!sink) return;
    const key = `${event.level}|${event.code}|${event.message}`;
    const now = Date.now();
    const prev = lastSent.get(key);
    if (prev !== undefined && now - prev < DEDUPE_MS) return;
    lastSent.set(key, now);
    if (lastSent.size > 200) {
        for (const [k, t] of lastSent) if (now - t > DEDUPE_MS) lastSent.delete(k);
    }
    const full: ClientLogEvent = { ...event, route: event.route ?? currentRoute() };
    try {
        void Promise.resolve(sink(full)).catch(() => undefined);
    } catch {
        /* logging must never break the UI */
    }
}

/** Uncaught errors and unhandled promise rejections → client log. Returns an uninstall function. */
export function installGlobalErrorReporting(): () => void {
    if (typeof window === "undefined") return () => undefined;
    const onError = (e: ErrorEvent) => {
        reportClientEvent({
            level: "error",
            code: "MD-UIX-UNCAUGHT",
            message: e.message || String(e.error ?? "Uncaught error"),
            context: { source: e.filename?.split("?")[0], line: e.lineno, col: e.colno },
        });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
        const reason = e.reason instanceof Error ? e.reason.message : String(e.reason);
        reportClientEvent({ level: "error", code: "MD-UIX-REJECTION", message: reason, errorRef: extractErrorRef(reason) });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
        window.removeEventListener("error", onError);
        window.removeEventListener("unhandledrejection", onRejection);
    };
}
