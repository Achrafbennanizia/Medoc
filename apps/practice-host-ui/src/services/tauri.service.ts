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

type WorkflowLogPayload = {
    step: "route_enter" | "primary_action";
    route?: string;
    action?: string;
    outcome?: "enter" | "success" | "cancel" | "error";
    command?: string;
    durationMs?: number;
    detail?: string;
};

type WorkflowActionOutcome = "success" | "cancel" | "error";

function normalizeWorkflowRoute(pathname: string): string {
    let route = pathname.split("?")[0] ?? "/";
    if (!route.startsWith("/")) {
        route = `/${route}`;
    }
    route = route.replace(/^\/patients\/[^/]+\/prescription\/new$/u, "/patients/:id/prescription/new");
    route = route.replace(
        /^\/patients\/[^/]+\/prescription\/(?!new$)[^/]+$/u,
        "/patients/:id/prescription/:prescriptionId",
    );
    route = route.replace(/^\/patients\/[^/]+$/u, "/patients/:id");
    route = route.replace(/^\/tickets\/[^/]+\/(edit|bearbeiten)$/u, "/tickets/:id/$1");
    route = route.replace(/^\/purchase-orders\/[^/]+$/u, "/purchase-orders/:id");
    route = route.replace(/^\/administration\/templates\/editor\/[^/]+$/u, "/administration/templates/editor/:id");
    return route;
}

function classifyInvokeError(error: unknown): string {
    if (error instanceof Error && error.name.trim().length > 0) {
        return error.name;
    }
    return typeof error;
}

async function emitWorkflowEvent(payload: WorkflowLogPayload): Promise<void> {
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { payload });
    } catch {
        // Logging must never block product workflows.
    }
}

function currentWorkflowRoute(): string | undefined {
    if (typeof window === "undefined") {
        return undefined;
    }
    return normalizeWorkflowRoute(window.location.pathname);
}

export async function logWorkflowRouteEnter(pathname: string): Promise<void> {
    await emitWorkflowEvent({
        step: "route_enter",
        route: normalizeWorkflowRoute(pathname),
        action: "navigation",
        outcome: "enter",
    });
}

export async function logWorkflowUiEvent(
    action: string,
    outcome: WorkflowActionOutcome,
    detail?: string,
): Promise<void> {
    await emitWorkflowEvent({
        step: "primary_action",
        action,
        outcome,
        route: currentWorkflowRoute(),
        detail,
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const payload = args == null ? {} : expandDualCaseInvokeArgs(omitUndefinedValues(args));
    if (cmd === WORKFLOW_LOG_COMMAND) {
        return invoke<T>(cmd, payload);
    }
    const startedAt = Date.now();
    try {
        const result = await invoke<T>(cmd, payload);
        await emitWorkflowEvent({
            step: "primary_action",
            command: cmd,
            outcome: "success",
            durationMs: Date.now() - startedAt,
        });
        return result;
    } catch (error) {
        await emitWorkflowEvent({
            step: "primary_action",
            command: cmd,
            outcome: "error",
            durationMs: Date.now() - startedAt,
            detail: classifyInvokeError(error),
        });
        throw error;
    }
}

export { normalizeWorkflowRoute };
