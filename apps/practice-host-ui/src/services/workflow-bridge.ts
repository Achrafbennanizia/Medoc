import { invoke } from "@tauri-apps/api/core";

export type WorkflowPhase =
    | "route_enter"
    | "primary_action"
    | "success"
    | "cancel"
    | "error";

export interface WorkflowEvent {
    workflow: string;
    phase: WorkflowPhase;
    step: string;
    route?: string;
    outcome?: string;
    detail?: string;
    context?: Record<string, unknown> | null;
}

const WORKFLOW_COMMAND = "log_workflow_event";
const UUID_SEGMENT_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_TOKEN_RE = /^[A-Za-z0-9_-]{20,}$/;

function clipText(value: string, max: number): string {
    return value.length <= max ? value : `${value.slice(0, max)}…`;
}

function normalizeRouteSegment(segment: string): string {
    if (/^\d+$/.test(segment)) return ":id";
    if (UUID_SEGMENT_RE.test(segment)) return ":id";
    if (LONG_TOKEN_RE.test(segment)) return ":id";
    return segment;
}

export function normalizeWorkflowRoute(pathname: string): string {
    const trimmed = pathname.trim();
    if (!trimmed || trimmed === "/") return "/";
    const normalised = trimmed
        .split("/")
        .filter(Boolean)
        .map(normalizeRouteSegment)
        .join("/");
    return `/${normalised}`;
}

function sanitizeContext(
    context?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
    if (!context) return undefined;
    const out: Record<string, unknown> = {};
    for (const [k, value] of Object.entries(context)) {
        if (value === undefined) continue;
        if (typeof value === "string") {
            out[k] = clipText(value.trim(), 160);
            continue;
        }
        if (
            typeof value === "number" ||
            typeof value === "boolean" ||
            value === null
        ) {
            out[k] = value;
            continue;
        }
        out[k] = clipText(JSON.stringify(value), 160);
    }
    return Object.keys(out).length === 0 ? undefined : out;
}

export function isWorkflowLoggingCommand(command: string): boolean {
    return command === WORKFLOW_COMMAND;
}

export async function emitWorkflowEvent(event: WorkflowEvent): Promise<void> {
    const workflow = clipText(event.workflow.trim(), 80);
    const step = clipText(event.step.trim(), 120);
    if (!workflow || !step) return;

    const route = event.route ? normalizeWorkflowRoute(event.route) : undefined;
    const payload = {
        event: {
            workflow,
            phase: event.phase,
            step,
            route: route ? clipText(route, 160) : undefined,
            outcome: event.outcome ? clipText(event.outcome.trim(), 80) : undefined,
            detail: event.detail ? clipText(event.detail.trim(), 160) : undefined,
            context: sanitizeContext(event.context),
        },
    };

    try {
        await invoke(WORKFLOW_COMMAND, payload);
    } catch {
        // Best-effort only: browser test runs and LAN-only demos may not have this IPC command.
    }
}
