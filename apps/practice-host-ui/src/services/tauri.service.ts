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

const WORKFLOW_BRIDGE_COMMAND = "log_workflow_event";
let workflowBridgeInFlight = false;

export type WorkflowBridgeEvent = {
    workflow: string;
    step: string;
    route?: string;
    action?: string;
    status?: string;
    metadata?: Record<string, unknown>;
};

function currentRoutePath(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return window.location?.pathname ?? undefined;
}

function normalizeWorkflowEvent(event: WorkflowBridgeEvent): WorkflowBridgeEvent {
    return {
        workflow: event.workflow.trim(),
        step: event.step.trim(),
        route: event.route?.trim(),
        action: event.action?.trim(),
        status: event.status?.trim(),
        metadata: event.metadata ?? {},
    };
}

async function invokeWorkflowBridge(event: WorkflowBridgeEvent): Promise<void> {
    if (workflowBridgeInFlight) return;
    const payload = normalizeWorkflowEvent(event);
    if (!payload.workflow || !payload.step) return;
    workflowBridgeInFlight = true;
    try {
        await invoke<void>(WORKFLOW_BRIDGE_COMMAND, { event: payload });
    } catch {
        // Best-effort observability bridge: logging must never block user actions.
    } finally {
        workflowBridgeInFlight = false;
    }
}

export function logRouteEnter(route: string): void {
    void invokeWorkflowBridge({
        workflow: "route-navigation",
        step: "route_enter",
        route,
        status: "success",
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const startedAt = Date.now();
    if (args == null) {
        if (cmd !== WORKFLOW_BRIDGE_COMMAND) {
            void invokeWorkflowBridge({
                workflow: "frontend-ipc",
                step: "primary_action",
                route: currentRoutePath(),
                action: cmd,
                status: "start",
                metadata: { argKeys: [] },
            });
        }
        try {
            const result = await invoke<T>(cmd, {});
            if (cmd !== WORKFLOW_BRIDGE_COMMAND) {
                void invokeWorkflowBridge({
                    workflow: "frontend-ipc",
                    step: "success",
                    route: currentRoutePath(),
                    action: cmd,
                    status: "success",
                    metadata: { durationMs: Date.now() - startedAt },
                });
            }
            return result;
        } catch (error) {
            if (cmd !== WORKFLOW_BRIDGE_COMMAND) {
                void invokeWorkflowBridge({
                    workflow: "frontend-ipc",
                    step: "error",
                    route: currentRoutePath(),
                    action: cmd,
                    status: "error",
                    metadata: {
                        durationMs: Date.now() - startedAt,
                        error: error instanceof Error ? error.message : String(error),
                    },
                });
            }
            throw error;
        }
    }
    const cleaned = omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    if (cmd !== WORKFLOW_BRIDGE_COMMAND) {
        void invokeWorkflowBridge({
            workflow: "frontend-ipc",
            step: "primary_action",
            route: currentRoutePath(),
            action: cmd,
            status: "start",
            metadata: { argKeys: Object.keys(expanded) },
        });
    }
    try {
        const result = await invoke<T>(cmd, expanded);
        if (cmd !== WORKFLOW_BRIDGE_COMMAND) {
            void invokeWorkflowBridge({
                workflow: "frontend-ipc",
                step: "success",
                route: currentRoutePath(),
                action: cmd,
                status: "success",
                metadata: { durationMs: Date.now() - startedAt },
            });
        }
        return result;
    } catch (error) {
        if (cmd !== WORKFLOW_BRIDGE_COMMAND) {
            void invokeWorkflowBridge({
                workflow: "frontend-ipc",
                step: "error",
                route: currentRoutePath(),
                action: cmd,
                status: "error",
                metadata: {
                    durationMs: Date.now() - startedAt,
                    error: error instanceof Error ? error.message : String(error),
                },
            });
        }
        throw error;
    }
}
