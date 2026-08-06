import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";
export type WorkflowLogStep = "route_enter" | "primary_action" | "success" | "cancel" | "error";

export type WorkflowLogEvent = {
    step: WorkflowLogStep;
    route?: string;
    action?: string;
    status?: string;
    detail?: string;
};

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

export async function logWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    await practiceSystem.invoke<void>("log_workflow_event", event);
}

/** Example log file path for display (`app.log` in the log directory). */
export async function getExampleAppLogPath(logDir: string): Promise<string> {
    const { join } = await import("@tauri-apps/api/path");
    return join(logDir, "app.log");
}
