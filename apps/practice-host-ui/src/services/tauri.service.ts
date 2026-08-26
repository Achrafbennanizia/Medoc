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

type WorkflowStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

interface WorkflowEventPayload {
    step: WorkflowStep;
    route?: string;
    action?: string;
    status?: string;
    command?: string;
    detail?: string;
    argKeys?: string[];
}

const WORKFLOW_LOG_COMMAND = "log_workflow_event";
const CANCEL_LIKE_COMMANDS = new Set([
    "save_export_file",
    "pick_export_directory",
    "pick_backup_file",
    "pick_patients_csv_file",
    "pick_vertrag_pdf_file",
    "pick_activation_manifest_file",
]);

function sortedArgKeys(args?: Record<string, unknown>): string[] {
    if (!args) return [];
    return Object.keys(args).sort().slice(0, 64);
}

function looksCancelledResult(command: string, result: unknown): boolean {
    if (!CANCEL_LIKE_COMMANDS.has(command)) {
        return false;
    }
    return result == null || result === "";
}

async function emitWorkflowEvent(payload: WorkflowEventPayload): Promise<void> {
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { payload });
    } catch {
        // Never break product flows when telemetry logging is unavailable.
    }
}

export function logWorkflowUiStep(
    step: WorkflowStep,
    details: Omit<WorkflowEventPayload, "step"> = {},
): void {
    void emitWorkflowEvent({ step, ...details });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd === WORKFLOW_LOG_COMMAND) {
        if (args == null) {
            return invoke<T>(cmd, {});
        }
        const cleaned = omitUndefinedValues(args);
        const expanded = expandDualCaseInvokeArgs(cleaned);
        return invoke<T>(cmd, expanded);
    }

    const cleaned = args == null ? {} : omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    const argKeys = sortedArgKeys(cleaned);

    await emitWorkflowEvent({
        step: "primary_action",
        action: "invoke",
        status: "started",
        command: cmd,
        argKeys,
    });

    try {
        const result = await invoke<T>(cmd, expanded);
        const cancelled = looksCancelledResult(cmd, result);
        await emitWorkflowEvent({
            step: cancelled ? "cancel" : "success",
            action: "invoke",
            status: cancelled ? "cancelled" : "ok",
            command: cmd,
            argKeys,
        });
        return result;
    } catch (error) {
        await emitWorkflowEvent({
            step: "error",
            action: "invoke",
            status: "failed",
            command: cmd,
            detail: error instanceof Error ? error.name : "invoke_error",
            argKeys,
        });
        throw error;
    }
}
