import { practiceSystem } from "../adapters/practice-transport";
import type { SyncDeploymentConfigV1 } from "../lib/deployment-config";

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
};

export type SyncRunReport = {
    push?: { accepted: number; lastSeq: number };
    pull?: { applied: number; skipped: number };
    error?: string;
};

export async function syncGetStatus(): Promise<SyncStatusSnapshot> {
    return practiceSystem.invoke<SyncStatusSnapshot>("sync_get_status");
}

export async function syncSetDeployment(deployment: SyncDeploymentConfigV1): Promise<void> {
    await practiceSystem.invoke("sync_set_deployment", {
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
    });
}

export async function syncRunNow(): Promise<SyncRunReport> {
    return practiceSystem.invoke<SyncRunReport>("sync_run_now");
}
