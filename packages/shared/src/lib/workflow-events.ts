export const WORKFLOW_EVENT_NAME = "medoc:workflow-event";

export type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export interface WorkflowEvent {
    workflow: string;
    step: WorkflowStep;
    route?: string;
    action?: string;
    correlationId?: string;
    outcome?: string;
    errorKind?: string;
    timestampMs?: number;
}

const UUID_SEGMENT_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_ID_SEGMENT_RE = /^\d{3,}$/;
const OPAQUE_ID_SEGMENT_RE = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z0-9_-]{12,}$/;
const ENTITY_ID_SEGMENT_RE =
    /^(pat|akte|behandlung|untersuchung|rezept|ticket|aufgabe|bestellung|zahlung|personal)-[a-z0-9_-]+$/i;

export function sanitizeWorkflowRoute(pathname: string): string {
    if (!pathname || pathname === "/") {
        return "/";
    }
    const parts = pathname
        .split("/")
        .filter(Boolean)
        .map((segment) =>
            UUID_SEGMENT_RE.test(segment) ||
            NUMERIC_ID_SEGMENT_RE.test(segment) ||
            OPAQUE_ID_SEGMENT_RE.test(segment) ||
            ENTITY_ID_SEGMENT_RE.test(segment)
                ? ":id"
                : segment
        );
    return `/${parts.join("/")}`;
}

export function createWorkflowCorrelationId(): string {
    const randomUuid = globalThis.crypto?.randomUUID?.();
    if (randomUuid) {
        return randomUuid;
    }
    return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emitWorkflowEvent(event: WorkflowEvent): void {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
        return;
    }
    const detail: WorkflowEvent = {
        ...event,
        route: event.route ? sanitizeWorkflowRoute(event.route) : undefined,
        timestampMs: event.timestampMs ?? Date.now(),
    };
    window.dispatchEvent(new CustomEvent<WorkflowEvent>(WORKFLOW_EVENT_NAME, { detail }));
}
