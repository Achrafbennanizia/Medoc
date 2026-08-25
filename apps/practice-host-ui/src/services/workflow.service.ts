import { invoke } from "@tauri-apps/api/core";

const WORKFLOW_LOG_COMMAND = "workflow_log_event";
const MAX_VALUE_LEN = 1024;

export type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

type WorkflowEventPayload = {
    step: WorkflowStep;
    route?: string;
    action?: string;
    outcome?: string;
    command?: string;
    details?: string;
};

function normalizeValue(value?: string, maxLen = MAX_VALUE_LEN): string | undefined {
    if (value == null) {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.slice(0, maxLen);
}

function currentRoute(): string | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    return window.location.pathname;
}

export async function emitWorkflowEvent(payload: WorkflowEventPayload): Promise<void> {
    const args = {
        step: normalizeValue(payload.step, 64) ?? "primary_action",
        route: normalizeValue(payload.route ?? currentRoute(), 256),
        action: normalizeValue(payload.action, 128),
        outcome: normalizeValue(payload.outcome, 64),
        command: normalizeValue(payload.command, 128),
        details: normalizeValue(payload.details, 1024),
    };
    try {
        await invoke(WORKFLOW_LOG_COMMAND, args);
    } catch {
        // Workflow logging is best-effort; user actions must continue even if logging fails.
    }
}

export async function logWorkflowRouteEnter(route: string): Promise<void> {
    await emitWorkflowEvent({
        step: "route_enter",
        route,
        action: "route_enter",
        outcome: "entered",
    });
}

export async function logWorkflowPrimaryAction(command: string, details?: string): Promise<void> {
    await emitWorkflowEvent({
        step: "primary_action",
        action: command,
        command,
        outcome: "started",
        details,
    });
}

export async function logWorkflowOutcome(
    outcome: "success" | "cancel" | "error",
    command: string,
    details?: string,
): Promise<void> {
    await emitWorkflowEvent({
        step: outcome,
        action: command,
        command,
        outcome,
        details,
    });
}

export async function logWorkflowCancel(action: string, details?: string): Promise<void> {
    await emitWorkflowEvent({
        step: "cancel",
        action,
        outcome: "cancel",
        details,
    });
}
