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

const WORKFLOW_EVENT_COMMAND = "record_workflow_event";

type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

type WorkflowEvent = {
    step: WorkflowStep;
    route?: string;
    action?: string;
    message?: string;
    metadata?: Record<string, unknown>;
};

function trimForWorkflow(value: string | undefined, max: number): string | undefined {
    if (value == null) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, max);
}

function currentRouteForWorkflow(): string | undefined {
    if (typeof window === "undefined" || !window.location) {
        return undefined;
    }
    const route = `${window.location.pathname}${window.location.search}`;
    return trimForWorkflow(route, 256);
}

function asWorkflowMessage(error: unknown): string | undefined {
    if (error instanceof Error) {
        return trimForWorkflow(error.message, 512);
    }
    if (typeof error === "string") {
        return trimForWorkflow(error, 512);
    }
    try {
        return trimForWorkflow(JSON.stringify(error), 512);
    } catch {
        return "unknown-error";
    }
}

function normalizeWorkflowEvent(event: WorkflowEvent): WorkflowEvent {
    return {
        step: event.step,
        route: trimForWorkflow(event.route ?? currentRouteForWorkflow(), 256),
        action: trimForWorkflow(event.action, 128),
        message: trimForWorkflow(event.message, 512),
        metadata: event.metadata,
    };
}

async function emitWorkflowEvent(event: WorkflowEvent): Promise<void> {
    const normalized = normalizeWorkflowEvent(event);
    try {
        await invoke(WORKFLOW_EVENT_COMMAND, { event: normalized });
    } catch {
        // Workflow logging must never break user-facing flows.
    }
}

export function logWorkflowRouteEnter(route: string): void {
    void emitWorkflowEvent({ step: "route_enter", route, action: "route.enter" });
}

export function logWorkflowCancel(action: string, message?: string): void {
    void emitWorkflowEvent({ step: "cancel", action, message });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const cleaned = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    const shouldTrack = cmd !== WORKFLOW_EVENT_COMMAND;
    if (shouldTrack) {
        void emitWorkflowEvent({
            step: "primary_action",
            action: cmd,
            metadata: { argKeys: Object.keys(expanded).sort() },
        });
    }
    const startedAt = Date.now();
    try {
        const result = await invoke<T>(cmd, expanded);
        if (shouldTrack) {
            void emitWorkflowEvent({
                step: "success",
                action: cmd,
                metadata: { elapsedMs: Date.now() - startedAt },
            });
        }
        return result;
    } catch (error) {
        if (shouldTrack) {
            void emitWorkflowEvent({
                step: "error",
                action: cmd,
                message: asWorkflowMessage(error),
                metadata: { elapsedMs: Date.now() - startedAt },
            });
        }
        throw error;
    }
}
