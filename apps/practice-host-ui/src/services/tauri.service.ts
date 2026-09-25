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

const WORKFLOW_LOG_COMMAND = "log_workflow_event";
const WORKFLOW_MAX_FIELD = 200;

type WorkflowEvent = {
    workflow: string;
    step: string;
    status?: string;
    route?: string;
    action?: string;
    message?: string;
};

function clampWorkflowField(raw: string): string {
    return raw.length > WORKFLOW_MAX_FIELD ? raw.slice(0, WORKFLOW_MAX_FIELD) : raw;
}

function normalizeRouteForWorkflow(pathname: string | undefined): string {
    if (!pathname) return "/";
    return pathname
        .replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":id")
        .replace(/\/\d{2,}(?=\/|$)/g, "/:id")
        .replace(/\/[a-z0-9_-]{20,}(?=\/|$)/gi, "/:id");
}

function currentWorkflowRoute(): string {
    if (typeof window === "undefined") return "/";
    return normalizeRouteForWorkflow(window.location.pathname);
}

function workflowErrorMessage(error: unknown): string {
    if (error instanceof Error) return clampWorkflowField(error.message);
    if (typeof error === "string") return clampWorkflowField(error);
    try {
        return clampWorkflowField(JSON.stringify(error));
    } catch {
        return "unknown_error";
    }
}

async function emitWorkflowEvent(event: WorkflowEvent): Promise<void> {
    try {
        await invoke(WORKFLOW_LOG_COMMAND, {
            event: {
                workflow: clampWorkflowField(event.workflow),
                step: clampWorkflowField(event.step),
                status: event.status ? clampWorkflowField(event.status) : undefined,
                route: event.route ? clampWorkflowField(event.route) : undefined,
                action: event.action ? clampWorkflowField(event.action) : undefined,
                message: event.message ? clampWorkflowField(event.message) : undefined,
            },
        });
    } catch {
        // Workflow logging is best-effort and must never block the primary action.
    }
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const cleaned = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    if (cmd === WORKFLOW_LOG_COMMAND) {
        return invoke<T>(cmd, expanded);
    }

    const route = currentWorkflowRoute();
    void emitWorkflowEvent({
        workflow: "ipc",
        step: "primary_action",
        status: "start",
        route,
        action: cmd,
    });

    try {
        const result = await invoke<T>(cmd, expanded);
        void emitWorkflowEvent({
            workflow: "ipc",
            step: "primary_action",
            status: "success",
            route,
            action: cmd,
        });
        return result;
    } catch (error) {
        void emitWorkflowEvent({
            workflow: "ipc",
            step: "primary_action",
            status: "error",
            route,
            action: cmd,
            message: workflowErrorMessage(error),
        });
        throw error;
    }
}
