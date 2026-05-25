import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";

export interface AuditChainStatus {
    broken_at: string | null;
    acknowledged: boolean;
    blocks_ops: boolean;
}

export async function getAuditChainStatus(): Promise<AuditChainStatus> {
    return practiceSystem.invoke<AuditChainStatus>("get_audit_chain_status");
}

export async function acknowledgeAuditChainBreak(): Promise<void> {
    return practiceSystem.invoke<void>("acknowledge_audit_chain_break");
}
