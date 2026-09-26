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

export type WorkflowStage = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export interface WorkflowEvent {
    stage: WorkflowStage;
    step: string;
    route?: string;
    action?: string;
    message?: string;
    metadata?: Record<string, unknown>;
}

const WORKFLOW_EVENT_COMMAND = "log_workflow_event";

declare global {
    // Test harnesses can toggle this switch explicitly to validate telemetry behavior.
    // `undefined` falls back to "enabled in app runtime, disabled in Vitest".
    // eslint-disable-next-line no-var
    var __MEDOC_WORKFLOW_TELEMETRY__: boolean | undefined;
}

function workflowTelemetryEnabled(): boolean {
    if (typeof globalThis.__MEDOC_WORKFLOW_TELEMETRY__ === "boolean") {
        return globalThis.__MEDOC_WORKFLOW_TELEMETRY__;
    }
    const vitestEnv =
        typeof process !== "undefined" &&
        typeof process.env === "object" &&
        process.env != null &&
        process.env.VITEST === "true";
    return !vitestEnv;
}

function workflowErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
        return JSON.stringify(error);
    } catch {
        return "Unknown error";
    }
}

async function postWorkflowEvent(event: WorkflowEvent): Promise<void> {
    if (!workflowTelemetryEnabled()) return;
    try {
        await invoke<void>(WORKFLOW_EVENT_COMMAND, { event });
    } catch {
        // Workflow telemetry must never block functional UX actions.
    }
}

export function logWorkflowRouteEnter(route: string): void {
    void postWorkflowEvent({
        stage: "route_enter",
        step: "route_enter",
        route,
    });
}

export function logWorkflowCancel(step: string, route?: string): void {
    void postWorkflowEvent({
        stage: "cancel",
        step,
        route,
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_EVENT_COMMAND) {
        return invoke<T>(cmd, args ?? {});
    }

    if (args == null) {
        void postWorkflowEvent({
            stage: "primary_action",
            step: cmd,
            action: cmd,
        });
        try {
            const result = await invoke<T>(cmd, {});
            void postWorkflowEvent({
                stage: "success",
                step: cmd,
                action: cmd,
            });
            return result;
        } catch (error) {
            void postWorkflowEvent({
                stage: "error",
                step: cmd,
                action: cmd,
                message: workflowErrorMessage(error),
            });
            throw error;
        }
    }
    const cleaned = omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    void postWorkflowEvent({
        stage: "primary_action",
        step: cmd,
        action: cmd,
    });
    try {
        const result = await invoke<T>(cmd, expanded);
        void postWorkflowEvent({
            stage: "success",
            step: cmd,
            action: cmd,
        });
        return result;
    } catch (error) {
        void postWorkflowEvent({
            stage: "error",
            step: cmd,
            action: cmd,
            message: workflowErrorMessage(error),
        });
        throw error;
    }
}
