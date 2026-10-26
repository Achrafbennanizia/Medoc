import { invoke } from "@tauri-apps/api/core";

const WORKFLOW_LOG_COMMAND = "log_workflow_event";
const WORKFLOW_ACTION_TAURI_INVOKE = "tauri_invoke";

export type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export type WorkflowLogEvent = {
    step: WorkflowStep;
    route?: string;
    action?: string;
    command?: string;
    message?: string;
};

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

function currentRouteForWorkflow(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const path = window.location?.pathname ?? "";
    const query = window.location?.search ?? "";
    const route = `${path}${query}`;
    return route.length > 0 ? route : undefined;
}

function classifyFailureStep(error: unknown): WorkflowStep {
    const text = String(error ?? "").toLowerCase();
    if (text.includes("cancel") || text.includes("aborted") || text.includes("abort")) {
        return "cancel";
    }
    return "error";
}

async function emitWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { event });
    } catch {
        // Best-effort telemetry: the main command path must not fail if logging IPC is unavailable.
    }
}

function workflowBase(cmd: string): Omit<WorkflowLogEvent, "step"> {
    return {
        route: currentRouteForWorkflow(),
        action: WORKFLOW_ACTION_TAURI_INVOKE,
        command: cmd,
    };
}

export async function logWorkflowRouteEnter(route?: string): Promise<void> {
    await emitWorkflowEvent({
        step: "route_enter",
        route: route ?? currentRouteForWorkflow(),
        action: "route_change",
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const workflowEnabled = cmd !== WORKFLOW_LOG_COMMAND;
    const workflow = workflowBase(cmd);
    if (workflowEnabled) {
        await emitWorkflowEvent({ ...workflow, step: "primary_action" });
    }
    try {
        let result: T;
        if (args == null) {
            result = await invoke<T>(cmd, {});
        } else {
            const cleaned = omitUndefinedValues(args);
            const expanded = expandDualCaseInvokeArgs(cleaned);
            result = await invoke<T>(cmd, expanded);
        }
        if (workflowEnabled) {
            await emitWorkflowEvent({ ...workflow, step: "success" });
        }
        return result;
    } catch (error) {
        if (workflowEnabled) {
            await emitWorkflowEvent({
                ...workflow,
                step: classifyFailureStep(error),
            });
        }
        throw error;
    }
}
