import { invoke } from "@tauri-apps/api/core";
import { logWorkflowStep } from "./workflow-logger.service";

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

const WORKFLOW_LOG_COMMAND = "log_workflow_step";
let invokeCorrelationSeq = 0;

function nextInvokeCorrelationId(command: string): string {
    invokeCorrelationSeq = (invokeCorrelationSeq + 1) % Number.MAX_SAFE_INTEGER;
    return `${command}-${Date.now().toString(36)}-${invokeCorrelationSeq.toString(36)}`;
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const cleaned = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    const shouldLogLifecycle = cmd !== WORKFLOW_LOG_COMMAND;
    const correlationId = shouldLogLifecycle ? nextInvokeCorrelationId(cmd) : undefined;

    if (shouldLogLifecycle) {
        logWorkflowStep({
            flow: "ipc.command",
            step: "primary_action",
            action: cmd,
            outcome: "invoke",
            correlationId,
        });
    }

    try {
        const out = await invoke<T>(cmd, expanded);
        if (shouldLogLifecycle) {
            logWorkflowStep({
                flow: "ipc.command",
                step: "success",
                action: cmd,
                outcome: "ok",
                correlationId,
            });
        }
        return out;
    } catch (error) {
        if (shouldLogLifecycle) {
            logWorkflowStep({
                flow: "ipc.command",
                step: "error",
                action: cmd,
                outcome: "error",
                correlationId,
                detail: error instanceof Error ? error.name : "invoke_error",
            });
        }
        throw error;
    }
}
