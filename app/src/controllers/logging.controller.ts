import { tauriInvoke } from "@/services/tauri.service";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

export async function getLogLevel(): Promise<LogLevel> {
    return tauriInvoke<LogLevel>("get_log_level");
}

export async function setLogLevel(level: LogLevel): Promise<void> {
    return tauriInvoke<void>("set_log_level", { level });
}

export async function exportLogs(outputPath: string): Promise<number> {
    return tauriInvoke<number>("export_logs", { outputPath });
}

export async function verifyAuditChain(): Promise<string | null> {
    return tauriInvoke<string | null>("verify_audit_chain");
}

export async function getLogDir(): Promise<string> {
    return tauriInvoke<string>("log_dir");
}
