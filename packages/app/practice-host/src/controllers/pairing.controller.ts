/**
 * Master-side pairing controller — feeds the Settings pairing inbox.
 *
 * All IPC calls require an authenticated session; mutating commands also
 * require the RBAC permission `ops.system`.
 */

import { practiceSystem } from "../adapters/practice-transport";

export type PairingStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "REVOKED";

export type PairingDecideResult = {
    request: PairingRequest;
    /** Shown once on the master after accept; enter on the replica device. */
    confirmPin?: string;
};

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
    awaitingPin?: boolean;
    transport?: string;
    couplingCode?: string | null;
    clusterSas?: boolean;
};

export type PairingMasterInfo = {
    masterDeviceId: string;
    masterPubkey: string;
};

/**
 * Optional LAN actions (master must opt in per slave). Group: `sync.number_block` makes the
 * device the second admin hub, which may issue document numbers while the main one is off.
 */
export const OPTIONAL_READ_ACTIONS: readonly string[] = [
    "patient.read",
    "appointment.read",
    ...(__CAP_MULTI_ADMIN__ ? ["sync.number_block"] : []),
];

/** Label key of each pairing action in Settings → Pairing. */
export const PAIRING_ACTION_KEYS: Record<string, string> = {
    "sync.push": "settings.pairing.action.sync_push",
    "sync.pull": "settings.pairing.action.sync_pull",
    "sync.status": "settings.pairing.action.sync_status",
    "pairing.peers": "settings.pairing.action.pairing_peers",
    "patient.read": "settings.pairing.action.patient_read",
    "appointment.read": "settings.pairing.action.appointment_read",
    "sync.number_block": "settings.pairing.action.sync_number_block",
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
): Promise<PairingDecideResult> {
    return practiceSystem.invoke<PairingDecideResult>("pairing_decide", {
        payload: { requestId, accept, allowedActions },
    });
}

export async function pairingRevoke(deviceId: string): Promise<void> {
    await practiceSystem.invoke("pairing_revoke", { deviceId });
}

export async function pairingMasterInfo(): Promise<PairingMasterInfo> {
    return practiceSystem.invoke<PairingMasterInfo>("pairing_master_info");
}
