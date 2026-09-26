import { invoke } from "@tauri-apps/api/core";

type WorkflowStage =
    | "route_enter"
    | "primary_action"
    | "success"
    | "cancel"
    | "error";

type WorkflowPayload = {
    route: string;
    action: string;
    stage: WorkflowStage;
    detail?: string;
    correlationId?: string;
};

const WORKFLOW_LOG_COMMAND = "log_workflow_event";
const CANCELLED_ERROR_RE = /(cancel(l(ed|ation)?)?|aborted|dismiss(ed)?)/i;

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

function looksDynamicSegment(segment: string): boolean {
    const isNumericId = /^\d{3,}$/.test(segment);
    if (isNumericId) {
        return true;
    }
    return /^[a-f\d-]{8,}$/i.test(segment);
}

function normalizeWorkflowRoute(route: string): string {
    const pathOnly = route.split("?")[0] ?? "/";
    const clean = pathOnly.trim().replace(/^\/+/, "");
    if (!clean) {
        return "/";
    }
    const parts = clean
        .split("/")
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => (looksDynamicSegment(segment) ? ":id" : segment.slice(0, 24)));
    return parts.length > 0 ? `/${parts.join("/")}` : "/";
}

function currentPathname(): string {
    if (typeof window === "undefined" || !window.location?.pathname) {
        return "/";
    }
    return window.location.pathname;
}

function newCorrelationId(): string {
    const uuid = globalThis.crypto?.randomUUID?.();
    return uuid ?? `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function emitWorkflow(payload: WorkflowPayload): Promise<void> {
    const action = payload.action.trim().slice(0, 64) || "unknown_action";
    const route = normalizeWorkflowRoute(payload.route);
    const detail = payload.detail?.trim().slice(0, 160) || undefined;
    const correlationId = payload.correlationId?.trim().slice(0, 64) || undefined;
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, {
            route,
            action,
            stage: payload.stage,
            detail,
            correlationId,
        });
    } catch {
        // Best-effort telemetry must not break user actions.
    }
}

export async function logWorkflowRouteEnter(route: string = currentPathname()): Promise<void> {
    await emitWorkflow({
        route,
        action: "route_navigation",
        stage: "route_enter",
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_LOG_COMMAND) {
        return invoke<T>(cmd, args == null ? {} : omitUndefinedValues(args));
    }

    const route = currentPathname();
    const correlationId = newCorrelationId();
    await emitWorkflow({
        route,
        action: cmd,
        stage: "primary_action",
        correlationId,
    });

    try {
        const invokeArgs = args == null
            ? {}
            : expandDualCaseInvokeArgs(omitUndefinedValues(args));
        const result = await invoke<T>(cmd, invokeArgs);
        await emitWorkflow({
            route,
            action: cmd,
            stage: "success",
            correlationId,
        });
        return result;
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const cancelled = CANCELLED_ERROR_RE.test(msg);
        await emitWorkflow({
            route,
            action: cmd,
            stage: cancelled ? "cancel" : "error",
            detail: cancelled ? "operation_cancelled" : "invoke_failed",
            correlationId,
        });
        throw error;
    }
}
