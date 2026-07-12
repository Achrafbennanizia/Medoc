//! HTTP-Client zum **MeDoc Hersteller-Portal** (Abonnement, Lizenzmetriken, Feature-Flags).
//! Konfiguration: `app_kv` Schlüssel `company.portal.config.v1` (JSON) oder Umgebungsvariable `MEDOC_COMPANY_API_BASE`.

pub mod client;
pub mod config;

pub use client::{
    attach_payment_method_remote, fetch_feature_flags, fetch_integration_statuses,
    fetch_subscription_summary, fetch_update_manifest, post_billing_portal_url,
    register_practice_onboarding,
};
pub use config::{load_company_portal_config, CompanyPortalConfig};
