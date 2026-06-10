/**
 * Replica-side pairing controller — drives the "scan & request" UI.
 *
 * Flow:
 *  1. `pairingScanLan` — UDP discovery for masters on the local network.
 *  2. `pairingSubmitRequest` — sends our device id + slave pubkey to master.
 *  3. `pairingCheckStatus` — polls the master until accepted/rejected.
 *  4. `pairingPersistToken` — stores the activation token in the deployment
 *     config so subsequent `sync_run_now` calls authenticate as a replica.
 */

import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";

export type DiscoveredMaster = {
    host: string;
    httpPort: number;
    label: string;
    instanceId: string;
    tls: boolean;
    certSha256: string;
    baseUrl: string;
};

export type PairingSubmitResult = {
    requestId: string;
    deviceId: string;
    slavePubkey: string;
    masterPubkey: string;
    masterDeviceId: string;
};

export type PairingRequestSnapshot = {
    id: string;
    deviceId: string;
    slavePubkey: string;
    slaveLabel: string;
    requesterIp: string;
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "REVOKED";
    allowedActions: string[];
    activationToken: string | null;
    requestedAt: string;
    decidedAt: string | null;
    decidedBy: string | null;
    awaitingPin?: boolean;
    transport?: string;
};

export function pairingScanLan(seconds = 2): Promise<DiscoveredMaster[]> {
    return tauriInvoke<DiscoveredMaster[]>("pairing_scan_lan", { payload: { seconds } });
}

export function pairingScanBluetooth(seconds = 3): Promise<DiscoveredMaster[]> {
    return tauriInvoke<DiscoveredMaster[]>("pairing_scan_bluetooth", { payload: { seconds } });
}

export function pairingSubmitRequest(args: {
    masterBaseUrl: string;
    masterCertSha256?: string;
    slaveLabel: string;
    transport?: "lan" | "bluetooth";
}): Promise<PairingSubmitResult> {
    return tauriInvoke<PairingSubmitResult>("pairing_submit_request", {
        payload: {
            masterBaseUrl: args.masterBaseUrl,
            masterCertSha256: args.masterCertSha256 ?? "",
            slaveLabel: args.slaveLabel,
            transport: args.transport ?? "lan",
        },
    });
}

export function pairingCheckStatus(args: {
    requestId: string;
    masterBaseUrl: string;
}): Promise<PairingRequestSnapshot> {
    return tauriInvoke<PairingRequestSnapshot>("pairing_check_status", {
        payload: { requestId: args.requestId, masterBaseUrl: args.masterBaseUrl },
    });
}

export function pairingConfirmPin(args: {
    requestId: string;
    masterBaseUrl: string;
    pin: string;
}): Promise<PairingRequestSnapshot> {
    return tauriInvoke<PairingRequestSnapshot>("pairing_confirm_pin", {
        payload: {
            requestId: args.requestId,
            masterBaseUrl: args.masterBaseUrl,
            pin: args.pin,
        },
    });
}

export function pairingPersistToken(activationToken: string): Promise<void> {
    return tauriInvoke<void>("pairing_persist_token", {
        payload: { activationToken },
    });
}
