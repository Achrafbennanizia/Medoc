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

const WORKFLOW_LOG_COMMAND = "workflow_log_event";
const WORKFLOW_GLOBAL_OVERRIDE = "__MEDOC_WORKFLOW_LOGGING__";

export type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export interface WorkflowLogEvent {
    workflow: string;
    step: WorkflowStep;
    route?: string;
    action?: string;
    status?: string;
    message?: string;
    metadata?: Record<string, unknown>;
}

function workflowLoggingEnabled(): boolean {
    const globalObj = globalThis as Record<string, unknown>;
    const forced = globalObj[WORKFLOW_GLOBAL_OVERRIDE];
    if (typeof forced === "boolean") {
        return forced;
    }
    return import.meta.env.MODE !== "test";
}

function sanitizeWorkflowText(value: string | undefined): string | undefined {
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.slice(0, 512);
}

function sanitizeWorkflowMetadata(
    metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
    if (!metadata) {
        return undefined;
    }
    const compact = omitUndefinedValues(metadata);
    return Object.keys(compact).length === 0 ? undefined : compact;
}

function commandWorkflowName(cmd: string): string {
    return `tauri.${cmd.replace(/_/g, ".")}`;
}

function currentRoute(): string | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    const path = window.location?.pathname ?? "";
    return path.length > 0 ? path : undefined;
}

export async function logWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    if (!workflowLoggingEnabled()) {
        return;
    }
    const workflow = sanitizeWorkflowText(event.workflow);
    if (!workflow) {
        return;
    }
    const payload: WorkflowLogEvent = {
        workflow,
        step: event.step,
        route: sanitizeWorkflowText(event.route),
        action: sanitizeWorkflowText(event.action),
        status: sanitizeWorkflowText(event.status),
        message: sanitizeWorkflowText(event.message),
        metadata: sanitizeWorkflowMetadata(event.metadata),
    };
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { event: payload });
    } catch {
        // Best-effort telemetry; never block UX on workflow logging.
    }
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const cleaned = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    const emitWorkflow = cmd !== WORKFLOW_LOG_COMMAND;
    if (emitWorkflow) {
        void logWorkflowEvent({
            workflow: commandWorkflowName(cmd),
            step: "primary_action",
            route: currentRoute(),
            action: cmd,
            status: "started",
        });
    }
    try {
        const result = await invoke<T>(cmd, expanded);
        if (emitWorkflow) {
            void logWorkflowEvent({
                workflow: commandWorkflowName(cmd),
                step: "success",
                route: currentRoute(),
                action: cmd,
                status: "ok",
            });
        }
        return result;
    } catch (error) {
        if (emitWorkflow) {
            void logWorkflowEvent({
                workflow: commandWorkflowName(cmd),
                step: "error",
                route: currentRoute(),
                action: cmd,
                status: "failed",
                message: error instanceof Error ? error.message : String(error),
            });
        }
        throw error;
    }
}
