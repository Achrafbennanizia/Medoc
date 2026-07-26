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

export type WorkflowStage = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export type WorkflowLogEvent = {
    workflow: string;
    stage: WorkflowStage;
    step?: string;
    route?: string;
    action?: string;
    status?: string;
    error?: string;
    metadata?: Record<string, unknown>;
};

const WORKFLOW_LOG_COMMAND = "log_workflow_event";
const SECRET_RE = /(password|passwort|token|secret|api[_-]?key|license|lizenz)\s*[:=]\s*[^\s,;]+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

function sanitizeWorkflowString(value: string): string {
    return value.replace(SECRET_RE, "$1=***").replace(JWT_RE, "eyJ***");
}

function sanitizeWorkflowValue(value: unknown): unknown {
    if (typeof value === "string") {
        return sanitizeWorkflowString(value);
    }
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeWorkflowValue(entry));
    }
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeWorkflowValue(v)]),
        );
    }
    return value;
}

function sanitizeWorkflowEvent(event: WorkflowLogEvent): WorkflowLogEvent {
    return {
        workflow: sanitizeWorkflowString(event.workflow),
        stage: event.stage,
        step: event.step ? sanitizeWorkflowString(event.step) : undefined,
        route: event.route ? sanitizeWorkflowString(event.route) : undefined,
        action: event.action ? sanitizeWorkflowString(event.action) : undefined,
        status: event.status ? sanitizeWorkflowString(event.status) : undefined,
        error: event.error ? sanitizeWorkflowString(event.error) : undefined,
        metadata: event.metadata
            ? (sanitizeWorkflowValue(event.metadata) as Record<string, unknown>)
            : undefined,
    };
}

function currentRoute(): string | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    return `${window.location.pathname}${window.location.search}`;
}

function classifyFailureStage(error: unknown): WorkflowStage {
    const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error);
    return /abort|cancel/i.test(msg) ? "cancel" : "error";
}

export async function logWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    const sanitized = sanitizeWorkflowEvent(event);
    await invoke(WORKFLOW_LOG_COMMAND, { event: sanitized });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_LOG_COMMAND) {
        const cleaned = omitUndefinedValues(args ?? {});
        const expanded = expandDualCaseInvokeArgs(cleaned);
        return invoke<T>(cmd, expanded);
    }

    const cleaned = omitUndefinedValues(args ?? {});
    const expanded = expandDualCaseInvokeArgs(cleaned);
    const startedAt = Date.now();

    void logWorkflowEvent({
        workflow: "ui_tauri_invoke",
        stage: "primary_action",
        step: cmd,
        route: currentRoute(),
        action: cmd,
        status: "started",
        metadata: {
            argKeys: Object.keys(cleaned),
        },
    }).catch(() => {
        /* best-effort telemetry only */
    });

    try {
        const result = await invoke<T>(cmd, expanded);
        void logWorkflowEvent({
            workflow: "ui_tauri_invoke",
            stage: "success",
            step: cmd,
            route: currentRoute(),
            action: cmd,
            status: "ok",
            metadata: {
                durationMs: Date.now() - startedAt,
            },
        }).catch(() => {
            /* best-effort telemetry only */
        });
        return result;
    } catch (error) {
        const stage = classifyFailureStage(error);
        void logWorkflowEvent({
            workflow: "ui_tauri_invoke",
            stage,
            step: cmd,
            route: currentRoute(),
            action: cmd,
            status: stage === "cancel" ? "cancelled" : "failed",
            error: stage === "error" ? "invoke_failed" : "invoke_cancelled",
            metadata: {
                durationMs: Date.now() - startedAt,
            },
        }).catch(() => {
            /* best-effort telemetry only */
        });
        throw error;
    }
}
