import { invoke } from "@tauri-apps/api/core";

/**
 * Tauri v2 resolves each command parameter from the invoke JSON using an explicit key.
 * `tauri_macros` defaults to **camelCase** keys derived from Rust identifiers (`patient_id` → `patientId`).
 * Many controllers still send **snake_case** keys; that yields `{}` lookups / missing-key errors.
 *
 * We mirror snake_case ↔ camelCase **at the top level only** so either spelling reaches Rust.
 * Also strips `undefined` so serialization cannot drop required keys silently.
 */

type WorkflowStage = "route_enter" | "primary_action" | "success" | "cancel" | "error";

type WorkflowEventPayload = {
    workflow: string;
    step: string;
    stage: WorkflowStage;
    route?: string;
    action?: string;
    status?: string;
    details?: string;
    durationMs?: number;
    tsMs?: number;
};

const WORKFLOW_EVENT_NAME = "medoc:workflow-step";
const WORKFLOW_LOG_COMMAND = "log_workflow_event";
const WORKFLOW_FALLBACK = "unknown";
const MAX_FIELD_LEN = 160;
const MAX_DETAILS_LEN = 1024;

let workflowBridgeBound = false;

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

function isTauriRuntime(): boolean {
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function trimValue(value: string | undefined, limit: number): string | undefined {
    if (value == null) return undefined;
    const next = value.trim();
    if (!next) return undefined;
    return [...next].slice(0, limit).join("");
}

function normalizeWorkflowEvent(event: WorkflowEventPayload): WorkflowEventPayload {
    return {
        workflow: trimValue(event.workflow, MAX_FIELD_LEN) ?? WORKFLOW_FALLBACK,
        step: trimValue(event.step, MAX_FIELD_LEN) ?? WORKFLOW_FALLBACK,
        stage: event.stage,
        route: trimValue(event.route, MAX_FIELD_LEN),
        action: trimValue(event.action, MAX_FIELD_LEN),
        status: trimValue(event.status, MAX_FIELD_LEN),
        details: trimValue(event.details, MAX_DETAILS_LEN),
        durationMs: event.durationMs,
        tsMs: event.tsMs ?? Date.now(),
    };
}

async function sendWorkflowEvent(event: WorkflowEventPayload): Promise<void> {
    if (!isTauriRuntime()) return;
    const payload = normalizeWorkflowEvent(event);
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { event: payload });
    } catch {
        // Best-effort telemetry must never break product workflows.
    }
}

function currentRoutePath(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return window.location?.pathname;
}

function workflowErrorStatus(error: unknown): string {
    if (error instanceof Error && error.name.trim()) {
        return error.name.trim();
    }
    return "invoke_error";
}

function bindWorkflowBridgeOnce(): void {
    if (workflowBridgeBound || typeof window === "undefined") return;
    workflowBridgeBound = true;
    window.addEventListener(WORKFLOW_EVENT_NAME, (raw) => {
        const detail = (raw as CustomEvent<WorkflowEventPayload | undefined>).detail;
        if (!detail || typeof detail !== "object") return;
        void sendWorkflowEvent(detail);
    });
}

bindWorkflowBridgeOnce();

export function logWorkflowRouteEnter(route: string): void {
    void sendWorkflowEvent({
        workflow: "navigation",
        step: "route-enter",
        stage: "route_enter",
        route,
        action: "enter",
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const startedAt = Date.now();
    const route = currentRoutePath();
    const logLifecycle = cmd !== WORKFLOW_LOG_COMMAND;
    if (logLifecycle) {
        void sendWorkflowEvent({
            workflow: "ipc",
            step: cmd,
            stage: "primary_action",
            route,
            action: cmd,
            status: "started",
        });
    }

    let expanded: Record<string, unknown>;
    if (args == null) {
        expanded = {};
    } else {
        const cleaned = omitUndefinedValues(args);
        expanded = expandDualCaseInvokeArgs(cleaned);
    }

    try {
        const result = await invoke<T>(cmd, expanded);
        if (logLifecycle) {
            void sendWorkflowEvent({
                workflow: "ipc",
                step: cmd,
                stage: "success",
                route,
                action: cmd,
                status: "ok",
                durationMs: Date.now() - startedAt,
            });
        }
        return result;
    } catch (error) {
        if (logLifecycle) {
            void sendWorkflowEvent({
                workflow: "ipc",
                step: cmd,
                stage: "error",
                route,
                action: cmd,
                status: workflowErrorStatus(error),
                durationMs: Date.now() - startedAt,
            });
        }
        throw error;
    }
}
