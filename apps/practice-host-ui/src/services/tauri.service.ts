import { invoke } from "@tauri-apps/api/core";
import { logWorkflowOutcome, logWorkflowPrimaryAction } from "@/services/workflow.service";

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

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd !== "workflow_log_event") {
        void logWorkflowPrimaryAction(cmd);
    }
    if (args == null) {
        try {
            const result = await invoke<T>(cmd, {});
            if (cmd !== "workflow_log_event") {
                void logWorkflowOutcome("success", cmd);
            }
            return result;
        } catch (error) {
            if (cmd !== "workflow_log_event") {
                const message = error instanceof Error ? error.message : String(error ?? "");
                const looksLikeCancel = /\bcancel(l(ed)?)?\b|\babort(ed)?\b/i.test(message);
                void logWorkflowOutcome(looksLikeCancel ? "cancel" : "error", cmd, message);
            }
            throw error;
        }
    }
    const cleaned = omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    try {
        const result = await invoke<T>(cmd, expanded);
        if (cmd !== "workflow_log_event") {
            void logWorkflowOutcome("success", cmd);
        }
        return result;
    } catch (error) {
        if (cmd !== "workflow_log_event") {
            const message = error instanceof Error ? error.message : String(error ?? "");
            const looksLikeCancel = /\bcancel(l(ed)?)?\b|\babort(ed)?\b/i.test(message);
            void logWorkflowOutcome(looksLikeCancel ? "cancel" : "error", cmd, message);
        }
        throw error;
    }
}
