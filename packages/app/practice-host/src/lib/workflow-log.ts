import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";

export type WorkflowLogStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export type WorkflowLogEvent = {
    step: WorkflowLogStep;
    route?: string;
    action?: string;
    status?: string;
    detail?: string;
};

const MAX_FIELD_LEN = 256;

function shouldSendWorkflowEventToBackend(): boolean {
    if (import.meta.env?.MODE === "test") {
        const globalWithFlag = globalThis as typeof globalThis & {
            __MEDOC_ENABLE_WORKFLOW_IPC__?: boolean;
        };
        return globalWithFlag.__MEDOC_ENABLE_WORKFLOW_IPC__ === true;
    }
    return typeof window !== "undefined";
}

function normalizeField(value?: string): string | undefined {
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    if (trimmed.length <= MAX_FIELD_LEN) {
        return trimmed;
    }
    return `${trimmed.slice(0, MAX_FIELD_LEN)}...`;
}

export function summarizeInvokeArgs(args?: Record<string, unknown>): string | undefined {
    if (!args) {
        return undefined;
    }
    const keys = Object.keys(args).filter((key) => args[key] !== undefined);
    if (keys.length === 0) {
        return undefined;
    }
    return normalizeField(`keys=${keys.sort().join(",")}`);
}

export async function emitWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    if (!shouldSendWorkflowEventToBackend()) {
        return;
    }
    const payload = {
        step: normalizeField(event.step) ?? "unknown",
        route: normalizeField(event.route),
        action: normalizeField(event.action),
        status: normalizeField(event.status),
        detail: normalizeField(event.detail),
    };
    try {
        await tauriInvoke<void>("log_workflow_event", payload);
    } catch {
        // Logging failures must never break user workflows.
    }
}
