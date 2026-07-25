import { invoke } from "@tauri-apps/api/core";

/**
 * Tauri v2 resolves each command parameter from the invoke JSON using an explicit key.
 * `tauri_macros` defaults to **camelCase** keys derived from Rust identifiers (`patient_id` → `patientId`).
 * Many controllers still send **snake_case** keys; that yields `{}` lookups / missing-key errors.
 *
 * We mirror snake_case ↔ camelCase **at the top level only** so either spelling reaches Rust.
 * Also strips `undefined` so serialization cannot drop required keys silently.
 */

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

const WORKFLOW_LOG_COMMAND = "log_workflow_event";
const UUID_SEGMENT_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DIGITS_SEGMENT_RE = /^\d+$/;
const LONG_TOKEN_SEGMENT_RE = /^[a-zA-Z0-9_-]{14,}$/;

type WorkflowOutcome = "start" | "success" | "cancel" | "error" | "event";

interface WorkflowLogEventPayload {
    workflow: string;
    step: string;
    route?: string;
    action?: string;
    command?: string;
    outcome?: WorkflowOutcome;
    detail?: string;
    error?: string;
    durationMs?: number;
    argKeys?: string[];
}

function workflowLoggingEnabled(): boolean {
    return import.meta.env.MODE !== "test";
}

function sanitizeWorkflowText(value: string, maxChars: number): string {
    return value.trim().replace(/\s+/g, " ").slice(0, maxChars);
}

function sanitizeWorkflowArgKeys(keys?: string[]): string[] {
    if (!keys || keys.length === 0) {
        return [];
    }
    return keys
        .map((key) => key.trim())
        .filter(Boolean)
        .map((key) => key.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64))
        .filter(Boolean)
        .slice(0, 24);
}

function normalizeRouteSegment(segment: string): string {
    if (!segment) {
        return segment;
    }
    if (UUID_SEGMENT_RE.test(segment)) {
        return ":uuid";
    }
    if (DIGITS_SEGMENT_RE.test(segment)) {
        return ":num";
    }
    if (LONG_TOKEN_SEGMENT_RE.test(segment)) {
        return ":id";
    }
    return segment;
}

export function normalizeWorkflowRoute(pathname: string): string {
    if (!pathname || pathname === "/") {
        return "/";
    }
    const segments = pathname
        .split("/")
        .filter(Boolean)
        .map(normalizeRouteSegment);
    return `/${segments.join("/")}`;
}

async function emitWorkflowEvent(event: WorkflowLogEventPayload): Promise<void> {
    if (!workflowLoggingEnabled()) {
        return;
    }
    const payload = {
        workflow: sanitizeWorkflowText(event.workflow, 128),
        step: sanitizeWorkflowText(event.step, 128),
        route: event.route ? sanitizeWorkflowText(event.route, 128) : undefined,
        action: event.action ? sanitizeWorkflowText(event.action, 128) : undefined,
        command: event.command ? sanitizeWorkflowText(event.command, 128) : undefined,
        outcome: event.outcome ?? "event",
        detail: event.detail ? sanitizeWorkflowText(event.detail, 512) : undefined,
        error: event.error ? sanitizeWorkflowText(event.error, 512) : undefined,
        durationMs:
            typeof event.durationMs === "number" && Number.isFinite(event.durationMs)
                ? Math.max(0, Math.round(event.durationMs))
                : undefined,
        argKeys: sanitizeWorkflowArgKeys(event.argKeys),
    };
    try {
        await invoke(WORKFLOW_LOG_COMMAND, { event: payload });
    } catch {
        // Workflow logging is best-effort and must never block user actions.
    }
}

export function logRouteEnter(pathname: string): void {
    void emitWorkflowEvent({
        workflow: "navigation",
        step: "route_enter",
        route: normalizeWorkflowRoute(pathname),
        outcome: "event",
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_LOG_COMMAND) {
        if (args == null) {
            return invoke<T>(cmd, {});
        }
        const cleaned = omitUndefinedValues(args);
        const expanded = expandDualCaseInvokeArgs(cleaned);
        return invoke<T>(cmd, expanded);
    }
    const startedAt = Date.now();
    const argKeys = args ? Object.keys(args) : [];
    void emitWorkflowEvent({
        workflow: "ipc",
        step: "primary_action",
        action: "invoke",
        command: cmd,
        outcome: "start",
        argKeys,
    });
    if (args == null) {
        try {
            const result = await invoke<T>(cmd, {});
            void emitWorkflowEvent({
                workflow: "ipc",
                step: "success",
                action: "invoke",
                command: cmd,
                outcome: "success",
                durationMs: Date.now() - startedAt,
                argKeys,
            });
            return result;
        } catch (error) {
            void emitWorkflowEvent({
                workflow: "ipc",
                step: "error",
                action: "invoke",
                command: cmd,
                outcome: "error",
                durationMs: Date.now() - startedAt,
                argKeys,
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    }
    const cleaned = omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    try {
        const result = await invoke<T>(cmd, expanded);
        void emitWorkflowEvent({
            workflow: "ipc",
            step: "success",
            action: "invoke",
            command: cmd,
            outcome: "success",
            durationMs: Date.now() - startedAt,
            argKeys,
        });
        return result;
    } catch (error) {
        void emitWorkflowEvent({
            workflow: "ipc",
            step: "error",
            action: "invoke",
            command: cmd,
            outcome: "error",
            durationMs: Date.now() - startedAt,
            argKeys,
            error: error instanceof Error ? error.message : String(error),
        });
        throw error;
    }
}
