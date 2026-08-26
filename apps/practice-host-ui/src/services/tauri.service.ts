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

const WORKFLOW_EVENT_CMD = "record_workflow_event";
const WORKFLOW_FIELD_MAX = 120;

type WorkflowStage = "route_enter" | "primary_action" | "success" | "cancel" | "error";

interface WorkflowEvent {
    stage: WorkflowStage;
    route?: string;
    action?: string;
    outcome?: string;
}

function trimWorkflowField(value?: string): string | undefined {
    if (!value) return undefined;
    const compact = value.replace(/\s+/g, " ").trim();
    if (!compact) return undefined;
    return compact.length <= WORKFLOW_FIELD_MAX ? compact : compact.slice(0, WORKFLOW_FIELD_MAX);
}

function currentRoutePath(): string | undefined {
    if (typeof window === "undefined" || !window.location) {
        return undefined;
    }
    const route = `${window.location.pathname ?? ""}${window.location.search ?? ""}`;
    return trimWorkflowField(route);
}

function classifyInvokeFailure(error: unknown): { stage: "cancel" | "error"; outcome: string } {
    const raw =
        typeof error === "string"
            ? error
            : error instanceof Error
                ? error.message
                : "";
    const lower = raw.toLowerCase();
    if (lower.includes("cancel")) {
        return { stage: "cancel", outcome: "cancelled" };
    }
    if (lower.includes("timeout")) {
        return { stage: "error", outcome: "timeout" };
    }
    if (lower.includes("401") || lower.includes("unauthorized")) {
        return { stage: "error", outcome: "unauthorized" };
    }
    if (lower.includes("403") || lower.includes("forbidden")) {
        return { stage: "error", outcome: "forbidden" };
    }
    return { stage: "error", outcome: "failed" };
}

export async function recordWorkflowEvent(event: WorkflowEvent): Promise<void> {
    const payload = {
        stage: trimWorkflowField(event.stage) ?? "other",
        route: trimWorkflowField(event.route),
        action: trimWorkflowField(event.action),
        outcome: trimWorkflowField(event.outcome),
    };
    try {
        await invoke<void>(WORKFLOW_EVENT_CMD, payload);
    } catch {
        // Workflow telemetry must never block core product actions.
    }
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (cmd !== WORKFLOW_EVENT_CMD) {
        await recordWorkflowEvent({
            stage: "primary_action",
            route: currentRoutePath(),
            action: cmd,
        });
    }
    if (args == null) {
        try {
            const result = await invoke<T>(cmd, {});
            if (cmd !== WORKFLOW_EVENT_CMD) {
                await recordWorkflowEvent({
                    stage: "success",
                    route: currentRoutePath(),
                    action: cmd,
                    outcome: "ok",
                });
            }
            return result;
        } catch (error) {
            if (cmd !== WORKFLOW_EVENT_CMD) {
                const failure = classifyInvokeFailure(error);
                await recordWorkflowEvent({
                    stage: failure.stage,
                    route: currentRoutePath(),
                    action: cmd,
                    outcome: failure.outcome,
                });
            }
            throw error;
        }
    }
    const cleaned = omitUndefinedValues(args);
    const expanded = expandDualCaseInvokeArgs(cleaned);
    try {
        const result = await invoke<T>(cmd, expanded);
        if (cmd !== WORKFLOW_EVENT_CMD) {
            await recordWorkflowEvent({
                stage: "success",
                route: currentRoutePath(),
                action: cmd,
                outcome: "ok",
            });
        }
        return result;
    } catch (error) {
        if (cmd !== WORKFLOW_EVENT_CMD) {
            const failure = classifyInvokeFailure(error);
            await recordWorkflowEvent({
                stage: failure.stage,
                route: currentRoutePath(),
                action: cmd,
                outcome: failure.outcome,
            });
        }
        throw error;
    }
}
