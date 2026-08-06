import { invoke } from "@tauri-apps/api/core";

export type WorkflowEventType =
    | "route_enter"
    | "primary_action"
    | "success"
    | "cancel"
    | "error";

export type WorkflowEventInput = {
    eventType: WorkflowEventType;
    route?: string;
    action?: string;
    command?: string;
    detail?: string;
    correlationId?: string;
};

let bridgeDisabled = false;

function hasTauriBridge(): boolean {
    const g = globalThis as {
        __TAURI_INTERNALS__?: unknown;
        __TAURI_IPC__?: unknown;
    };
    return Boolean(g.__TAURI_INTERNALS__ || g.__TAURI_IPC__);
}

function truncateChars(value: string, maxChars: number): string {
    return value.slice(0, maxChars);
}

function normalizeOptional(value: string | undefined, maxChars: number): string | undefined {
    if (value == null) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return truncateChars(trimmed, maxChars);
}

function looksOpaqueRouteSegment(segment: string): boolean {
    if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment)) return true; // UUID-like
    if (/^\d{4,}$/.test(segment)) return true; // long numeric id
    if (/^[A-Za-z0-9_-]{16,}$/.test(segment) && /\d/.test(segment)) return true; // token-like
    return false;
}

/**
 * Remove query/hash and mask dynamic id-like path segments to avoid
 * persisting patient-identifying values in workflow logs.
 */
export function normalizeWorkflowRoute(rawRoute: string): string {
    const path = rawRoute.split(/[?#]/, 1)[0] ?? "/";
    if (!path || path === "/") return "/";
    const parts = path.split("/");
    const mapped = parts.map((segment, idx) => {
        if (idx === 0 || segment.length === 0) return segment;
        return looksOpaqueRouteSegment(segment) ? ":id" : segment;
    });
    const normalized = mapped.join("/");
    return normalized.length > 0 ? normalized : "/";
}

/**
 * Best-effort frontend → backend workflow bridge.
 * Failures are swallowed so telemetry never blocks clinical workflows.
 */
export async function logWorkflowEvent(event: WorkflowEventInput): Promise<void> {
    if (bridgeDisabled || !hasTauriBridge()) return;
    try {
        const rawRoute = normalizeOptional(event.route, 240);
        await invoke("log_workflow_event", {
            eventType: event.eventType,
            route: rawRoute ? normalizeWorkflowRoute(rawRoute) : undefined,
            action: normalizeOptional(event.action, 120),
            command: normalizeOptional(event.command, 120),
            detail: normalizeOptional(event.detail, 320),
            correlationId: normalizeOptional(event.correlationId, 80),
        });
    } catch {
        // If the bridge command is unavailable (older backend / browser mode),
        // disable further attempts for this session.
        bridgeDisabled = true;
    }
}

/** Test-only hook. */
export function resetWorkflowBridgeForTests(): void {
    bridgeDisabled = false;
}
