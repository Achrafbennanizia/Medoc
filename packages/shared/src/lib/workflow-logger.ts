import { invoke } from "@tauri-apps/api/core";

export type WorkflowStage = "route_enter" | "primary_action" | "success" | "cancel" | "error";

const WORKFLOW_LOG_COMMAND = "record_workflow_event";
const FIELD_LIMIT = 160;

type WorkflowEvent = {
    stage: WorkflowStage;
    route?: string;
    action?: string;
    outcome?: string;
    detail?: string;
    source?: string;
    correlationId?: string;
    durationMs?: number;
};

function looksLikeDynamicSegment(segment: string): boolean {
    if (/^\d{2,}$/.test(segment)) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment)) {
        return true;
    }
    return /^[A-Za-z0-9_-]{16,}$/.test(segment);
}

function normalizeSegment(segment: string): string {
    if (!segment) return segment;
    return looksLikeDynamicSegment(segment) ? ":id" : segment;
}

function trimField(value?: string): string | undefined {
    if (value == null) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return Array.from(trimmed).slice(0, FIELD_LIMIT).join("");
}

export function normalizeWorkflowRoute(pathname: string): string {
    const route = trimField(pathname) ?? "/";
    const pathOnly = route.split("?")[0]?.split("#")[0] ?? "/";
    const parts = pathOnly
        .split("/")
        .filter(Boolean)
        .map((part) => normalizeSegment(part));
    if (parts.length === 0) {
        return "/";
    }
    return `/${parts.join("/")}`;
}

async function sendWorkflowEvent(event: WorkflowEvent): Promise<void> {
    try {
        await invoke(WORKFLOW_LOG_COMMAND, {
            event: {
                stage: event.stage,
                route: trimField(event.route),
                action: trimField(event.action),
                outcome: trimField(event.outcome),
                detail: trimField(event.detail),
                source: trimField(event.source),
                correlationId: trimField(event.correlationId),
                durationMs: event.durationMs,
            },
        });
    } catch {
        // Workflow logging must never break UI behavior.
    }
}

export function emitWorkflowRouteEnter(pathname: string): void {
    void sendWorkflowEvent({
        stage: "route_enter",
        route: normalizeWorkflowRoute(pathname),
        source: "frontend_router",
    });
}

export function emitWorkflowPrimaryAction(action: string, correlationId: string): void {
    void sendWorkflowEvent({
        stage: "primary_action",
        action,
        outcome: "started",
        correlationId,
        source: "frontend_invoke",
    });
}

export function emitWorkflowSuccess(action: string, correlationId: string, durationMs: number): void {
    void sendWorkflowEvent({
        stage: "success",
        action,
        outcome: "completed",
        correlationId,
        durationMs: Math.max(0, Math.round(durationMs)),
        source: "frontend_invoke",
    });
}

export function emitWorkflowError(action: string, correlationId: string, durationMs: number): void {
    void sendWorkflowEvent({
        stage: "error",
        action,
        outcome: "failed",
        correlationId,
        durationMs: Math.max(0, Math.round(durationMs)),
        source: "frontend_invoke",
    });
}

export function emitWorkflowCancel(action: string, correlationId: string, detail?: string): void {
    void sendWorkflowEvent({
        stage: "cancel",
        action,
        outcome: "cancelled",
        correlationId,
        detail,
        source: "frontend_invoke",
    });
}
