import { invoke } from "@tauri-apps/api/core";
import {
    classifyWorkflowFailurePhase,
    currentWorkflowRoute,
    formatWorkflowFailure,
    logWorkflowEventFireAndForget,
} from "../lib/workflow-logger";

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

const WORKFLOW_COMMAND = "log_workflow_event";

function summarizeArgKeys(args: Record<string, unknown>): string {
    const keys = Object.keys(args);
    if (keys.length === 0) return "args:none";
    const shown = keys.slice(0, 8).join(",");
    const suffix = keys.length > 8 ? ",…" : "";
    return `args:${shown}${suffix}`;
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const cleaned = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    const route = currentWorkflowRoute();
    if (cmd !== WORKFLOW_COMMAND) {
        logWorkflowEventFireAndForget({
            phase: "primary_action",
            route,
            action: cmd,
            detail: summarizeArgKeys(expanded),
        });
    }
    try {
        const out = await invoke<T>(cmd, expanded);
        if (cmd !== WORKFLOW_COMMAND) {
            logWorkflowEventFireAndForget({
                phase: "success",
                route,
                action: cmd,
                status: "ok",
            });
        }
        return out;
    } catch (error) {
        if (cmd !== WORKFLOW_COMMAND) {
            const phase = classifyWorkflowFailurePhase(error);
            logWorkflowEventFireAndForget({
                phase,
                route,
                action: cmd,
                status: phase === "cancel" ? "canceled" : "failed",
                detail: formatWorkflowFailure(error),
            });
        }
        throw error;
    }
}
