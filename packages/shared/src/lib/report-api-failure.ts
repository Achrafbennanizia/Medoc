/**
 * Every failed API call → `client.log` (and `errors.log` for warn/error), whether the UI shows the
 * error or swallows it. See docs/architecture/logging.md → "API failures".
 *
 * One line per failure: transport (`ipc` = desktop backend, `lan` = main device over HTTPS), the
 * command, the catalogue code and kind, and for LAN calls the HTTP status and the request id the
 * main device logged too. Arguments are never logged (they can hold passwords or patient data), and
 * neither are error parameters (`substance=…`): only the error key.
 *
 * Expected outcomes (validation, not found, conflict) are `info` and stay out of errors.log.
 * Connectivity failures of one command are written once a minute: a device polling an
 * unreachable main device must not flood the log.
 */
import { reportClientEvent } from "./client-log";
import { resolveAppError } from "./errors/error-resolver";

export type ApiTransport = "ipc" | "lan";

export type ApiFailureDetail = {
    status?: number;
    requestId?: string;
};

/** The logging command itself must never be reported (it would loop). */
const NEVER_REPORT = new Set(["log_client_event"]);
const CONNECTIVITY_EVERY_MS = 60_000;
const lastConnectivity = new Map<string, number>();

const EXPECTED_KINDS = new Set(["validation", "state", "not_found", "conflict"]);

export function reportApiFailure(transport: ApiTransport, command: string, err: unknown, detail: ApiFailureDetail = {}): void {
    if (NEVER_REPORT.has(command)) return;
    let info;
    try {
        info = resolveAppError(err);
    } catch {
        return;
    }
    const { kind, code, key, severity } = info.entry;
    if (kind === "connectivity") {
        const k = `${transport}:${command}`;
        const now = Date.now();
        const last = lastConnectivity.get(k);
        if (last !== undefined && now - last < CONNECTIVITY_EVERY_MS) return;
        lastConnectivity.set(k, now);
    }
    const level = EXPECTED_KINDS.has(kind) ? "info" : severity === "warning" ? "warn" : "error";
    reportClientEvent({
        level,
        code,
        message: `API ${transport} ${command} failed: ${key}`,
        errorRef: info.ref,
        context: {
            event: "API_CALL_FAILED",
            transport,
            command,
            kind,
            ...(detail.status !== undefined ? { status: detail.status } : {}),
            ...(detail.requestId ? { request_id: detail.requestId } : {}),
        },
    });
}

/** Tests only. */
export function resetApiFailureThrottle(): void {
    lastConnectivity.clear();
}
