import { tauriInvoke } from "@/services/tauri.service";
import type { AuditLog } from "@/models/types";

export async function listAuditLogs(): Promise<AuditLog[]> {
    return tauriInvoke<AuditLog[]>("list_audit_logs");
}

export async function exportAuditCsv(): Promise<number[]> {
    return tauriInvoke<number[]>("export_audit_csv");
}
