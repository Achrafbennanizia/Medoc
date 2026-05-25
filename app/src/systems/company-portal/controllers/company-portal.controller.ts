/**
 * Company system — vendor portal (subscription, flags, billing). No clinical data.
 * @see `app/src-tauri/src/systems/company/` and binary `medoc-company-server`.
 */
import { practiceSystem } from "@/systems/practice-host/adapters/tauri-practice.adapter";
import { companySystem } from "../adapters/tauri-company.adapter";

export type CompanyPortalConfig = {
    base_url: string;
    practice_slug: string;
    api_key: string;
};

export async function getCompanyPortalConfig(): Promise<CompanyPortalConfig> {
    return companySystem.getConfig();
}

export async function setCompanyPortalConfig(config: CompanyPortalConfig): Promise<void> {
    return companySystem.setConfig(config);
}

export async function companyPortalFetchSummary(): Promise<Record<string, unknown>> {
    return companySystem.fetchSummary();
}

export async function companyPortalFetchIntegrations(): Promise<Record<string, unknown>> {
    return companySystem.fetchIntegrations();
}

export async function companyPortalFetchFeatureFlags(): Promise<Record<string, unknown>> {
    return companySystem.fetchFeatureFlags();
}

export async function companyPortalBillingPortalUrl(): Promise<string> {
    return companySystem.billingPortalUrl();
}

/** @deprecated Prefer `attachPaymentMethod` from practice `system.controller`. */
export async function companyPortalAttachPayment(providerToken: string): Promise<void> {
    return companySystem.attachPayment(providerToken);
}

export async function companyPortalPing(): Promise<Record<string, unknown>> {
    return companySystem.ping();
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

/** Practice-host IPC — device sessions belong to auth, not company DB. */
export async function listMyDeviceSessions(): Promise<DeviceSessionRow[]> {
    return practiceSystem.invoke<DeviceSessionRow[]>("list_my_device_sessions");
}

export async function revokeMyOtherDeviceSessions(): Promise<number> {
    return practiceSystem.invoke<number>("revoke_my_other_device_sessions");
}
