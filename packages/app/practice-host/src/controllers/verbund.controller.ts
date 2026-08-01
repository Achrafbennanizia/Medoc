import { tauriInvoke } from "@/services/tauri.service";

import type { VerbundStatusSnapshot } from "@/models/store/verbund-store";

export type AdminEndpoint = {
    host: string;
    port: number;
    instanceName: string;
};

export type JoinAdminTarget = {
    host: string;
    port: number;
};

export type JoinRequestResult = KopplungHandle & {
    handshakeTranscriptB64: string;
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

export type ImportActivationResult = {
    status: VerbundStatusSnapshot;
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
    personalCount: number;
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
    rolle?: "ARZT" | "REZEPTION";
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

export async function verbundGetStatus(): Promise<VerbundStatusSnapshot> {
    return tauriInvoke("verbund_status_cmd");
}

export async function verbundPickActivationManifest(): Promise<string | null> {
    return tauriInvoke("pick_activation_manifest_file");
}

export async function verbundImportActivation(
    manifestPath: string,
    passphrase: string,
): Promise<ImportActivationResult> {
    return tauriInvoke("import_activation_manifest", { manifestPath, passphrase });
}

export async function verbundActivateLicense(licenseKey: string): Promise<VerbundStatusSnapshot> {
    return tauriInvoke("lizenz_activate", { licenseKey });
}

export async function verbundDiscoverAdmins(): Promise<AdminEndpoint[]> {
    return tauriInvoke("verbund_discover_admins");
}

export async function verbundSendJoinRequest(
    requestedRole: "ADMIN" | "MEMBER",
    admin: JoinAdminTarget,
): Promise<JoinRequestResult> {
    return tauriInvoke("verbund_send_join_request", {
        payload: {
            requestedRole,
            adminHost: admin.host,
            adminPort: admin.port,
            handshakeTranscriptB64: "",
        },
    });
}

export async function verbundSubmitSas(
    handle: KopplungHandle,
    digits: string,
    handshakeTranscriptB64: string,
): Promise<{ success: boolean; alreadyProvisioned: boolean }> {
    return tauriInvoke("verbund_submit_sas", {
        payload: { handle, digits, handshakeTranscriptB64 },
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

export async function verbundClusterResetPreview(): Promise<ClusterResetPreview> {
    return tauriInvoke("verbund_cluster_reset_preview");
}

export type ClusterResetExecuteRequest = {
    mode: ClusterResetMode;
    password: string;
    confirmPhrase: string;
};

export async function verbundClusterResetExecute(
    request: ClusterResetExecuteRequest,
): Promise<ClusterResetReport> {
    return tauriInvoke("verbund_execute_cluster_reset", { request });
}
