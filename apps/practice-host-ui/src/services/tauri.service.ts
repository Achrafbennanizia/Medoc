import { invoke } from "@tauri-apps/api/core";

const WORKFLOW_LOG_COMMAND = "log_workflow_event";
const WORKFLOW_DETAIL_LIMIT = 512;

type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

type WorkflowClientEvent = {
    step: WorkflowStep;
    route?: string;
    action?: string;
    detail?: string;
    correlationId?: string;
};

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

function describeInvokeError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (typeof error === "number" || typeof error === "boolean") return String(error);
    try {
        return JSON.stringify(error);
    } catch {
        return "unknown_error";
    }
}

function looksLikeCancellation(message: string): boolean {
    return /\bcancel(?:led|ed|ation)?\b|\babort(?:ed)?\b|\bdismiss(?:ed)?\b|\buser denied\b/i.test(message);
}

function sanitizeWorkflowText(value: string | undefined): string | undefined {
    if (value == null) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.length > WORKFLOW_DETAIL_LIMIT ? trimmed.slice(0, WORKFLOW_DETAIL_LIMIT) : trimmed;
}

function buildWorkflowEventPayload(event: WorkflowClientEvent): Record<string, unknown> {
    return omitUndefinedValues({
        step: event.step,
        route: sanitizeWorkflowText(event.route),
        action: sanitizeWorkflowText(event.action),
        detail: sanitizeWorkflowText(event.detail),
        correlationId: sanitizeWorkflowText(event.correlationId),
    });
}

async function emitWorkflowEvent(event: WorkflowClientEvent): Promise<void> {
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, {
            event: buildWorkflowEventPayload(event),
        });
    } catch {
        // Best effort only: UI actions must continue even if logging fails.
    }
}

export function logWorkflowRouteEnter(route: string): void {
    void emitWorkflowEvent({ step: "route_enter", route });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const cleaned = omitUndefinedValues(args ?? {});
    const expanded = expandDualCaseInvokeArgs(cleaned);
    const shouldLogWorkflow = cmd !== WORKFLOW_LOG_COMMAND;

    if (shouldLogWorkflow) {
        await emitWorkflowEvent({ step: "primary_action", action: cmd });
    }

    try {
        const result = await invoke<T>(cmd, expanded);
        if (shouldLogWorkflow) {
            await emitWorkflowEvent({ step: "success", action: cmd });
        }
        return result;
    } catch (error) {
        if (shouldLogWorkflow) {
            const detail = describeInvokeError(error);
            await emitWorkflowEvent({
                step: looksLikeCancellation(detail) ? "cancel" : "error",
                action: cmd,
                detail,
            });
        }
        throw error;
    }
}
