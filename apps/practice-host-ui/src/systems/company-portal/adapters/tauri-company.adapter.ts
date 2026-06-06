import { tauriInvoke } from "@/systems/shared/transport/tauri-transport";
import type { CompanyPortalConfig } from "@/systems/company-portal/controllers/company-portal.controller";
import type { CompanySystemPort } from "@/systems/company-portal/ports/company-system.port";

export class TauriCompanyAdapter implements CompanySystemPort {
    getConfig() {
        return tauriInvoke<CompanyPortalConfig>("get_company_portal_config");
    }
    async setConfig(config: CompanyPortalConfig): Promise<void> {
        await tauriInvoke("set_company_portal_config", { config });
    }
    fetchSummary() {
        return tauriInvoke<Record<string, unknown>>("company_portal_fetch_summary");
    }
    fetchIntegrations() {
        return tauriInvoke<Record<string, unknown>>("company_portal_fetch_integrations");
    }
    fetchFeatureFlags() {
        return tauriInvoke<Record<string, unknown>>("company_portal_fetch_feature_flags");
    }
    billingPortalUrl() {
        return tauriInvoke<string>("company_portal_billing_portal_url");
    }
    async attachPayment(providerToken: string): Promise<void> {
        await tauriInvoke("company_portal_attach_payment", { provider_token: providerToken });
    }
    ping() {
        return tauriInvoke<Record<string, unknown>>("company_portal_ping");
    }
}

export const companySystem: CompanySystemPort = new TauriCompanyAdapter();
