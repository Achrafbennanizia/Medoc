/**
 * Company system — vendor portal (subscription, flags, billing). No clinical data.
 * @see `app/src-tauri/src/systems/company/` and binary `medoc-company-server`.
 */
import { companySystem } from "@/systems/company-portal/adapters/tauri-company.adapter";

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

export type {
    DeviceSessionAuditEntry,
    DeviceSessionInvestigation,
    DeviceSessionRow,
} from "@/systems/practice-host/controllers/device-session.controller";
export {
    investigateMyDeviceSession,
    listMyDeviceSessions,
    revokeMyDeviceSession,
    revokeMyOtherDeviceSessions,
    setMyDeviceSessionTrusted,
} from "@/systems/practice-host/controllers/device-session.controller";
