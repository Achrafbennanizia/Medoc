import { invoke } from "@tauri-apps/api/core";

export type WorkflowPhase =
    | "route_enter"
    | "primary_action"
    | "success"
    | "cancel"
    | "error";

export type WorkflowEvent = {
    phase: WorkflowPhase;
    route?: string;
    action?: string;
    status?: string;
    detail?: string;
};

const WORKFLOW_COMMAND = "log_workflow_event";

function redactPathSegment(segment: string): string {
    if (!segment) return segment;
    if (/^\d{3,}$/.test(segment)) return ":id";
    if (/^[a-f0-9]{8,}$/i.test(segment)) return ":id";
    if (/^[A-Za-z0-9_-]{16,}$/.test(segment)) return ":id";
    return segment;
}

export function workflowRouteFromLocation(pathname: string, search: string): string {
    const safePath = pathname
        .split("/")
        .map((segment) => redactPathSegment(segment))
        .join("/");
    if (!search || search === "?") return safePath;
    const params = new URLSearchParams(search);
    const keys = [...new Set([...params.keys()])];
    if (keys.length === 0) return safePath;
    return `${safePath}?${keys.map((key) => `${encodeURIComponent(key)}=*`).join("&")}`;
}

export function currentWorkflowRoute(): string {
    if (typeof window === "undefined") return "unknown";
    const { pathname, search } = window.location;
    return workflowRouteFromLocation(pathname, search);
}

export function classifyWorkflowFailurePhase(error: unknown): "cancel" | "error" {
    const message = error instanceof Error ? error.message : String(error ?? "");
    const normalized = message.toLowerCase();
    return normalized.includes("cancel") || normalized.includes("abort") ? "cancel" : "error";
}

export function formatWorkflowFailure(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return message.slice(0, 240);
}

export async function logWorkflowEvent(event: WorkflowEvent): Promise<void> {
    await invoke<void>(WORKFLOW_COMMAND, { event });
}

export function logWorkflowEventFireAndForget(event: WorkflowEvent): void {
    void logWorkflowEvent(event).catch(() => undefined);
}
