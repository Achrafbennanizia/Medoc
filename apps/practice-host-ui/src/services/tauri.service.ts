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

type WorkflowPhase = "route_enter" | "primary_action" | "success" | "cancel" | "error";

type WorkflowLogEvent = {
    workflow: string;
    step: string;
    phase: WorkflowPhase;
    status?: string;
    detail?: string;
    durationMs?: number;
};

const WORKFLOW_LOG_COMMAND = "log_workflow_event";

function tauriRuntimeActive(): boolean {
    const g = globalThis as typeof globalThis & { __MEDOC_FORCE_TAURI_RUNTIME__?: boolean };
    if (g.__MEDOC_FORCE_TAURI_RUNTIME__ === true) {
        return true;
    }
    if (typeof process !== "undefined" && process.env.VITEST) {
        return false;
    }
    return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function nowMs(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function durationMs(startedAt: number): number {
    const d = nowMs() - startedAt;
    if (!Number.isFinite(d) || d < 0) return 0;
    return Math.round(d);
}

function currentWorkflowLabel(): string {
    if (typeof window === "undefined") {
        return "route:/";
    }
    const p = window.location.pathname || "/";
    return `route:${p}`;
}

function looksLikeCancel(error: unknown): boolean {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    const text = raw.toLowerCase();
    return text.includes("cancel") || text.includes("aborted") || text.includes("dismiss");
}

async function emitWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    if (!tauriRuntimeActive()) {
        return;
    }
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { event });
    } catch {
        // Logging must never break user workflows.
    }
}

export function logUiRouteEnter(pathname: string): void {
    void emitWorkflowEvent({
        workflow: `route:${pathname || "/"}`,
        step: "route_enter",
        phase: "route_enter",
        status: "ok",
    });
}

export function logUiWorkflowCancel(step: string, detail = "escape"): void {
    void emitWorkflowEvent({
        workflow: currentWorkflowLabel(),
        step,
        phase: "cancel",
        status: "cancelled",
        detail,
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const startedAt = nowMs();
    if (cmd !== WORKFLOW_LOG_COMMAND) {
        void emitWorkflowEvent({
            workflow: currentWorkflowLabel(),
            step: cmd,
            phase: "primary_action",
            status: "started",
        });
    }
    try {
        const payload =
            args == null
                ? {}
                : expandDualCaseInvokeArgs(omitUndefinedValues(args));
        const result = await invoke<T>(cmd, payload);
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            void emitWorkflowEvent({
                workflow: currentWorkflowLabel(),
                step: cmd,
                phase: "success",
                status: "ok",
                durationMs: durationMs(startedAt),
            });
        }
        return result;
    } catch (error) {
        if (cmd !== WORKFLOW_LOG_COMMAND) {
            void emitWorkflowEvent({
                workflow: currentWorkflowLabel(),
                step: cmd,
                phase: looksLikeCancel(error) ? "cancel" : "error",
                status: looksLikeCancel(error) ? "cancelled" : "failed",
                detail: looksLikeCancel(error) ? "invoke_cancelled" : "invoke_failed",
                durationMs: durationMs(startedAt),
            });
        }
        throw error;
    }
}
