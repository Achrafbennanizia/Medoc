import { invoke } from "@tauri-apps/api/core";

type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";
type WorkflowLogEvent = {
    workflow?: string;
    step: WorkflowStep;
    route?: string;
    action?: string;
    status?: string;
    message?: string;
    error?: string;
};

const WORKFLOW_LOG_COMMAND = "log_workflow_event";

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

function currentRoutePath(): string {
    if (typeof window === "undefined") {
        return "";
    }
    return `${window.location.pathname}${window.location.search}`;
}

function normalizeError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

async function emitWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { event });
    } catch {
        // Telemetry must never block user workflows.
    }
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_LOG_COMMAND) {
        const cleaned = omitUndefinedValues(args ?? {});
        const expanded = expandDualCaseInvokeArgs(cleaned);
        return invoke<T>(cmd, expanded);
    }
    void emitWorkflowEvent({
        workflow: "tauri_invoke",
        step: "primary_action",
        route: currentRoutePath(),
        action: cmd,
    });
    if (args == null) {
        try {
            const result = await invoke<T>(cmd, {});
            void emitWorkflowEvent({
                workflow: "tauri_invoke",
                step: "success",
                route: currentRoutePath(),
                action: cmd,
            });
            return result;
        } catch (error) {
            void emitWorkflowEvent({
                workflow: "tauri_invoke",
                step: "error",
                route: currentRoutePath(),
                action: cmd,
                error: normalizeError(error),
            });
            throw error;
        }
    }
    const cleaned = omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    try {
        const result = await invoke<T>(cmd, expanded);
        void emitWorkflowEvent({
            workflow: "tauri_invoke",
            step: "success",
            route: currentRoutePath(),
            action: cmd,
        });
        return result;
    } catch (error) {
        void emitWorkflowEvent({
            workflow: "tauri_invoke",
            step: "error",
            route: currentRoutePath(),
            action: cmd,
            error: normalizeError(error),
        });
        throw error;
    }
}
