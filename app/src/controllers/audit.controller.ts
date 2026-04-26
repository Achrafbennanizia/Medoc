import { tauriInvoke } from "@/services/tauri.service";
import type { AuditLog } from "@/models/types";
import type { ListParams, ListResponse } from "@/lib/list-params";

export async function listAuditLogs(): Promise<AuditLog[]> {
    return tauriInvoke<AuditLog[]>("list_audit_logs");
}

export async function listAuditLogsPaged(
    params?: ListParams,
): Promise<ListResponse<AuditLog>> {
    return tauriInvoke<ListResponse<AuditLog>>("list_audit_logs_paged", { params });
}

export async function exportAuditCsv(): Promise<number[]> {
    return tauriInvoke<number[]>("export_audit_csv");
}
