import { invoke } from "@tauri-apps/api/core";
import { emitWorkflowError, emitWorkflowPrimaryAction, emitWorkflowSuccess } from "@/lib/workflow-logger";

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

const WORKFLOW_LOG_COMMAND = "record_workflow_event";

function nowMs(): number {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

function createCorrelationId(): string {
    if (typeof globalThis.crypto?.randomUUID === "function") {
        return globalThis.crypto.randomUUID();
    }
    return `wf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const cleaned = omitUndefinedValues(args ?? {});
    const expanded = expandDualCaseInvokeArgs(cleaned);
    if (cmd === WORKFLOW_LOG_COMMAND) {
        return invoke<T>(cmd, expanded);
    }
    const correlationId = createCorrelationId();
    const startedAt = nowMs();
    emitWorkflowPrimaryAction(cmd, correlationId);
    try {
        const result = await invoke<T>(cmd, expanded);
        emitWorkflowSuccess(cmd, correlationId, nowMs() - startedAt);
        return result;
    } catch (error) {
        emitWorkflowError(cmd, correlationId, nowMs() - startedAt);
        throw error;
    }
}
