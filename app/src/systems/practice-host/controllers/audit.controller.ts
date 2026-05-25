import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import type { AuditLog } from "@/models/types";
import type { ListParams, ListResponse } from "@/lib/list-params";

export async function listAuditLogs(): Promise<AuditLog[]> {
    return practiceSystem.invoke<AuditLog[]>("list_audit_logs");
}

export async function listAuditLogsPaged(
    params?: ListParams,
): Promise<ListResponse<AuditLog>> {
    return practiceSystem.invoke<ListResponse<AuditLog>>("list_audit_logs_paged", { params });
}

export async function exportAuditCsv(): Promise<number[]> {
    return practiceSystem.invoke<number[]>("export_audit_csv");
}
