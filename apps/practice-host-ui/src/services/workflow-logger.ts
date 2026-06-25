import { invoke } from "@tauri-apps/api/core";

export type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export type WorkflowEventInput = {
    step: WorkflowStep;
    route?: string;
    action?: string;
    detail?: string;
    context?: string;
};

const WORKFLOW_FIELD_MAX_LEN = 160;
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_TOKEN = /^[A-Za-z0-9_-]{16,}$/;
const DIGITS = /^\d{2,}$/;

function sanitizeField(value: string | undefined): string | undefined {
    if (value == null) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.length <= WORKFLOW_FIELD_MAX_LEN) {
        return trimmed;
    }
    return trimmed.slice(0, WORKFLOW_FIELD_MAX_LEN);
}

export function redactRoutePath(pathname: string): string {
    const segments = pathname.split("/");
    const redacted = segments.map((segment) => {
        if (!segment) return segment;
        if (UUID_LIKE.test(segment) || DIGITS.test(segment) || LONG_TOKEN.test(segment)) {
            return ":id";
        }
        return segment;
    });
    return redacted.join("/") || "/";
}

export function classifyWorkflowError(err: unknown): "cancel" | "error" {
    const name =
        err && typeof err === "object" && "name" in err
            ? String((err as { name?: unknown }).name ?? "")
            : "";
    const text = `${name} ${String(err ?? "")}`;
    return /abort|cancel/i.test(text) ? "cancel" : "error";
}

export function workflowErrorDetail(err: unknown): string | undefined {
    const name =
        err && typeof err === "object" && "name" in err
            ? String((err as { name?: unknown }).name ?? "")
            : "";
    return sanitizeField(name || "invoke_error");
}

export async function recordWorkflowEvent(event: WorkflowEventInput): Promise<void> {
    const payload = {
        step: event.step,
        route: sanitizeField(event.route),
        action: sanitizeField(event.action),
        detail: sanitizeField(event.detail),
        context: sanitizeField(event.context),
    };

    try {
        await invoke("log_workflow_event", { event: payload });
    } catch {
        // Workflow logging is best-effort and must never break UX flows.
    }
}
