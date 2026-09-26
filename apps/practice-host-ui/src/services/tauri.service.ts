import { invoke } from "@tauri-apps/api/core";

const WORKFLOW_LOG_COMMAND = "log_workflow_event";

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

function monotonicNowMs(): number {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}

function normalizeErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return String(err);
}

async function emitWorkflowBridgeEvent(payload: {
    workflow: string;
    step: "primary_action" | "success" | "cancel" | "error";
    outcome: "started" | "success" | "cancel" | "error";
    command: string;
    details?: Record<string, unknown>;
    error?: string;
}): Promise<void> {
    try {
        await invoke(WORKFLOW_LOG_COMMAND, { event: payload });
    } catch {
        // Best effort only: never fail core IPC because telemetry failed.
    }
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const expanded = args == null ? {} : expandDualCaseInvokeArgs(omitUndefinedValues(args));
    if (cmd === WORKFLOW_LOG_COMMAND) {
        return invoke<T>(cmd, expanded);
    }

    const startedAt = monotonicNowMs();
    void emitWorkflowBridgeEvent({
        workflow: "frontend.tauri.invoke",
        step: "primary_action",
        outcome: "started",
        command: cmd,
    });
    try {
        const result = await invoke<T>(cmd, expanded);
        void emitWorkflowBridgeEvent({
            workflow: "frontend.tauri.invoke",
            step: "success",
            outcome: "success",
            command: cmd,
            details: { durationMs: Math.max(0, Math.round(monotonicNowMs() - startedAt)) },
        });
        return result;
    } catch (err) {
        const message = normalizeErrorMessage(err);
        const cancelled =
            message.toLowerCase().includes("cancel") || message.toLowerCase().includes("abort");
        void emitWorkflowBridgeEvent({
            workflow: "frontend.tauri.invoke",
            step: cancelled ? "cancel" : "error",
            outcome: cancelled ? "cancel" : "error",
            command: cmd,
            error: message,
            details: { durationMs: Math.max(0, Math.round(monotonicNowMs() - startedAt)) },
        });
        throw err;
    }
}
