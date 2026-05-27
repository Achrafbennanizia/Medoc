/**
 * Master-side pairing controller — feeds the Einstellungen pairing inbox.
 *
 * All IPC calls require an authenticated session; mutating commands also
 * require the RBAC permission `ops.system`.
 */

import { practiceSystem } from "../adapters/practice-transport";

export type PairingStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "REVOKED";

export type PairingRequest = {
    id: string;
    deviceId: string;
    slavePubkey: string;
    slaveLabel: string;
    requesterIp: string;
    status: PairingStatus;
    allowedActions: string[];
    activationToken: string | null;
    requestedAt: string;
    decidedAt: string | null;
    decidedBy: string | null;
};

export type PairingMasterInfo = {
    masterDeviceId: string;
    masterPubkey: string;
};

/** Default action allow-list shown to the master operator when accepting a request. */
export const DEFAULT_ALLOWED_ACTIONS = [
    "sync.push",
    "sync.pull",
    "sync.status",
    "pairing.peers",
] as const;

export async function pairingListPending(): Promise<PairingRequest[]> {
    return practiceSystem.invoke<PairingRequest[]>("pairing_list_pending");
}

export async function pairingListAll(): Promise<PairingRequest[]> {
    return practiceSystem.invoke<PairingRequest[]>("pairing_list_all");
}

export async function pairingDecide(
    requestId: string,
    accept: boolean,
    allowedActions: string[] = [...DEFAULT_ALLOWED_ACTIONS],
): Promise<PairingRequest> {
    return practiceSystem.invoke<PairingRequest>("pairing_decide", {
        payload: { requestId, accept, allowedActions },
    });
}

export async function pairingRevoke(deviceId: string): Promise<void> {
    await practiceSystem.invoke("pairing_revoke", { deviceId });
}

export async function pairingMasterInfo(): Promise<PairingMasterInfo> {
    return practiceSystem.invoke<PairingMasterInfo>("pairing_master_info");
}
