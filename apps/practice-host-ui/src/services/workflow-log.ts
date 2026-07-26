import { invoke } from "@tauri-apps/api/core";

export type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export interface WorkflowEvent {
    step: WorkflowStep;
    route?: string;
    action?: string;
    outcome?: string;
    detail?: string;
    durationMs?: number;
}

function currentRoute(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return window.location.pathname || "/";
}

function trimDetail(detail: string | undefined): string | undefined {
    if (!detail) return undefined;
    const value = detail.trim();
    if (!value) return undefined;
    return value.slice(0, 160);
}

/**
 * Best-effort workflow telemetry bridge. Logging must never block UI flows.
 */
export async function emitWorkflowEvent(event: WorkflowEvent): Promise<void> {
    try {
        await invoke("log_workflow_event", {
            event: {
                step: event.step,
                route: event.route ?? currentRoute(),
                action: event.action,
                outcome: event.outcome,
                detail: trimDetail(event.detail),
                duration_ms: event.durationMs,
            },
        });
    } catch {
        // Swallow bridge failures: workflow logging is diagnostic only.
    }
}
