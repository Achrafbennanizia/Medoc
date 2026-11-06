import { tauriInvoke } from "@/services/tauri.service";

import type { ClusterStatusSnapshot } from "@/models/store/cluster-store";

export type AdminEndpoint = {
    host: string;
    port: number;
    instanceName: string;
};

export type JoinAdminTarget = {
    host: string;
    port: number;
};

export type JoinRequestResult = PairingHandle & {
    handshakeTranscriptB64: string;
};

export type PairingHandle = {
    sessionId: string;
    fingerprint: string;
};

/** Rust returns `{ handle: { sessionId, fingerprint }, handshakeTranscriptB64 }`. */
export function pairingHandleFromJoinPayload(value: unknown): PairingHandle {
    if (!value || typeof value !== "object") {
        throw new Error("Pairing handle missing");
    }
    const rec = value as Record<string, unknown>;
    const nested = rec.handle;
    if (nested && typeof nested === "object") {
        const inner = nested as Record<string, unknown>;
        if (typeof inner.sessionId === "string" && inner.sessionId.length > 0) {
            return {
                sessionId: inner.sessionId,
                fingerprint: typeof inner.fingerprint === "string" ? inner.fingerprint : "",
            };
        }
    }
    if (typeof rec.sessionId === "string" && rec.sessionId.length > 0) {
        return {
            sessionId: rec.sessionId,
            fingerprint: typeof rec.fingerprint === "string" ? rec.fingerprint : "",
        };
    }
    throw new Error("Pairing handle missing sessionId");
}

function handshakeTranscriptFromJoinPayload(value: unknown): string {
    if (!value || typeof value !== "object") {
        return "";
    }
    const rec = value as Record<string, unknown>;
    return typeof rec.handshakeTranscriptB64 === "string" ? rec.handshakeTranscriptB64 : "";
}

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

export type DeviceView = {
    fingerprint: string;
    hostname: string | null;
    lastIp: string | null;
    seatRole: string;
    status: string;
    lastSeen: string | null;
};

export type ImportActivationResult = {
    status: ClusterStatusSnapshot;
    manifestRemoved: boolean;
    clusterId?: string;
    deviceFingerprint?: string;
    requiresAppReload: boolean;
};

export const ONBOARDING_LICENSE_PENDING_KEY = "medoc.onboarding.pending_license";
export const ONBOARDING_LICENSE_TOKEN_KEY = "medoc.onboarding.license_token";

export type OnboardingSubscriptionRequest = {
    displayName?: string;
    practiceSlug?: string;
    adminName: string;
    adminEmail: string;
    adminPassword?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    plan: "BASIC" | "PRO" | "ENTERPRISE";
    portalBaseUrl?: string;
};

export type OnboardingSubscriptionResult = {
    practiceSlug: string;
    planName: string;
    licenseToken?: string;
    adminEmail: string;
    adminAccountCreated: boolean;
};

export async function onboardingSubscriptionStatus(): Promise<{
    registered: boolean;
    practiceSlug?: string;
    setupComplete: boolean;
    needsAdminAccount: boolean;
    existingAccountEmails: string[];
    staffCount: number;
    needsPracticeSetup: boolean;
    needsMemberAccount: boolean;
    canSkipToLogin: boolean;
    loginReadyEmails: string[];
}> {
    return tauriInvoke("onboarding_subscription_status");
}

export async function onboardingSkipPracticeSetup(): Promise<{ loginEmails: string[] }> {
    return tauriInvoke("onboarding_skip_practice_setup");
}

export type OnboardingMemberAccountRequest = {
    name: string;
    email: string;
    password: string;
    role?: "PHYSICIAN" | "RECEPTION";
};

export async function registerOnboardingMemberAccount(
    payload: OnboardingMemberAccountRequest,
): Promise<void> {
    return tauriInvoke("register_onboarding_member_account", { request: payload });
}

export async function onboardingUseExistingAccount(): Promise<void> {
    return tauriInvoke("onboarding_use_existing_account");
}

export async function registerOnboardingSubscription(
    payload: OnboardingSubscriptionRequest,
): Promise<OnboardingSubscriptionResult> {
    return tauriInvoke("register_onboarding_subscription", { request: payload });
}

export async function clusterGetStatus(): Promise<ClusterStatusSnapshot> {
    return tauriInvoke("cluster_status_cmd");
}

export async function clusterPickActivationManifest(): Promise<string | null> {
    return tauriInvoke("pick_activation_manifest_file");
}

export async function clusterImportActivation(
    manifestPath: string,
    passphrase: string,
): Promise<ImportActivationResult> {
    return tauriInvoke("import_activation_manifest", { manifestPath, passphrase });
}

