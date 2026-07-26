import { invoke } from "@tauri-apps/api/core";

export type WorkflowStepName = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export interface WorkflowLogStepInput {
    flow: string;
    step: WorkflowStepName;
    route?: string;
    action?: string;
    outcome?: string;
    correlationId?: string;
    detail?: string;
}

const WORKFLOW_LOG_COMMAND = "log_workflow_step";

function hasTauriRuntime(): boolean {
    if (typeof window === "undefined") return false;
    const maybeWindow = window as unknown as Record<string, unknown>;
    return "__TAURI_INTERNALS__" in maybeWindow;
}

function sanitizeToken(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._/-]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function isLikelyId(segment: string): boolean {
    return (/^\d{4,}$/).test(segment) || (/^[a-f0-9-]{8,}$/i).test(segment);
}

export function normalizeWorkflowRoute(route: string): string {
    const [pathOnly] = route.split("?");
    const normalized = pathOnly
        .split("/")
        .filter(Boolean)
        .map((segment) => (isLikelyId(segment) ? ":id" : segment))
        .join("/");
    return normalized ? `/${normalized}` : "/";
}

async function sendWorkflowStep(step: WorkflowLogStepInput): Promise<void> {
    if (!hasTauriRuntime()) return;
    const payload = {
        flow: sanitizeToken(step.flow) || "ui.workflow",
        step: step.step,
        route: step.route ? normalizeWorkflowRoute(step.route) : undefined,
        action: step.action ? sanitizeToken(step.action) : undefined,
        outcome: step.outcome ? sanitizeToken(step.outcome) : undefined,
        correlationId: step.correlationId ? sanitizeToken(step.correlationId) : undefined,
        detail: step.detail?.slice(0, 200),
    };
    try {
        await invoke(WORKFLOW_LOG_COMMAND, { step: payload });
    } catch {
        // Workflow telemetry must never block UX paths.
    }
}

export function logWorkflowStep(step: WorkflowLogStepInput): void {
    void sendWorkflowStep(step);
}

export function logWorkflowRouteEnter(route: string): void {
    logWorkflowStep({
        flow: "ui.route",
        step: "route_enter",
        route,
    });
}
