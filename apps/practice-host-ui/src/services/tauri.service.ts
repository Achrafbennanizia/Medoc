import { invoke } from "@tauri-apps/api/core";

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

const WORKFLOW_LOG_COMMAND = "log_workflow_event";

export type WorkflowStage = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export interface WorkflowLogEventInput {
    stage: WorkflowStage;
    route?: string;
    action?: string;
    outcome?: string;
    details?: string;
    command?: string;
    duration_ms?: number;
}

function workflowLoggingAvailable(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    const marker = (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
    return marker != null;
}

function currentRoutePath(): string | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    return window.location?.pathname || undefined;
}

function toWorkflowError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === "string") {
        return err;
    }
    const raw = JSON.stringify(err);
    return raw ?? String(err);
}

async function emitWorkflowEvent(input: WorkflowLogEventInput): Promise<void> {
    if (!workflowLoggingAvailable()) {
        return;
    }
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { input });
    } catch {
        // Workflow telemetry must never block functional app IPC.
    }
}

export async function logWorkflowRouteEnter(route: string): Promise<void> {
    await emitWorkflowEvent({
        stage: "route_enter",
        route,
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_LOG_COMMAND) {
        return invoke<T>(cmd, args ?? {});
    }

    const normalizedArgs =
        args == null ? {} : expandDualCaseInvokeArgs(omitUndefinedValues(args));
    const startedAt = Date.now();
    await emitWorkflowEvent({
        stage: "primary_action",
        route: currentRoutePath(),
        action: "ipc_invoke",
        command: cmd,
    });
    try {
        const result = await invoke<T>(cmd, normalizedArgs);
        await emitWorkflowEvent({
            stage: "success",
            route: currentRoutePath(),
            action: "ipc_invoke",
            command: cmd,
            duration_ms: Date.now() - startedAt,
        });
        return result;
    } catch (err) {
        await emitWorkflowEvent({
            stage: "error",
            route: currentRoutePath(),
            action: "ipc_invoke",
            command: cmd,
            outcome: toWorkflowError(err),
            duration_ms: Date.now() - startedAt,
        });
        throw err;
    }
}
