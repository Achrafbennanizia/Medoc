/**
 * Company system — vendor portal (subscription, flags, billing). No clinical data.
 * Call `companySystem` in `@/systems/company-portal/adapters/tauri-company.adapter`.
 */

export type CompanyPortalConfig = {
    base_url: string;
    practice_slug: string;
    api_key: string;
};
