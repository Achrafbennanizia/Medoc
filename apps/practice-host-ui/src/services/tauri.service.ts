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

const WORKFLOW_EVENT_COMMAND = "record_workflow_event";
const MAX_ARG_KEYS = 16;
const UUID_SEGMENT_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LONG_HEX_RE = /^[0-9a-f]{16,}$/i;
const NUMERIC_ID_RE = /^\d{4,}$/;

type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

type WorkflowEventPayload = {
    step: WorkflowStep;
    workflow: string;
    route?: string;
    action?: string;
    outcome?: string;
    detail?: string;
    durationMs?: number;
    argKeys?: string[];
};

function isTauriRuntime(): boolean {
    if (typeof window === "undefined") return false;
    const w = window as Window & { __TAURI_INTERNALS__?: unknown };
    return typeof w.__TAURI_INTERNALS__ !== "undefined";
}

function normalizeRouteSegment(segment: string): string {
    if (!segment) return segment;
    if (UUID_SEGMENT_RE.test(segment) || LONG_HEX_RE.test(segment) || NUMERIC_ID_RE.test(segment)) {
        return ":id";
    }
    if (segment.length > 48) {
        return ":segment";
    }
    return segment;
}

function sanitizeRoute(pathname: string): string {
    const trimmed = pathname.trim();
    if (!trimmed) return "/";
    const noQuery = trimmed.split("?")[0]?.split("#")[0] ?? "/";
    const segments = noQuery
        .split("/")
        .filter((s) => s.length > 0)
        .map(normalizeRouteSegment);
    return segments.length > 0 ? `/${segments.join("/")}` : "/";
}

function currentRoute(): string {
    if (typeof window === "undefined") return "/";
    return sanitizeRoute(window.location.pathname || "/");
}

function sanitizeAction(action: string): string {
    const safe = action
        .trim()
        .replace(/[^a-zA-Z0-9_.:-]/g, "")
        .slice(0, 80);
    return safe.length > 0 ? safe : "unknown";
}

function errorDetail(error: unknown): string {
    if (error instanceof DOMException && error.name) return error.name.slice(0, 80);
    if (error instanceof Error && error.name) return error.name.slice(0, 80);
    return "Error";
}

async function emitWorkflowEvent(event: WorkflowEventPayload): Promise<void> {
    if (!isTauriRuntime()) return;
    try {
        await invoke<void>(WORKFLOW_EVENT_COMMAND, { event });
    } catch {
        // Never block user flows if workflow telemetry is unavailable.
    }
}

export function recordWorkflowRouteEnter(route?: string): void {
    const normalizedRoute = sanitizeRoute(route ?? currentRoute());
    void emitWorkflowEvent({
        step: "route_enter",
        workflow: "ui.navigation",
        route: normalizedRoute,
        outcome: "enter",
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_EVENT_COMMAND) {
        const passthrough = args == null ? {} : expandDualCaseInvokeArgs(omitUndefinedValues(args));
        return invoke<T>(cmd, passthrough);
    }

    const route = currentRoute();
    const action = sanitizeAction(cmd);
    const startedAt = Date.now();

    if (args == null) {
        void emitWorkflowEvent({
            step: "primary_action",
            workflow: "tauri.invoke",
            route,
            action,
        });
        try {
            const out = await invoke<T>(cmd, {});
            void emitWorkflowEvent({
                step: "success",
                workflow: "tauri.invoke",
                route,
                action,
                outcome: "ok",
                durationMs: Date.now() - startedAt,
            });
            return out;
        } catch (error) {
            const canceled = error instanceof DOMException && error.name === "AbortError";
            void emitWorkflowEvent({
                step: canceled ? "cancel" : "error",
                workflow: "tauri.invoke",
                route,
                action,
                outcome: canceled ? "aborted" : "failed",
                detail: errorDetail(error),
                durationMs: Date.now() - startedAt,
            });
            throw error;
        }
    }
    const cleaned = omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    const argKeys = Object.keys(cleaned).slice(0, MAX_ARG_KEYS).map(sanitizeAction);
    void emitWorkflowEvent({
        step: "primary_action",
        workflow: "tauri.invoke",
        route,
        action,
        argKeys,
    });
    try {
        const out = await invoke<T>(cmd, expanded);
        void emitWorkflowEvent({
            step: "success",
            workflow: "tauri.invoke",
            route,
            action,
            outcome: "ok",
            durationMs: Date.now() - startedAt,
            argKeys,
        });
        return out;
    } catch (error) {
        const canceled = error instanceof DOMException && error.name === "AbortError";
        void emitWorkflowEvent({
            step: canceled ? "cancel" : "error",
            workflow: "tauri.invoke",
            route,
            action,
            outcome: canceled ? "aborted" : "failed",
            detail: errorDetail(error),
            durationMs: Date.now() - startedAt,
            argKeys,
        });
        throw error;
    }
}
