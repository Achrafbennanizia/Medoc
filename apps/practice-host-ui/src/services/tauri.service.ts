import { invoke } from "@tauri-apps/api/core";
import {
    emitWorkflowEvent,
    extractWorkflowErrorMessage,
    isCancellationError,
    WORKFLOW_LOG_COMMAND,
} from "./workflow-logging.service";

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
    const invokeArgs =
        args == null ? {} : expandDualCaseInvokeArgs(omitUndefinedValues(args));
    const trackWorkflow = cmd !== WORKFLOW_LOG_COMMAND;

    if (trackWorkflow) {
        void emitWorkflowEvent({
            workflow: "tauri-ipc",
            step: "primary_action",
            action: cmd,
            command: cmd,
        });
    }

    try {
        const result = await invoke<T>(cmd, invokeArgs);
        if (trackWorkflow) {
            void emitWorkflowEvent({
                workflow: "tauri-ipc",
                step: "success",
                action: cmd,
                command: cmd,
            });
        }
        return result;
    } catch (error) {
        if (trackWorkflow) {
            const detail = extractWorkflowErrorMessage(error);
            void emitWorkflowEvent({
                workflow: "tauri-ipc",
                step: isCancellationError(detail) ? "cancel" : "error",
                action: cmd,
                command: cmd,
                detail,
            });
        }
        throw error;
    }
}
