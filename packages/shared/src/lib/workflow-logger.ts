import { invoke } from "@tauri-apps/api/core";

export type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export interface WorkflowLogEvent {
    step: WorkflowStep;
    route?: string | null;
    action?: string | null;
    status?: string | null;
    message?: string | null;
    error?: string | null;
    durationMs?: number | null;
}

const WORKFLOW_LOG_COMMAND = "record_workflow_event";
const MAX_FIELD_LEN = 240;
const IS_TEST_ENV = typeof import.meta !== "undefined" && import.meta.env?.MODE === "test";

function normalizeText(value: string | null | undefined): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return undefined;
    return trimmed.length > MAX_FIELD_LEN ? `${trimmed.slice(0, MAX_FIELD_LEN)}…` : trimmed;
}

function looksLikeUuidSegment(segment: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segment);
}

function shouldMaskRouteSegment(segment: string): boolean {
    if (!segment) return false;
    if (/^\d+$/.test(segment)) return true;
    if (looksLikeUuidSegment(segment)) return true;
    return segment.length >= 8 && segment.includes("-") && /\d/.test(segment);
}

function normalizeRoute(route: string | null | undefined): string | undefined {
    const cleaned = normalizeText(route);
    if (!cleaned) return undefined;
    if (!cleaned.startsWith("/")) return cleaned;
    const parts = cleaned
        .split("/")
        .filter(Boolean)
        .map((segment) => (shouldMaskRouteSegment(segment) ? ":id" : segment));
    return parts.length === 0 ? "/" : `/${parts.join("/")}`;
}

export function workflowLogCommandName(): string {
    return WORKFLOW_LOG_COMMAND;
}

function toPayload(event: WorkflowLogEvent) {
    return {
        step: event.step,
        route: normalizeRoute(event.route),
        action: normalizeText(event.action),
        status: normalizeText(event.status),
        message: normalizeText(event.message),
        error: normalizeText(event.error),
        durationMs:
            typeof event.durationMs === "number" && Number.isFinite(event.durationMs) && event.durationMs >= 0
                ? Math.round(event.durationMs)
                : undefined,
    };
}

export async function emitWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    if (IS_TEST_ENV || typeof window === "undefined") return;
    try {
        await invoke(WORKFLOW_LOG_COMMAND, { event: toPayload(event) });
    } catch {
        // Workflow logging is best-effort and must never break user flows.
    }
}
