import { invoke } from "@tauri-apps/api/core";
import {
    emitWorkflowEvent,
    WORKFLOW_LOG_COMMAND,
} from "./workflow-log.service";

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

function summarizeArgKeys(args: Record<string, unknown>): string | undefined {
    const keys = Object.keys(args);
    if (keys.length === 0) return undefined;
    const listed = keys.slice(0, 12).join(",");
    if (keys.length <= 12) return listed;
    return `${listed},…(+${keys.length - 12})`;
}

function nowMs(): number {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const rawArgs = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(rawArgs);

    if (cmd !== WORKFLOW_LOG_COMMAND) {
        void emitWorkflowEvent({
            phase: "command",
            step: "invoke",
            outcome: "start",
            command: cmd,
            detail: summarizeArgKeys(expanded),
            source: "tauri.service",
        });
    }

    const startedAt = nowMs();
    try {
        const result = await invoke<T>(cmd, expanded);
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            void emitWorkflowEvent({
                phase: "command",
                step: "invoke",
                outcome: "success",
                command: cmd,
                durationMs: nowMs() - startedAt,
                source: "tauri.service",
            });
        }
        return result;
    } catch (error) {
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            const detail = error instanceof Error ? error.name : "InvokeError";
            void emitWorkflowEvent({
                phase: "command",
                step: "invoke",
                outcome: "error",
                command: cmd,
                detail,
                durationMs: nowMs() - startedAt,
                source: "tauri.service",
            });
        }
        throw error;
    }
}
