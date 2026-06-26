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
let workflowBridgeAvailable = true;

export type WorkflowStage = "route_enter" | "primary_action" | "success" | "cancel" | "error";

type WorkflowEventPayload = {
    stage: WorkflowStage;
    action: string;
    route?: string;
    status?: string;
    correlationId?: string;
    message?: string;
    meta?: Record<string, unknown>;
};

function currentRoutePath(): string | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    return window.location?.pathname ?? undefined;
}

function nextCorrelationId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function errorToMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

function normalizedWorkflowPayload(event: WorkflowEventPayload): WorkflowEventPayload {
    return {
        stage: event.stage,
        action: event.action,
        route: event.route,
        status: event.status,
        correlationId: event.correlationId,
        message: event.message,
        meta: event.meta,
    };
}

async function emitWorkflowEvent(event: WorkflowEventPayload): Promise<void> {
    if (!workflowBridgeAvailable || event.action === WORKFLOW_LOG_COMMAND) {
        return;
    }
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { event: normalizedWorkflowPayload(event) });
    } catch {
        // If the bridge command is unavailable we silently disable it for this
        // renderer session to avoid flooding invoke failures.
        workflowBridgeAvailable = false;
    }
}

async function invokeWithNormalizedArgs<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (args == null) {
        return invoke<T>(cmd, {});
    }
    const cleaned = omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    return invoke<T>(cmd, expanded);
}

export async function logWorkflowRouteEnter(pathname: string): Promise<void> {
    await emitWorkflowEvent({
        stage: "route_enter",
        action: "route_enter",
        route: pathname,
        status: "enter",
    });
}

export async function logWorkflowCancel(action: string, reason: string): Promise<void> {
    await emitWorkflowEvent({
        stage: "cancel",
        action,
        route: currentRoutePath(),
        status: "cancelled",
        message: reason,
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_LOG_COMMAND) {
        return invokeWithNormalizedArgs<T>(cmd, args);
    }

    const route = currentRoutePath();
    const correlationId = nextCorrelationId();
    await emitWorkflowEvent({
        stage: "primary_action",
        action: cmd,
        route,
        correlationId,
        status: "started",
    });

    try {
        const result = await invokeWithNormalizedArgs<T>(cmd, args);
        await emitWorkflowEvent({
            stage: "success",
            action: cmd,
            route,
            correlationId,
            status: "ok",
        });
        return result;
    } catch (error) {
        await emitWorkflowEvent({
            stage: "error",
            action: cmd,
            route,
            correlationId,
            status: "failed",
            message: errorToMessage(error),
        });
        throw error;
    }
}
