import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type WorkflowEventPayload = {
    phase: string;
    route?: string;
    action?: string;
    status?: string;
    detail?: string;
    durationMs?: number;
};

const SECRET_PAIR_RE = /(password|token|secret|api[_-]?key|license)\s*[:=]\s*\S+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const UUID_SEGMENT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_HEX_OR_NUMERIC_SEGMENT_RE = /^(?:[a-f0-9]{16,}|\d{6,})$/i;

function isTauriDesktopRuntime(): boolean {
    if (typeof window === "undefined") return false;
    return "__TAURI_INTERNALS__" in window;
}

function sanitizeDetail(raw: string, maxChars = 512): string {
    const scrubbedSecrets = raw.replace(
        SECRET_PAIR_RE,
        (_all, key: string) => `${String(key).toLowerCase()}=***`,
    );
    const scrubbedJwt = scrubbedSecrets.replace(JWT_RE, "eyJ***");
    return scrubbedJwt.trim().slice(0, maxChars);
}

function normalizePathSegment(segment: string): string {
    if (!segment) return segment;
    if (UUID_SEGMENT_RE.test(segment)) return ":id";
    if (LONG_HEX_OR_NUMERIC_SEGMENT_RE.test(segment)) return ":id";
    return segment;
}

function normalizeRoute(pathname: string, search: string): string {
    const normalizedPath = pathname
        .split("/")
        .map((segment) => normalizePathSegment(segment))
        .join("/") || "/";
    if (!search) return normalizedPath;
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const keys = [...new Set(params.keys())].sort();
    if (keys.length === 0) return normalizedPath;
    return `${normalizedPath}?${keys.join("&")}`;
}

function cleanField(raw: string | undefined, maxChars: number): string | undefined {
    if (!raw) return undefined;
    const out = sanitizeDetail(raw, maxChars);
    return out.length > 0 ? out : undefined;
}

export async function emitWorkflowEvent(event: WorkflowEventPayload): Promise<void> {
    if (!isTauriDesktopRuntime()) return;
    const phase = cleanField(event.phase, 48);
    if (!phase) return;
    const payload: WorkflowEventPayload = {
        phase,
        route: cleanField(event.route, 256),
        action: cleanField(event.action, 128),
        status: cleanField(event.status, 48),
        detail: cleanField(event.detail, 512),
        durationMs: event.durationMs,
    };
    try {
        await practiceSystem.invoke<void>("log_workflow_event", { event: payload });
    } catch {
        // Best-effort observability only.
    }
}

export function recordRouteEnter(pathname: string, search: string): void {
    const route = normalizeRoute(pathname, search);
    void emitWorkflowEvent({
        phase: "route_enter",
        route,
        status: "enter",
    });
}
