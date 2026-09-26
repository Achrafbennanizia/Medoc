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
    for (const [k, version] of Object.entries(record)) {
        if (version !== undefined) {
            o[k] = version;
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
    for (const [k, version] of Object.entries(args)) {
        if (version === undefined) {
            continue;
        }
        if (k.includes("_")) {
            const camel = snakeToLowerCamel(k);
            if (!(camel in out)) {
                out[camel] = version;
            }
        } else if (/[a-z]/.test(k) && /[A-Z]/.test(k)) {
            const snake = camelToSnake(k);
            if (!(snake in out)) {
                out[snake] = version;
            }
        }
    }
    return out;
}

const WORKFLOW_BRIDGE_CMD = "log_workflow_event";

export type WorkflowPhase = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export type WorkflowEvent = {
    phase: WorkflowPhase;
    step: string;
    route?: string;
    command?: string;
    detail?: string;
};

function activeRoute(): string | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    return `${window.location.pathname}${window.location.search}`;
}

function errorDetail(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    try {
        return JSON.stringify(error);
    } catch {
        return "unknown error";
    }
}

function isCancelLikeError(raw: string): boolean {
    const lc = raw.toLowerCase();
    return lc.includes("abort") || lc.includes("cancel");
}

async function emitWorkflowEvent(event: WorkflowEvent): Promise<void> {
    const route = event.route ?? activeRoute();
    const detail = event.detail == null ? undefined : event.detail.slice(0, 240);
    try {
        await invoke<void>(WORKFLOW_BRIDGE_CMD, { event: { ...event, route, detail } });
    } catch {
        // Never let telemetry break primary UI flows.
    }
}

export async function logWorkflowEvent(event: WorkflowEvent): Promise<void> {
    await emitWorkflowEvent(event);
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_BRIDGE_CMD) {
        return invoke<T>(cmd, args ?? {});
    }

    if (args == null) {
        void emitWorkflowEvent({ phase: "primary_action", step: "tauri.invoke", command: cmd });
        try {
            const result = await invoke<T>(cmd, {});
            void emitWorkflowEvent({ phase: "success", step: "tauri.invoke", command: cmd });
            return result;
        } catch (error) {
            const detail = errorDetail(error);
            const phase: WorkflowPhase = isCancelLikeError(detail) ? "cancel" : "error";
            void emitWorkflowEvent({ phase, step: "tauri.invoke", command: cmd, detail });
            throw error;
        }
    }
    const cleaned = omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    void emitWorkflowEvent({ phase: "primary_action", step: "tauri.invoke", command: cmd });
    try {
        const result = await invoke<T>(cmd, expanded);
        void emitWorkflowEvent({ phase: "success", step: "tauri.invoke", command: cmd });
        return result;
    } catch (error) {
        const detail = errorDetail(error);
        const phase: WorkflowPhase = isCancelLikeError(detail) ? "cancel" : "error";
        void emitWorkflowEvent({ phase, step: "tauri.invoke", command: cmd, detail });
        throw error;
    }
}
