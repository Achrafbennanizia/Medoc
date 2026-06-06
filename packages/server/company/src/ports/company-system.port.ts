import type { CompanyPortalConfig } from "../controllers/company-portal.controller";

/** Company (vendor) system port — subscription, flags, billing (never touches medoc.db). */
export interface CompanySystemPort {
    getConfig(): Promise<CompanyPortalConfig>;
    setConfig(config: CompanyPortalConfig): Promise<void>;
    fetchSummary(): Promise<Record<string, unknown>>;
    fetchIntegrations(): Promise<Record<string, unknown>>;
    fetchFeatureFlags(): Promise<Record<string, unknown>>;
    billingPortalUrl(): Promise<string>;
    attachPayment(providerToken: string): Promise<void>;
    ping(): Promise<Record<string, unknown>>;
}
