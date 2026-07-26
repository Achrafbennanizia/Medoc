import { invoke } from "@tauri-apps/api/core";

/**
 * Tauri v2 resolves each command parameter from the invoke JSON using an explicit key.
 * `tauri_macros` defaults to **camelCase** keys derived from Rust identifiers (`patient_id` → `patientId`).
 * Many controllers still send **snake_case** keys; that yields `{}` lookups / missing-key errors.
 *
 * We mirror snake_case ↔ camelCase **at the top level only** so either spelling reaches Rust.
 * Also strips `undefined` so serialization cannot drop required keys silently.
 */

const WORKFLOW_LOG_EVENT_COMMAND = "log_workflow_event";
const WORKFLOW_ROUTE_ID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORKFLOW_HEXISH_ID_RE = /^[a-z0-9_-]{12,}$/i;
const WORKFLOW_CANCEL_RE = /(cancelled|canceled|abort|aborted|dismissed|closed by user)/i;
const WORKFLOW_DETAIL_MAX = 240;

export type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export type WorkflowEvent = {
    step: WorkflowStep;
    route: string;
    action?: string;
    command?: string;
    detail?: string;
};

type WorkflowFlagGlobal = { __MEDOC_TEST_ENABLE_WORKFLOW_LOGGING__?: boolean };

function omitUndefinedValues(record: Record<string, unknown>): Record<string, unknown> {
    const o: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(record)) {
        if (v !== undefined) {
            o[k] = v;
        }
    }
    return o;
}

/** `patient_id` → `patientId` (matches `heck::ToLowerCamelCase` / Tauri command IPC keys). */
function snakeToLowerCamel(ident: string): string {
    return ident.replace(/_+([a-zA-Z])/g, (_, ch: string) => ch.toUpperCase());
}

/** `patientId` → `patient_id` */
function camelToSnake(ident: string): string {
    return ident.replace(/([a-z\d])([A-Z])/g, "$1_$2").toLowerCase();
}

function expandDualCaseInvokeArgs(args: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...args };
    for (const [k, v] of Object.entries(args)) {
        if (v === undefined) {
            continue;
        }
        if (k.includes("_")) {
            const camel = snakeToLowerCamel(k);
            if (!(camel in out)) {
                out[camel] = v;
            }
        } else if (/[a-z]/.test(k) && /[A-Z]/.test(k)) {
            const snake = camelToSnake(k);
            if (!(snake in out)) {
                out[snake] = v;
            }
        }
    }
    return out;
}

function isWorkflowLoggingEnabled(): boolean {
    if (import.meta.env.MODE === "test") {
        return (globalThis as WorkflowFlagGlobal).__MEDOC_TEST_ENABLE_WORKFLOW_LOGGING__ === true;
    }
    return true;
}

function summarizeInvokeArgs(args: Record<string, unknown>): string | undefined {
    const keys = Object.keys(args).sort();
    if (keys.length === 0) {
        return undefined;
    }
    return `arg_keys=${keys.join(",")}`;
}

function summarizeInvokeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message || error.name || "invoke_failed";
    }
    if (typeof error === "string") {
        return error;
    }
    if (error == null) {
        return "invoke_failed";
    }
    return String(error);
}

function sanitizeWorkflowText(raw?: string): string | undefined {
    if (!raw) {
        return undefined;
    }
    const compact = raw.replace(/\s+/g, " ").trim();
    if (!compact) {
        return undefined;
    }
    if (compact.length <= WORKFLOW_DETAIL_MAX) {
        return compact;
    }
    return `${compact.slice(0, WORKFLOW_DETAIL_MAX)}...`;
}

function sanitizeWorkflowSegment(segment: string): string {
    if (!segment) {
        return segment;
    }
    if (/^\d+$/.test(segment)) {
        return ":id";
    }
    if (WORKFLOW_ROUTE_ID_RE.test(segment)) {
        return ":id";
    }
    if (segment.length >= 12 && /[0-9]/.test(segment) && WORKFLOW_HEXISH_ID_RE.test(segment)) {
        return ":id";
    }
    return segment;
}

export function normalizeWorkflowPath(pathname: string): string {
    if (!pathname || pathname === "/") {
        return "/";
    }
    const parts = pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => sanitizeWorkflowSegment(segment));
    return parts.length > 0 ? `/${parts.join("/")}` : "/";
}

export function classifyWorkflowFailure(error: unknown): "cancel" | "error" {
    if (error && typeof error === "object") {
        const name = "name" in error ? String((error as { name?: unknown }).name ?? "") : "";
        if (name.toLowerCase() === "aborterror") {
            return "cancel";
        }
    }
    return WORKFLOW_CANCEL_RE.test(summarizeInvokeError(error)) ? "cancel" : "error";
}

function currentWorkflowPath(): string {
    if (typeof window === "undefined") {
        return "/";
    }
    return normalizeWorkflowPath(window.location.pathname || "/");
}

function sanitizeWorkflowEvent(event: WorkflowEvent): WorkflowEvent {
    return {
        step: event.step,
        route: normalizeWorkflowPath(event.route),
        action: sanitizeWorkflowText(event.action),
        command: sanitizeWorkflowText(event.command),
        detail: sanitizeWorkflowText(event.detail),
    };
}

async function dispatchWorkflowEvent(event: WorkflowEvent): Promise<void> {
    if (!isWorkflowLoggingEnabled()) {
        return;
    }
    const payload = sanitizeWorkflowEvent(event);
    try {
        await invoke<void>(WORKFLOW_LOG_EVENT_COMMAND, { event: payload });
    } catch {
        // Never block user workflows on telemetry.
    }
}

export async function emitWorkflowEvent(event: WorkflowEvent): Promise<void> {
    await dispatchWorkflowEvent(event);
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const cleaned = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);

    // Raw bridge command: bypass lifecycle logging to avoid recursive invoke loops.
    if (cmd === WORKFLOW_LOG_EVENT_COMMAND) {
        return invoke<T>(cmd, expanded);
    }

    const route = currentWorkflowPath();
    await dispatchWorkflowEvent({
        step: "primary_action",
        route,
        action: "invoke",
        command: cmd,
        detail: summarizeInvokeArgs(cleaned),
    });
    try {
        const result = await invoke<T>(cmd, expanded);
        await dispatchWorkflowEvent({
            step: "success",
            route,
            action: "invoke",
            command: cmd,
        });
        return result;
    } catch (error) {
        await dispatchWorkflowEvent({
            step: classifyWorkflowFailure(error),
            route,
            action: "invoke",
            command: cmd,
            detail: summarizeInvokeError(error),
        });
        throw error;
    }
}
