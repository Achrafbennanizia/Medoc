import { tauriInvoke } from "@/services/tauri.service";

export interface LicenseStatus {
    valid: boolean;
    reason: string | null;
    license: {
        customer_id: string;
        edition: string;
        issued_at: string;
        expires_at: string;
        max_users: number;
        modules: string[];
    } | null;
    days_until_expiry: number | null;
}

export interface UpdateInfo {
    current_version: string;
    latest_version: string;
    update_available: boolean;
    channel: string;
}

export const verifyLicense = (token: string) =>
    tauriInvoke<LicenseStatus>("verify_license", { token });

export const checkForUpdates = () =>
    tauriInvoke<UpdateInfo>("check_for_updates");

export const changePassword = (oldPassword: string, newPassword: string) =>
    tauriInvoke<void>("change_password", { oldPassword, newPassword });

export interface SubscriptionPortal {
    url: string;
    provider: string;
    note: string;
}

export const openSubscriptionPortal = () =>
    tauriInvoke<SubscriptionPortal>("open_subscription_portal");

export const getPerfThresholdMs = () => tauriInvoke<number>("get_perf_threshold_ms");

export const setPerfThresholdMs = (ms: number) =>
    tauriInvoke<void>("set_perf_threshold_ms", { ms });

export interface HealthCheck {
    db_ok: boolean;
    db_latency_ms: number;
    audit_chain_ok: boolean;
    audit_broken_at: string | null;
    log_dir_writable: boolean;
    version: string;
}

export const systemHealthCheck = () =>
    tauriInvoke<HealthCheck>("system_health_check");
