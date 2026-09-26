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

const WORKFLOW_EVENT_COMMAND = "log_workflow_event";
const WORKFLOW_DETAIL_MAX = 512;
let workflowSequence = 0;

type WorkflowStep = "route_enter" | "route_leave" | "primary_action";
type WorkflowStatus = "start" | "success" | "error" | "info";

interface WorkflowEventPayload {
    step: WorkflowStep;
    status: WorkflowStatus;
    route?: string;
    action?: string;
    command?: string;
    detail?: string;
    correlationId?: string;
    argKeys?: string[];
}

function clipText(value: string, maxLen: number): string {
    const clipped = value.trim().slice(0, maxLen);
    return clipped;
}

function describeError(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === "string") {
        return err;
    }
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

function nextWorkflowCorrelationId(command: string): string {
    workflowSequence = (workflowSequence + 1) % 1_000_000;
    return `${Date.now()}-${workflowSequence}-${command}`;
}

async function emitWorkflowEvent(event: WorkflowEventPayload): Promise<void> {
    try {
        await invoke<void>(WORKFLOW_EVENT_COMMAND, { event });
    } catch {
        // Logging must never break user flows.
    }
}

export async function logWorkflowRouteStep(
    route: string,
    step: "route_enter" | "route_leave" = "route_enter",
): Promise<void> {
    const cleanedRoute = clipText(route, 256);
    if (!cleanedRoute) {
        return;
    }
    await emitWorkflowEvent({
        step,
        status: "info",
        route: cleanedRoute,
        action: "route_navigation",
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_EVENT_COMMAND) {
        return invoke<T>(cmd, args ?? {});
    }
    const cleaned = omitUndefinedValues(args ?? {});
    const expanded = expandDualCaseInvokeArgs(cleaned);
    const correlationId = nextWorkflowCorrelationId(cmd);
    const argKeys = Object.keys(expanded).slice(0, 24);
    await emitWorkflowEvent({
        step: "primary_action",
        status: "start",
        action: cmd,
        command: cmd,
        correlationId,
        argKeys,
    });
    try {
        const result = await invoke<T>(cmd, expanded);
        await emitWorkflowEvent({
            step: "primary_action",
            status: "success",
            action: cmd,
            command: cmd,
            correlationId,
            argKeys,
        });
        return result;
    } catch (err) {
        await emitWorkflowEvent({
            step: "primary_action",
            status: "error",
            action: cmd,
            command: cmd,
            correlationId,
            argKeys,
            detail: clipText(describeError(err), WORKFLOW_DETAIL_MAX),
        });
        throw err;
    }
}
