import { invoke } from "@tauri-apps/api/core";
import { ipcErrorRaw } from "@/lib/ipc-errors";

export const WORKFLOW_LOG_COMMAND = "log_workflow_event";

export type WorkflowStep =
    | "route_enter"
    | "primary_action"
    | "success"
    | "cancel"
    | "error";

export interface WorkflowLogEvent {
    step: WorkflowStep;
    route?: string;
    action?: string;
    outcome?: string;
    details?: string;
    context?: Record<string, unknown>;
}

const MAX_DETAILS_LEN = 1000;
const MAX_ARG_KEYS = 32;

function currentRoute(): string {
    if (typeof window === "undefined" || !window.location) return "/";
    const route = `${window.location.pathname}${window.location.search}`;
    return route || "/";
}

function normalizeDetails(details?: string): string | undefined {
    if (!details) return undefined;
    const trimmed = details.trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, MAX_DETAILS_LEN);
}

function normalizeRoute(route?: string): string {
    const value = route?.trim();
    if (value) return value.slice(0, MAX_DETAILS_LEN);
    return currentRoute();
}

function summarizeArgKeys(args?: Record<string, unknown>): string[] {
    if (!args) return [];
    return Object.keys(args).sort().slice(0, MAX_ARG_KEYS);
}

export async function emitWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    // Web/LAN client mode has no local Tauri host command; silently no-op.
    if (typeof window === "undefined") return;
    const payload = {
        step: event.step,
        route: normalizeRoute(event.route),
        action: event.action?.trim().slice(0, MAX_DETAILS_LEN),
        outcome: event.outcome?.trim().slice(0, MAX_DETAILS_LEN),
        details: normalizeDetails(event.details),
        context: event.context,
    };
    try {
        await invoke<void>(WORKFLOW_LOG_COMMAND, { event: payload });
    } catch {
        // Best-effort telemetry: never block user workflows on logging.
    }
}

export function logRouteEnter(route?: string): void {
    void emitWorkflowEvent({ step: "route_enter", route });
}

export function logPrimaryAction(command: string, args?: Record<string, unknown>): void {
    void emitWorkflowEvent({
        step: "primary_action",
        action: command,
        context: { argKeys: summarizeArgKeys(args) },
    });
}

export function logActionSuccess(command: string): void {
    void emitWorkflowEvent({
        step: "success",
        action: command,
        outcome: "ok",
    });
}

export function logActionError(command: string, err: unknown): void {
    void emitWorkflowEvent({
        step: "error",
        action: command,
        outcome: "error",
        details: ipcErrorRaw(err),
    });
}

export function logCancel(action: string, details?: string): void {
    void emitWorkflowEvent({
        step: "cancel",
        action,
        outcome: "cancelled",
        details,
    });
}
