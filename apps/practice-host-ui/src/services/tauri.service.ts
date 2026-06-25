import { invoke } from "@tauri-apps/api/core";
import { publishWorkflowStep } from "@/lib/workflow-log-events";

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

const WORKFLOW_LOG_COMMAND = "workflow_log_step";

function summarizeArgKeys(args: Record<string, unknown>): string {
    const keys = Object.keys(args).sort();
    return keys.length ? keys.join(",") : "none";
}

function errorDetail(err: unknown): string {
    const text = err instanceof Error ? err.message : String(err);
    return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (args == null) {
        const payload = {};
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            publishWorkflowStep({
                workflow: "ipc",
                step: cmd,
                action: cmd,
                status: "primary_action",
                detail: "args=none",
            });
        }
        try {
            const result = await invoke<T>(cmd, payload);
            if (cmd !== WORKFLOW_LOG_COMMAND) {
                publishWorkflowStep({
                    workflow: "ipc",
                    step: cmd,
                    action: cmd,
                    status: "success",
                    detail: "args=none",
                });
            }
            return result;
        } catch (err) {
            if (cmd !== WORKFLOW_LOG_COMMAND) {
                publishWorkflowStep({
                    workflow: "ipc",
                    step: cmd,
                    action: cmd,
                    status: "error",
                    detail: errorDetail(err),
                });
            }
            throw err;
        }
    }
    const cleaned = omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    if (cmd !== WORKFLOW_LOG_COMMAND) {
        publishWorkflowStep({
            workflow: "ipc",
            step: cmd,
            action: cmd,
            status: "primary_action",
            detail: `args=${summarizeArgKeys(expanded)}`,
        });
    }
    try {
        const result = await invoke<T>(cmd, expanded);
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            publishWorkflowStep({
                workflow: "ipc",
                step: cmd,
                action: cmd,
                status: "success",
                detail: `args=${summarizeArgKeys(expanded)}`,
            });
        }
        return result;
    } catch (err) {
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            publishWorkflowStep({
                workflow: "ipc",
                step: cmd,
                action: cmd,
                status: "error",
                detail: errorDetail(err),
            });
        }
        throw err;
    }
}
