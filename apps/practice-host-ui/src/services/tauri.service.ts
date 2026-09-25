import { invoke } from "@tauri-apps/api/core";

/**
 * Tauri v2 resolves each command parameter from the invoke JSON using an explicit key.
 * `tauri_macros` defaults to **camelCase** keys derived from Rust identifiers (`patient_id` → `patientId`).
 * Many controllers still send **snake_case** keys; that yields `{}` lookups / missing-key errors.
 *
 * We mirror snake_case ↔ camelCase **at the top level only** so either spelling reaches Rust.
 * Also strips `undefined` so serialization cannot drop required keys silently.
 */
const WORKFLOW_COMMAND = "log_workflow_event";
const MAX_ROUTE_CHARS = 256;
const MAX_STEP_CHARS = 128;
const MAX_PHASE_CHARS = 64;
const MAX_OUTCOME_CHARS = 64;
const MAX_DETAILS_CHARS = 512;

type WorkflowPhase = "route_enter" | "primary_action" | "success" | "cancel" | "error";
type WorkflowOutcome = "ok" | "cancelled" | "error";

type WorkflowEventPayload = {
    route: string;
    step: string;
    phase: WorkflowPhase;
    outcome?: WorkflowOutcome;
    details?: string;
};

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

function trimToMax(value: string, maxChars: number): string {
    return value.trim().slice(0, maxChars);
}

function maskRouteSegment(segment: string): string {
    if (!segment) return segment;
    if (/^\d{3,}$/.test(segment)) return ":id";
    if (/^[0-9a-f]{8,}$/i.test(segment)) return ":id";
    if (/^[0-9a-f-]{16,}$/i.test(segment)) return ":id";
    return segment;
}

function normalizeRoute(rawRoute: string): string {
    const base = rawRoute.split("?")[0] ?? rawRoute;
    const masked = base
        .split("/")
        .map(maskRouteSegment)
        .join("/");
    return trimToMax(masked || "/", MAX_ROUTE_CHARS);
}

function currentRoute(): string {
    if (typeof window === "undefined") return "/unknown";
    return `${window.location.pathname || "/"}`;
}

function classifyFailure(error: unknown): Pick<WorkflowEventPayload, "phase" | "outcome" | "details"> {
    const msg = error instanceof Error ? `${error.name}:${error.message}` : String(error);
    if (/(cancel|abort|dismiss|closed)/i.test(msg)) {
        return { phase: "cancel", outcome: "cancelled", details: "cancelled" };
    }
    const detail = error instanceof Error ? error.name : typeof error;
    return { phase: "error", outcome: "error", details: detail };
}

async function emitWorkflowEvent(payload: WorkflowEventPayload): Promise<void> {
    const route = normalizeRoute(payload.route || currentRoute());
    const step = trimToMax(payload.step, MAX_STEP_CHARS);
    const phase = trimToMax(payload.phase, MAX_PHASE_CHARS) as WorkflowPhase;
    if (!route || !step || !phase) return;
    const args = {
        route,
        step,
        phase,
        outcome: payload.outcome ? trimToMax(payload.outcome, MAX_OUTCOME_CHARS) : undefined,
        details: payload.details ? trimToMax(payload.details, MAX_DETAILS_CHARS) : undefined,
    };
    try {
        await invoke<void>(WORKFLOW_COMMAND, args);
    } catch {
        // Best-effort telemetry: workflow logging must never block business flows.
    }
}

export async function logWorkflowRouteEnter(route: string): Promise<void> {
    await emitWorkflowEvent({
        route,
        step: "route",
        phase: "route_enter",
        outcome: "ok",
    });
}

// All Tauri IPC goes through here (single place for invoke normalization).
export async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    const workflowRoute = currentRoute();
    if (cmd !== WORKFLOW_COMMAND) {
        await emitWorkflowEvent({
            route: workflowRoute,
            step: cmd,
            phase: "primary_action",
        });
    }

    const expanded = args == null ? {} : expandDualCaseInvokeArgs(omitUndefinedValues(args));
    try {
        const result = await invoke<T>(cmd, expanded);
        if (cmd !== WORKFLOW_COMMAND) {
            await emitWorkflowEvent({
                route: workflowRoute,
                step: cmd,
                phase: "success",
                outcome: "ok",
            });
        }
        return result;
    } catch (error) {
        if (cmd !== WORKFLOW_COMMAND) {
            const failure = classifyFailure(error);
            await emitWorkflowEvent({
                route: workflowRoute,
                step: cmd,
                ...failure,
            });
        }
        throw error;
    }
}
