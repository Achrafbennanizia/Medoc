import { invoke } from "@tauri-apps/api/core";
import {
    WORKFLOW_EVENT_NAME,
    createWorkflowCorrelationId,
    type WorkflowEvent,
} from "@/lib/workflow-events";

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
let workflowBridgeInstalled = false;

function hasTauriRuntime(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    return "__TAURI_INTERNALS__" in (window as unknown as Record<string, unknown>);
}

function classifyInvokeError(error: unknown): string {
    if (error instanceof Error && error.name.trim().length > 0) {
        return error.name.trim();
    }
    if (typeof error === "string" && error.trim().length > 0) {
        return "StringError";
    }
    return "UnknownError";
}

async function forwardWorkflowEvent(event: WorkflowEvent): Promise<void> {
    if (!hasTauriRuntime()) {
        return;
    }
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { event });
    } catch {
        // Workflow logging must never block real user actions.
    }
}

function normaliseInvokeArgs(args?: Record<string, unknown>): Record<string, unknown> {
    if (args == null) {
        return {};
    }
    const cleaned = omitUndefinedValues(args);
    return expandDualCaseInvokeArgs(cleaned);
}

export function installWorkflowLogBridge(): void {
    if (workflowBridgeInstalled) {
        return;
    }
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
        return;
    }
    workflowBridgeInstalled = true;
    window.addEventListener(WORKFLOW_EVENT_NAME, (rawEvent) => {
        const custom = rawEvent as CustomEvent<WorkflowEvent | undefined>;
        if (!custom.detail) {
            return;
        }
        void forwardWorkflowEvent(custom.detail);
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const invokeArgs = normaliseInvokeArgs(args);
    if (cmd === WORKFLOW_LOG_COMMAND) {
        return invoke<T>(cmd, invokeArgs);
    }
    const correlationId = createWorkflowCorrelationId();
    await forwardWorkflowEvent({
        workflow: "ipc",
        step: "primary_action",
        action: cmd,
        correlationId,
    });
    try {
        const result = await invoke<T>(cmd, invokeArgs);
        await forwardWorkflowEvent({
            workflow: "ipc",
            step: "success",
            action: cmd,
            correlationId,
            outcome: "ok",
        });
        return result;
    } catch (error) {
        await forwardWorkflowEvent({
            workflow: "ipc",
            step: "error",
            action: cmd,
            correlationId,
            errorKind: classifyInvokeError(error),
        });
        throw error;
    }
}
