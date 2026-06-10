import { tauriInvoke } from "@/services/tauri.service";

import type { VerbundStatusSnapshot } from "@/models/store/verbund-store";

export type AdminEndpoint = {
    host: string;
    port: number;
    instanceName: string;
};

export type KopplungHandle = {
    sessionId: string;
    fingerprint: string;
};

export type PendingRequest = {
    id: string;
    fingerprint: string;
    hostname: string | null;
    os: string | null;
    ip: string | null;
    requestedRole: string;
    createdAt: string;
    suggestedReclaimFingerprint?: string | null;
};

export type GeraetView = {
    fingerprint: string;
    hostname: string | null;
    lastIp: string | null;
    seatRole: string;
    status: string;
    lastSeen: string | null;
};

export async function verbundGetStatus(): Promise<VerbundStatusSnapshot> {
    return tauriInvoke("verbund_status_cmd");
}

export async function verbundActivateLicense(licenseKey: string): Promise<VerbundStatusSnapshot> {
    return tauriInvoke("lizenz_activate", { licenseKey });
}

export async function verbundDiscoverAdmins(): Promise<AdminEndpoint[]> {
    return tauriInvoke("verbund_discover_admins");
}

export async function verbundSendJoinRequest(
    requestedRole: "ADMIN" | "MEMBER",
): Promise<KopplungHandle> {
    return tauriInvoke("verbund_send_join_request", {
        payload: { requestedRole, handshakeTranscriptB64: "" },
    });
}

export async function verbundSubmitSas(
    handle: KopplungHandle,
    digits: string,
): Promise<{ success: boolean; alreadyProvisioned: boolean }> {
    return tauriInvoke("verbund_submit_sas", {
        payload: { handle, digits, handshakeTranscriptB64: "" },
    });
}

export async function verbundStartListener(): Promise<void> {
    return tauriInvoke("verbund_start_listener");
}

export async function verbundListPending(): Promise<PendingRequest[]> {
    return tauriInvoke("verbund_list_pending");
}

export async function verbundAcceptRequest(
    id: string,
    replaceFingerprint?: string,
): Promise<{ digits: string }> {
    return tauriInvoke("verbund_accept_request", {
        payload: {
            id,
            handshakeTranscriptB64: "",
            replaceFingerprint: replaceFingerprint ?? null,
        },
    });
}

export async function verbundReclaimDevice(fingerprint: string): Promise<void> {
    return tauriInvoke("verbund_reclaim_device", { fingerprint });
}

export async function verbundRejectRequest(id: string): Promise<void> {
    return tauriInvoke("verbund_reject_request", { id });
}

export async function verbundListDevices(): Promise<GeraetView[]> {
    return tauriInvoke("verbund_list_devices");
}

export async function verbundRevokeDevice(fingerprint: string): Promise<void> {
    return tauriInvoke("verbund_revoke_device", { fingerprint });
}

export async function verbundBlockDevice(fingerprint: string, reason: string): Promise<void> {
    return tauriInvoke("verbund_block_device", { fingerprint, reason });
}

export async function verbundUnblockDevice(fingerprint: string): Promise<void> {
    return tauriInvoke("verbund_unblock_device", { fingerprint });
}
