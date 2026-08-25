import { invoke } from "@tauri-apps/api/core";
import {
    emitWorkflowEventFireAndForget,
    WORKFLOW_LOG_COMMAND,
    workflowErrorDetail,
} from "@/services/workflow-logger.service";

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

function summarizeArgKeys(args: Record<string, unknown>): string {
    return Object.keys(args).sort().slice(0, 24).join(",");
}

function isCancelLikeError(error: unknown): boolean {
    const text = workflowErrorDetail(error).toLowerCase();
    return text.includes("cancel") || text.includes("aborted") || text.includes("abgebrochen");
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const startedAt = performance.now();
    const isWorkflowCommand = cmd === WORKFLOW_LOG_COMMAND;
    const cleaned = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);

    if (!isWorkflowCommand) {
        emitWorkflowEventFireAndForget({
            step: "primary_action",
            action: cmd,
            outcome: "invoke_start",
            metadata: {
                argCount: String(Object.keys(cleaned).length),
                argKeys: summarizeArgKeys(cleaned),
            },
        });
    }

    try {
        const result = await invoke<T>(cmd, expanded);
        if (!isWorkflowCommand) {
            emitWorkflowEventFireAndForget({
                step: "success",
                action: cmd,
                outcome: "invoke_ok",
                metadata: {
                    durationMs: Math.round(performance.now() - startedAt).toString(),
                },
            });
        }
        return result;
    } catch (error) {
        if (!isWorkflowCommand) {
            emitWorkflowEventFireAndForget({
                step: isCancelLikeError(error) ? "cancel" : "error",
                action: cmd,
                outcome: "invoke_failed",
                detail: workflowErrorDetail(error),
                metadata: {
                    durationMs: Math.round(performance.now() - startedAt).toString(),
                },
            });
        }
        throw error;
    }
}
