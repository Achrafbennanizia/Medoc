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

const WORKFLOW_EVENT_COMMAND = "log_workflow_event";

export type WorkflowLogEvent = {
    workflow: string;
    step: string;
    status?: string;
    route?: string;
    action?: string;
    source?: string;
    message?: string;
    error?: string;
    metadata?: Record<string, unknown>;
};

function normalizeMetadata(
    metadata?: Record<string, unknown>,
): Record<string, unknown> {
    if (!metadata) return {};
    return omitUndefinedValues(metadata);
}

function errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}

function isCancellationMessage(message: string): boolean {
    return /\b(cancel|cancelled|aborted|abort)\b/i.test(message);
}

function hasTauriInvokeBridge(): boolean {
    const runtime = globalThis as { __TAURI_INTERNALS__?: { invoke?: unknown } };
    return typeof runtime.__TAURI_INTERNALS__?.invoke === "function";
}

async function emitWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    if (!hasTauriInvokeBridge()) return;
    const payload = {
        workflow: event.workflow,
        step: event.step,
        status: event.status,
        route: event.route,
        action: event.action,
        source: event.source ?? "frontend-ui",
        message: event.message,
        error: event.error,
        metadata: normalizeMetadata(event.metadata),
    };
    try {
        await invoke<void>(WORKFLOW_EVENT_COMMAND, { event: payload });
    } catch (err) {
        if (import.meta.env.DEV) {
            console.warn("workflow logging bridge failed", err);
        }
    }
}

export async function reportWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    await emitWorkflowEvent(event);
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const cleaned = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);

    if (cmd !== WORKFLOW_EVENT_COMMAND) {
        void emitWorkflowEvent({
            workflow: "tauri-command",
            step: "primary_action",
            status: "start",
            action: cmd,
            source: "frontend-ipc",
            metadata: { argKeys: Object.keys(expanded).sort() },
        });
    }

    try {
        const result = await invoke<T>(cmd, expanded);
        if (cmd !== WORKFLOW_EVENT_COMMAND) {
            void emitWorkflowEvent({
                workflow: "tauri-command",
                step: "success",
                status: "success",
                action: cmd,
                source: "frontend-ipc",
            });
        }
        return result;
    } catch (err) {
        if (cmd !== WORKFLOW_EVENT_COMMAND) {
            const message = errorMessage(err);
            const cancelled = isCancellationMessage(message);
            void emitWorkflowEvent({
                workflow: "tauri-command",
                step: cancelled ? "cancel" : "error",
                status: cancelled ? "cancelled" : "error",
                action: cmd,
                source: "frontend-ipc",
                error: message,
            });
        }
        throw err;
    }
}
