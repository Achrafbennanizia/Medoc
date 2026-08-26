import { invoke } from "@tauri-apps/api/core";

export const WORKFLOW_LOG_COMMAND = "log_workflow_event";

export type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export interface WorkflowEventPayload {
    workflow: string;
    step: WorkflowStep;
    route?: string;
    action?: string;
    outcome?: string;
    detail?: string;
    command?: string;
}

function cleanText(value: unknown, maxChars: number): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const compact = value.replace(/\s+/g, " ").trim();
    if (!compact) {
        return undefined;
    }
    return compact.slice(0, maxChars);
}

function currentRoutePath(): string | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    return cleanText(window.location.pathname, 256);
}

export function extractWorkflowErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    if (error == null) {
        return "unknown_error";
    }
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

export function isCancellationError(errorMessage: string): boolean {
    return /(cancel|aborted|abgebrochen|user denied|geschlossen)/i.test(errorMessage);
}

export async function emitWorkflowEvent(payload: WorkflowEventPayload): Promise<void> {
    const workflow = cleanText(payload.workflow, 96);
    const step = cleanText(payload.step, 32) as WorkflowStep | undefined;
    if (!workflow || !step) {
        return;
    }

    const args: Record<string, unknown> = {
        workflow,
        step,
        route: cleanText(payload.route ?? currentRoutePath(), 256),
        action: cleanText(payload.action, 128),
        outcome: cleanText(payload.outcome, 96),
        detail: cleanText(payload.detail, 1024),
        command: cleanText(payload.command, 128),
    };

    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, args);
    } catch {
        // Logging must never interrupt UX flows.
    }
}
