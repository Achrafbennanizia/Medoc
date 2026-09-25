import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";
export type WorkflowStepKind =
    | "route_enter"
    | "primary_action"
    | "success"
    | "cancel"
    | "error";
export type WorkflowStepStatus = "start" | "success" | "cancel" | "error";

export type WorkflowStepEvent = {
    route: string;
    step: WorkflowStepKind;
    status: WorkflowStepStatus;
    action?: string;
    detail?: string;
};

function looksLikeUuid(segment: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(segment);
}

function shouldRedactRouteSegment(segment: string): boolean {
    if (!segment || segment === "new" || segment === "edit" || segment === "bearbeiten") {
        return false;
    }
    if (/^\d+$/.test(segment) || looksLikeUuid(segment)) {
        return true;
    }
    const hasDigit = /\d/.test(segment);
    const hasAlpha = /[a-z]/i.test(segment);
    const hasSeparator = segment.includes("-") || segment.includes("_");
    return segment.length >= 8 && hasDigit && (hasAlpha || hasSeparator);
}

export function normalizeWorkflowRoute(pathname: string): string {
    const pathOnly = (pathname || "/").split(/[?#]/, 1)[0] || "/";
    const segments = pathOnly
        .split("/")
        .filter((segment) => segment.length > 0)
        .map((segment) => (shouldRedactRouteSegment(segment) ? ":id" : segment));
    return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

export async function getLogLevel(): Promise<LogLevel> {
    return practiceSystem.invoke<LogLevel>("get_log_level");
}

export async function setLogLevel(level: LogLevel): Promise<void> {
    return practiceSystem.invoke<void>("set_log_level", { level });
}

/** Returns raw ZIP bytes (last 7 days of `*.log` files, sanitised). */
export async function exportLogs(): Promise<number[]> {
    return practiceSystem.invoke<number[]>("export_logs");
}

export async function verifyAuditChain(): Promise<string | null> {
    return practiceSystem.invoke<string | null>("verify_audit_chain");
}

export async function getLogDir(): Promise<string> {
    return practiceSystem.invoke<string>("log_dir");
}

/** Example log file path for display (`app.log` in the log directory). */
export async function getExampleAppLogPath(logDir: string): Promise<string> {
    const { join } = await import("@tauri-apps/api/path");
    return join(logDir, "app.log");
}

/**
 * Best-effort workflow telemetry bridge into the backend `workflow.log` channel.
 * This must never block UI flows.
 */
export async function logWorkflowStep(event: WorkflowStepEvent): Promise<void> {
    const payload: WorkflowStepEvent = {
        route: normalizeWorkflowRoute(event.route),
        step: event.step,
        status: event.status,
        action: event.action,
        detail: event.detail,
    };
    try {
        await tauriInvoke<void>("log_workflow_step", { payload });
    } catch {
        // Keep frontend workflow execution independent from diagnostics availability.
    }
}
