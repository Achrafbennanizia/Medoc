import { practiceSystem } from "../adapters/practice-transport";
import type { SyncDeploymentConfigV1 } from "../lib/deployment-config";

export type InitialCopyStatus = {
    side: "replica" | "master" | string;
    deviceLabel: string;
    done: number;
    total: number;
};

export type SyncStatusSnapshot = {
    localDeviceId: string;
    deployment: SyncDeploymentConfigV1 & { schemaVersion: number };
    localSeq: number;
    pendingOutbox: number;
    peers: Array<{
        deviceId: string;
        displayName: string;
        role: string;
        peerBaseUrl: string | null;
        lastSeenAt: string | null;
    }>;
    vectors: Record<string, number>;
    initialCopy?: InitialCopyStatus | null;
};

export type SyncRunReport = {
    push?: { accepted: number; lastSeq: number };
    pull?: { applied: number; skipped: number };
    mesh?: { attempted: number; succeeded: number; errors: string[] };
    error?: string;
};

export async function syncGetStatus(): Promise<SyncStatusSnapshot> {
    return practiceSystem.invoke<SyncStatusSnapshot>("sync_get_status");
}

export async function syncSetDeployment(deployment: SyncDeploymentConfigV1): Promise<void> {
    await practiceSystem.invoke("sync_set_deployment", {
        payload: {
            deployment: {
                schemaVersion: deployment.schemaVersion,
                mode: deployment.mode,
                role: deployment.role,
                masterBaseUrl: deployment.masterBaseUrl,
                masterCertSha256: deployment.masterCertSha256,
                masterAccessToken: deployment.masterAccessToken,
                deviceLabel: deployment.deviceLabel,
                activationToken: deployment.activationToken,
                masterPubkey: deployment.masterPubkey,
                masterDeviceId: deployment.masterDeviceId,
                pairingRequestId: deployment.pairingRequestId,
                unstableMesh: deployment.unstableMesh,
            },
        },
    });
}

export async function syncRunNow(): Promise<SyncRunReport> {
    return practiceSystem.invoke<SyncRunReport>("sync_run_now");
}

export async function syncExchangeQueues(queues: string[]): Promise<SyncRunReport> {
    return practiceSystem.invoke<SyncRunReport>("sync_exchange_queue", { args: { queues } });
}

export type ReconcileReport = {
    bucketsChecked: number;
    rowsFetched: number;
    applied: number;
    queued: number;
    skipped: boolean;
    error?: string;
};

export async function syncReconcileNow(): Promise<ReconcileReport> {
    return practiceSystem.invoke<ReconcileReport>("sync_reconcile_now");
}

/** Update check the device runs when the link to the main device comes back (catch-up + digest). */
export type UpdateCheckReport = {
    at: string;
    pushed: number;
    pulled: number;
    repaired: number;
    complete: boolean;
    error: string | null;
};

export async function syncLastUpdateCheck(): Promise<UpdateCheckReport | null> {
    return practiceSystem.invoke<UpdateCheckReport | null>("sync_last_update_check");
}

export async function syncProbeMaster(): Promise<boolean> {
    return practiceSystem.invoke<boolean>("sync_probe_master");
}
