import { invoke } from "@tauri-apps/api/core";

export const WORKFLOW_LOG_COMMAND = "log_workflow_event";

export type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export type WorkflowEventPayload = {
    step: WorkflowStep;
    route?: string;
    action?: string;
    outcome?: string;
    detail?: string;
    metadata?: Record<string, string>;
};

const TOKEN_RE = /(password|passwort|token|secret|api[_-]?key|license|lizenz)\s*[:=]\s*\S+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_ID_RE = /^[A-Za-z0-9_-]{16,}$/;
const MAX_FIELD_CHARS = 256;
const MAX_META_ENTRIES = 16;
const MAX_META_VALUE_CHARS = 256;

function clampChars(input: string, maxChars: number): string {
    return [...input].slice(0, maxChars).join("");
}

function sanitizeText(input: string, maxChars = MAX_FIELD_CHARS): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    const withoutSecrets = trimmed.replace(TOKEN_RE, "$1=***").replace(JWT_RE, "eyJ***");
    const withoutControl = withoutSecrets.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
    return clampChars(withoutControl, maxChars);
}

function sanitizeRouteSegment(segment: string): string {
    if (!segment) return segment;
    if (UUID_RE.test(segment) || OPAQUE_ID_RE.test(segment) || /^[0-9]{3,}$/.test(segment)) {
        return ":id";
    }
    return sanitizeText(segment, 64);
}

function sanitizeRoute(route: string): string {
    const base = route.split("?")[0] ?? route;
    const normalized = base
        .split("/")
        .map((segment) => sanitizeRouteSegment(segment))
        .join("/");
    return sanitizeText(normalized || "/", MAX_FIELD_CHARS);
}

function sanitizeMetadata(metadata?: Record<string, string>): Record<string, string> | undefined {
    if (!metadata) return undefined;
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (Object.keys(out).length >= MAX_META_ENTRIES) break;
        const cleanKey = key.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 48);
        const cleanValue = sanitizeText(value, MAX_META_VALUE_CHARS);
        if (!cleanKey || !cleanValue) continue;
        out[cleanKey] = cleanValue;
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

function currentRoutePath(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return window.location?.pathname || undefined;
}

function sanitizePayload(payload: WorkflowEventPayload): WorkflowEventPayload {
    return {
        step: payload.step,
        route: payload.route ? sanitizeRoute(payload.route) : sanitizeRoute(currentRoutePath() ?? "/"),
        action: payload.action ? sanitizeText(payload.action) : undefined,
        outcome: payload.outcome ? sanitizeText(payload.outcome) : undefined,
        detail: payload.detail ? sanitizeText(payload.detail) : undefined,
        metadata: sanitizeMetadata(payload.metadata),
    };
}

export function workflowErrorDetail(error: unknown): string {
    if (typeof error === "string") return sanitizeText(error);
    if (error instanceof Error) return sanitizeText(error.message);
    return sanitizeText(String(error));
}

export async function emitWorkflowEvent(payload: WorkflowEventPayload): Promise<void> {
    const input = sanitizePayload(payload);
    try {
        await invoke(WORKFLOW_LOG_COMMAND, { input });
    } catch {
        // Logging must never break workflow execution.
    }
}

export function emitWorkflowEventFireAndForget(payload: WorkflowEventPayload): void {
    void emitWorkflowEvent(payload);
}
