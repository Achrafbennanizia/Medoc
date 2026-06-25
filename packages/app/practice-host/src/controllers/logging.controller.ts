import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";
export const WORKFLOW_STEPS = [
    "route_enter",
    "primary_action",
    "success",
    "cancel",
    "error",
] as const;
export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

export interface WorkflowLogEvent {
    workflow?: string;
    step: WorkflowStep;
    route?: string;
    action?: string;
    status?: string;
    message?: string;
    error?: string;
}

export function isWorkflowStep(value: string): value is WorkflowStep {
    return WORKFLOW_STEPS.includes(value as WorkflowStep);
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

export async function logWorkflowEvent(event: WorkflowLogEvent): Promise<void> {
    return practiceSystem.invoke<void>("log_workflow_event", { event });
}
