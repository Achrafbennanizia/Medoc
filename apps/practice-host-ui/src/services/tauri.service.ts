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

const WORKFLOW_LOG_COMMAND = "log_workflow_step";

type WorkflowStep = "primary_action" | "success" | "error";

type WorkflowLogPayload = {
    workflow: string;
    route: string;
    step: WorkflowStep;
    action?: string;
    outcome?: string;
    detail?: string;
};

function currentRoute(): string {
    if (typeof window === "undefined") return "unknown";
    const path = window.location.pathname || "/";
    const query = window.location.search || "";
    return `${path}${query}`;
}

function workflowErrorDetail(err: unknown): string {
    if (err instanceof Error && err.name) {
        return `error:${err.name}`;
    }
    if (typeof err === "string" && err.trim().length > 0) {
        return "error:string";
    }
    return "error:unknown";
}

function emitWorkflowStep(payload: WorkflowLogPayload): void {
    void invoke(WORKFLOW_LOG_COMMAND, { entry: payload }).catch(() => {
        // Logging channel is best-effort; never block the user flow.
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const expanded =
        args == null ? {} : expandDualCaseInvokeArgs(omitUndefinedValues(args));

    if (cmd !== WORKFLOW_LOG_COMMAND) {
        emitWorkflowStep({
            workflow: "tauri_invoke",
            route: currentRoute(),
            step: "primary_action",
            action: cmd,
            outcome: "start",
        });
    }

    try {
        const result = await invoke<T>(cmd, expanded);
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            emitWorkflowStep({
                workflow: "tauri_invoke",
                route: currentRoute(),
                step: "success",
                action: cmd,
                outcome: "ok",
            });
        }
        return result;
    } catch (error) {
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            emitWorkflowStep({
                workflow: "tauri_invoke",
                route: currentRoute(),
                step: "error",
                action: cmd,
                outcome: "failed",
                detail: workflowErrorDetail(error),
            });
        }
        throw error;
    }
}
