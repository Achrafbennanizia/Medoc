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

const WORKFLOW_LOG_COMMAND = "workflow_log_event";
const UUID_SEGMENT_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT_RE = /^\d+$/;
const LONG_ALNUM_SEGMENT_RE = /^[A-Za-z0-9]{12,}$/;
const ENTITY_ID_SEGMENT_RE =
    /^(pat|patient|akte|ticket|rezept|termin|zahlung|bestellung|vertrag|kb)-[A-Za-z0-9_-]+$/i;

type WorkflowStatus = "start" | "success" | "cancel" | "error";

type WorkflowLogEvent = {
    workflow: string;
    step: string;
    status: WorkflowStatus;
    route?: string;
    action?: string;
    detail?: string;
};

function truncate(input: string, max = 220): string {
    if (input.length <= max) return input;
    return `${input.slice(0, max)}…`;
}

function cleanWorkflowField(raw: string): string {
    return truncate(raw.replace(/\s+/g, " ").trim() || "unknown");
}

function summarizeArgs(args: Record<string, unknown>): string {
    const keys = Object.keys(args).sort();
    if (keys.length === 0) return "no-args";
    const list = keys.slice(0, 12).join(",");
    return keys.length > 12 ? `${list},+${keys.length - 12}` : list;
}

function isCancelError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return /abort|aborted|cancel|cancelled|canceled/i.test(message);
}

export function normalizeRoutePath(pathname: string): string {
    const segments = pathname
        .split("/")
        .filter(Boolean)
        .map((segment) => {
            const raw = decodeURIComponent(segment);
            if (
                UUID_SEGMENT_RE.test(raw) ||
                NUMERIC_SEGMENT_RE.test(raw) ||
                LONG_ALNUM_SEGMENT_RE.test(raw) ||
                ENTITY_ID_SEGMENT_RE.test(raw)
            ) {
                return ":id";
            }
            return raw;
        });
    return `/${segments.join("/")}`;
}

async function emitWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    const payload = {
        workflow: cleanWorkflowField(event.workflow),
        step: cleanWorkflowField(event.step),
        status: cleanWorkflowField(event.status),
        route: event.route ? cleanWorkflowField(event.route) : undefined,
        action: event.action ? cleanWorkflowField(event.action) : undefined,
        detail: event.detail ? cleanWorkflowField(event.detail) : undefined,
    };
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { event: payload });
    } catch {
        // Ignore bridge failures (e.g. Vitest/jsdom, non-Tauri contexts).
    }
}

export async function logWorkflowRouteEnter(pathname: string): Promise<void> {
    await emitWorkflowEvent({
        workflow: "ui-route",
        step: "route_enter",
        status: "success",
        route: normalizeRoutePath(pathname),
    });
}

// All Tauri IPC goes through here (single place for invoke normalization + workflow telemetry).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const cleaned = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    const isWorkflowBridgeCall = cmd === WORKFLOW_LOG_COMMAND;

    if (!isWorkflowBridgeCall) {
        await emitWorkflowEvent({
            workflow: "ipc",
            step: "primary_action",
            status: "start",
            action: cmd,
            detail: summarizeArgs(expanded),
        });
    }

    try {
        const result = await invoke<T>(cmd, expanded);
        if (!isWorkflowBridgeCall) {
            await emitWorkflowEvent({
                workflow: "ipc",
                step: "primary_action",
                status: "success",
                action: cmd,
            });
        }
        return result;
    } catch (err) {
        if (!isWorkflowBridgeCall) {
            await emitWorkflowEvent({
                workflow: "ipc",
                step: "primary_action",
                status: isCancelError(err) ? "cancel" : "error",
                action: cmd,
                detail: truncate(err instanceof Error ? err.message : String(err)),
            });
        }
        throw err;
    }
}
