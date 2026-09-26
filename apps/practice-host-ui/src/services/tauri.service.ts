import { invoke } from "@tauri-apps/api/core";
import {
    emitWorkflowEventBestEffort,
    normalizeWorkflowRoute,
    WORKFLOW_EVENT_COMMAND,
} from "./workflow-event.service";

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

function classifyInvokeError(err: unknown): string {
    if (err instanceof Error && err.name.trim().length > 0) {
        return err.name.trim();
    }
    if (typeof err === "string") {
        return "string_error";
    }
    if (typeof err === "number") {
        return "number_error";
    }
    if (typeof err === "boolean") {
        return "boolean_error";
    }
    return "unknown_error";
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const payload = args == null
        ? {}
        : expandDualCaseInvokeArgs(omitUndefinedValues(args));
    const trackWorkflow = cmd !== WORKFLOW_EVENT_COMMAND;
    const startedAt = Date.now();
    const route =
        typeof window !== "undefined"
            ? normalizeWorkflowRoute(window.location.pathname || "/")
            : "/";

    if (trackWorkflow) {
        emitWorkflowEventBestEffort({
            stage: "primary_action",
            workflow: `ipc:${cmd}`,
            route,
            source: "frontend-ipc",
            action: cmd,
        });
    }

    try {
        const result = await invoke<T>(cmd, payload);
        if (trackWorkflow) {
            emitWorkflowEventBestEffort({
                stage: "success",
                workflow: `ipc:${cmd}`,
                route,
                source: "frontend-ipc",
                action: cmd,
                durationMs: Date.now() - startedAt,
            });
        }
        return result;
    } catch (error) {
        if (trackWorkflow) {
            emitWorkflowEventBestEffort({
                stage: "error",
                workflow: `ipc:${cmd}`,
                route,
                source: "frontend-ipc",
                action: cmd,
                errorKind: classifyInvokeError(error),
                durationMs: Date.now() - startedAt,
            });
        }
        throw error;
    }
}
