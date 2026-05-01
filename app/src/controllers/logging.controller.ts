import { tauriInvoke } from "@/services/tauri.service";

export type LogLevel = "ERROR" | "WARN" | "INFO" | "DEBUG" | "TRACE";

export async function getLogLevel(): Promise<LogLevel> {
    return tauriInvoke<LogLevel>("get_log_level");
}

export async function setLogLevel(level: LogLevel): Promise<void> {
    return tauriInvoke<void>("set_log_level", { level });
}

/** Returns raw ZIP bytes (last 7 days of `*.log` files, sanitised). */
export async function exportLogs(): Promise<number[]> {
    return tauriInvoke<number[]>("export_logs");
}

export async function verifyAuditChain(): Promise<string | null> {
    return tauriInvoke<string | null>("verify_audit_chain");
}

export async function getLogDir(): Promise<string> {
    return tauriInvoke<string>("log_dir");
}
