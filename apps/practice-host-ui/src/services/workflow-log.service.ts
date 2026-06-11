import { invoke } from "@tauri-apps/api/core";

export const WORKFLOW_LOG_COMMAND = "record_workflow_event";

export type WorkflowPhase = "route" | "command" | "ui";
export type WorkflowOutcome = "start" | "success" | "error" | "cancel";

export interface WorkflowEventPayload {
    phase: WorkflowPhase;
    step: string;
    outcome: WorkflowOutcome;
    route?: string;
    action?: string;
    command?: string;
    detail?: string;
    source?: string;
    durationMs?: number;
}

const UUID_SEGMENT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGIT_HEAVY_SEGMENT_RE = /^(?=.*\d)[a-z0-9_-]{6,}$/i;
const NUMERIC_SEGMENT_RE = /^\d{4,}$/;
const MAX_FIELD_LEN = 512;

function sanitizeText(raw: string | undefined, maxLen: number): string | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, maxLen);
}

export function normalizeWorkflowRoute(pathname: string): string {
    const cleaned = pathname.trim();
    if (!cleaned) return "/";
    const safe = cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
    const redacted = safe
        .split("/")
        .map((segment) => {
            if (!segment) return segment;
            if (
                UUID_SEGMENT_RE.test(segment) ||
                DIGIT_HEAVY_SEGMENT_RE.test(segment) ||
                NUMERIC_SEGMENT_RE.test(segment)
            ) {
                return ":id";
            }
            return segment;
        })
        .join("/");
    return redacted || "/";
}

export async function emitWorkflowEvent(event: WorkflowEventPayload): Promise<void> {
    const payload = {
        phase: event.phase,
        step: sanitizeText(event.step, 64) ?? "unknown",
        outcome: event.outcome,
        route: sanitizeText(event.route, 256),
        action: sanitizeText(event.action, 128),
        command: sanitizeText(event.command, 96),
        detail: sanitizeText(event.detail, MAX_FIELD_LEN),
        source: sanitizeText(event.source, 64) ?? "frontend",
        durationMs:
            Number.isFinite(event.durationMs) && (event.durationMs ?? 0) >= 0
                ? Math.round(event.durationMs ?? 0)
                : undefined,
    };
    try {
        await invoke(WORKFLOW_LOG_COMMAND, { event: payload });
    } catch {
        // Workflow telemetry must never break UX flows.
    }
}