export async function clusterActivateLicense(licenseKey: string): Promise<ClusterStatusSnapshot> {
    return tauriInvoke("license_activate", { licenseKey });
}

export async function clusterDiscoverAdmins(): Promise<AdminEndpoint[]> {
    return tauriInvoke("cluster_discover_admins");
}

export async function clusterSendJoinRequest(
    requestedRole: "ADMIN" | "MEMBER",
    admin: JoinAdminTarget,
): Promise<JoinRequestResult> {
    const raw = await tauriInvoke<unknown>("cluster_send_join_request", {
        payload: {
            requestedRole,
            adminHost: admin.host,
            adminPort: admin.port,
            handshakeTranscriptB64: "",
        },
    });
    const handle = pairingHandleFromJoinPayload(raw);
    return {
        ...handle,
        handshakeTranscriptB64: handshakeTranscriptFromJoinPayload(raw),
    };
}

export async function clusterSubmitSas(
    handle: PairingHandle,
    digits: string,
    handshakeTranscriptB64: string,
): Promise<{ success: boolean; alreadyProvisioned: boolean }> {
    const resolved = pairingHandleFromJoinPayload(handle);
    return tauriInvoke("cluster_submit_sas", {
        payload: {
            handle: {
                sessionId: resolved.sessionId,
                fingerprint: resolved.fingerprint,
            },
            digits,
            // SAS is derived from the transcript stored at join, not this round-trip.
            handshakeTranscriptB64: handshakeTranscriptB64 || "",
        },
    });
}

export async function clusterStartListener(): Promise<void> {
    return tauriInvoke("cluster_start_listener");
}

export async function clusterListPending(): Promise<PendingRequest[]> {
    return tauriInvoke("cluster_list_pending");
}

export async function clusterAcceptRequest(
    id: string,
    replaceFingerprint?: string,
): Promise<{ digits: string }> {
    const raw = await tauriInvoke<unknown>("cluster_accept_request", {
        payload: {
            id,
            handshakeTranscriptB64: "",
            replaceFingerprint: replaceFingerprint ?? null,
        },
    });
    const digits = sasDigitsFromPayload(raw);
    if (!digits) {
        throw new Error("SAS digits missing from accept response");
    }
    return { digits };
}

function sasDigitsFromPayload(value: unknown): string | null {
    if (typeof value === "string") {
        const d = value.replace(/\D/g, "");
        return d.length === 4 ? d : null;
    }
    if (!value || typeof value !== "object") {
        return null;
    }
    const rec = value as Record<string, unknown>;
    for (const key of ["digits", "Digits"]) {
        const v = rec[key];
        if (typeof v === "string" && v.replace(/\D/g, "").length === 4) {
            return v.replace(/\D/g, "").slice(0, 4);
        }
    }
    return null;
}

export async function clusterReclaimDevice(fingerprint: string): Promise<void> {
    return tauriInvoke("cluster_reclaim_device", { fingerprint });
}

export async function clusterRejectRequest(id: string): Promise<void> {
    return tauriInvoke("cluster_reject_request", { id });
}

export async function clusterListDevices(): Promise<DeviceView[]> {
    return tauriInvoke("cluster_list_devices");
}

export async function clusterRevokeDevice(fingerprint: string): Promise<void> {
    return tauriInvoke("cluster_revoke_device", { fingerprint });
}

export async function clusterBlockDevice(fingerprint: string, reason: string): Promise<void> {
    return tauriInvoke("cluster_block_device", { fingerprint, reason });
}

export async function clusterUnblockDevice(fingerprint: string): Promise<void> {
    return tauriInvoke("cluster_unblock_device", { fingerprint });
}

export type ClusterResetMode = "network_only" | "full_wipe";

export type ClusterResetPreview = {
    clusterId?: string;
    memberDeviceCount: number;
    confirmPhraseHint: string;
    practiceSlug?: string;
};

export type ClusterResetReport = {
    mode: string;
    membersNotified: number;
    membersUnreachable: string[];
    requiresAppRestart: boolean;
};

export async function clusterClusterResetPreview(): Promise<ClusterResetPreview> {
    return tauriInvoke("cluster_cluster_reset_preview");
}

export type ClusterResetExecuteRequest = {
    mode: ClusterResetMode;
    password: string;
    confirmPhrase: string;
};

export async function clusterClusterResetExecute(
    request: ClusterResetExecuteRequest,
): Promise<ClusterResetReport> {
    return tauriInvoke("cluster_execute_cluster_reset", { request });
}
