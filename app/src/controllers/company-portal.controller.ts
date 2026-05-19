/**
 * IPC zum **MeDoc Hersteller-Portal** (Abonnement, Integrationen, Feature-Flags, Updates).
 * Server-Referenz: Binary `medoc-company-server` (Port 9797).
 */
import { tauriInvoke } from "@/services/tauri.service";

export type CompanyPortalConfig = {
    base_url: string;
    practice_slug: string;
    api_key: string;
};

export async function getCompanyPortalConfig(): Promise<CompanyPortalConfig> {
    return tauriInvoke<CompanyPortalConfig>("get_company_portal_config");
}

export async function setCompanyPortalConfig(config: CompanyPortalConfig): Promise<void> {
    return tauriInvoke("set_company_portal_config", { config });
}

export async function companyPortalFetchSummary(): Promise<Record<string, unknown>> {
    return tauriInvoke<Record<string, unknown>>("company_portal_fetch_summary");
}

export async function companyPortalFetchIntegrations(): Promise<Record<string, unknown>> {
    return tauriInvoke<Record<string, unknown>>("company_portal_fetch_integrations");
}

export async function companyPortalFetchFeatureFlags(): Promise<Record<string, unknown>> {
    return tauriInvoke<Record<string, unknown>>("company_portal_fetch_feature_flags");
}

export async function companyPortalBillingPortalUrl(): Promise<string> {
    return tauriInvoke<string>("company_portal_billing_portal_url");
}

/** @deprecated Prefer `attachPaymentMethod` from `system.controller` — führt dieselbe Remote-Anlage aus und schreibt ein Audit-Event. */
export async function companyPortalAttachPayment(providerToken: string): Promise<void> {
    return tauriInvoke("company_portal_attach_payment", { provider_token: providerToken });
}

export async function companyPortalPing(): Promise<Record<string, unknown>> {
    return tauriInvoke<Record<string, unknown>>("company_portal_ping");
}

export type DeviceSessionRow = {
    id: string;
    user_id: string;
    device_label: string;
    user_agent: string | null;
    created_at: string;
    last_seen_at: string;
    is_current: boolean;
};

export async function listMyDeviceSessions(): Promise<DeviceSessionRow[]> {
    return tauriInvoke<DeviceSessionRow[]>("list_my_device_sessions");
}

export async function revokeMyOtherDeviceSessions(): Promise<number> {
    return tauriInvoke<number>("revoke_my_other_device_sessions");
}
