import { invoke } from "@tauri-apps/api/core";

export const WORKFLOW_EVENT_COMMAND = "record_workflow_event";

export type WorkflowEventStage =
    | "route_enter"
    | "primary_action"
    | "success"
    | "cancel"
    | "error";

export interface WorkflowEventPayload {
    stage: WorkflowEventStage;
    workflow: string;
    route?: string;
    source?: string;
    action?: string;
    errorKind?: string;
    durationMs?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_RE = /^\d+$/;
const LONG_HEX_RE = /^[0-9a-f]{16,}$/i;
const TEXT_LIMIT = 160;

function normalizeRouteSegment(segment: string): string {
    const clean = segment.trim();
    if (!clean) return clean;
    if (UUID_RE.test(clean) || NUMERIC_RE.test(clean) || LONG_HEX_RE.test(clean)) {
        return ":id";
    }
    return clean;
}

function trimText(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, TEXT_LIMIT);
}

export function normalizeWorkflowRoute(rawPath: string): string {
    const withoutQuery = (rawPath || "/").split("?")[0]?.split("#")[0] ?? "/";
    const segments = withoutQuery
        .split("/")
        .filter((segment) => segment.length > 0)
        .map(normalizeRouteSegment);
    if (segments.length === 0) return "/";
    return `/${segments.join("/")}`;
}

function sanitizeEvent(event: WorkflowEventPayload): WorkflowEventPayload {
    const workflow = trimText(event.workflow) ?? "_";
    const route = event.route ? normalizeWorkflowRoute(event.route) : undefined;
    const source = trimText(event.source);
    const action = trimText(event.action);
    const errorKind = trimText(event.errorKind);
    const durationMs =
        typeof event.durationMs === "number" && Number.isFinite(event.durationMs) && event.durationMs >= 0
            ? Math.round(event.durationMs)
            : undefined;
    return {
        stage: event.stage,
        workflow,
        route,
        source,
        action,
        errorKind,
        durationMs,
    };
}

export async function emitWorkflowEvent(event: WorkflowEventPayload): Promise<void> {
    await invoke<void>(WORKFLOW_EVENT_COMMAND, { event: sanitizeEvent(event) });
}

export function emitWorkflowEventBestEffort(event: WorkflowEventPayload): void {
    void emitWorkflowEvent(event).catch(() => {
        // Keep workflow instrumentation non-blocking for UI actions.
    });
}
