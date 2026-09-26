import { tauriInvoke } from "@/services/tauri.service";

const WORKFLOW_LOG_COMMAND = "log_workflow_event";

export type WorkflowLogEvent = {
    workflow: string;
    step: string;
    outcome?: string;
    command?: string;
    details?: Record<string, unknown>;
    error?: string;
};

function inTauriRuntime(): boolean {
    if (typeof window === "undefined") return false;
    const win = window as unknown as Record<string, unknown>;
    return "__TAURI_INTERNALS__" in win || "__TAURI_IPC__" in win;
}

export async function logWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    if (!inTauriRuntime()) return;
    try {
        await tauriInvoke<void>(WORKFLOW_LOG_COMMAND, { event });
    } catch {
        // Workflow telemetry must never break user-facing flows.
    }
}

export function logWorkflowRouteEnter(pathname: string, search: string): void {
    const workflow = `${pathname}${search ?? ""}`;
    void logWorkflowEvent({
        workflow,
        step: "route_enter",
        outcome: "success",
        details: { source: "react-router" },
    });
}
