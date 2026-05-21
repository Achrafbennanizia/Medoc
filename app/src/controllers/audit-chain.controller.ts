import { tauriInvoke } from "@/services/tauri.service";

export interface AuditChainStatus {
    broken_at: string | null;
    acknowledged: boolean;
    blocks_ops: boolean;
}

export async function getAuditChainStatus(): Promise<AuditChainStatus> {
    return tauriInvoke<AuditChainStatus>("get_audit_chain_status");
}

export async function acknowledgeAuditChainBreak(): Promise<void> {
    return tauriInvoke<void>("acknowledge_audit_chain_break");
}
