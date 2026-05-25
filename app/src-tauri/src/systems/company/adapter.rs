//! **Adapter** — maps [`CompanyPortalPort`] to `reqwest` HTTP (`infrastructure::company_portal::client`).

use serde_json::Value;

use crate::error::AppError;
use crate::infrastructure::company_portal::client;
use crate::infrastructure::company_portal::CompanyPortalConfig;

use super::port::CompanyPortalPort;

/// Default production adapter for the Company system HTTP API.
#[derive(Debug, Default, Clone, Copy)]
pub struct CompanyPortalHttpAdapter;

impl CompanyPortalPort for CompanyPortalHttpAdapter {
    async fn fetch_subscription_summary(
        &self,
        cfg: &CompanyPortalConfig,
    ) -> Result<Value, AppError> {
        client::fetch_subscription_summary(cfg).await
    }

    async fn fetch_integration_statuses(
        &self,
        cfg: &CompanyPortalConfig,
    ) -> Result<Value, AppError> {
        client::fetch_integration_statuses(cfg).await
    }

    async fn fetch_feature_flags(&self, cfg: &CompanyPortalConfig) -> Result<Value, AppError> {
        client::fetch_feature_flags(cfg).await
    }

    async fn fetch_update_manifest(
        &self,
        cfg: &CompanyPortalConfig,
        current: &str,
    ) -> Result<Value, AppError> {
        client::fetch_update_manifest(cfg, current).await
    }

    async fn post_billing_portal_url(&self, cfg: &CompanyPortalConfig) -> Result<String, AppError> {
        client::post_billing_portal_url(cfg).await
    }

    async fn attach_payment_method(
        &self,
        cfg: &CompanyPortalConfig,
        provider_token: &str,
    ) -> Result<(), AppError> {
        client::attach_payment_method_remote(cfg, provider_token).await
    }
}

/// **Singleton** — shared adapter instance for LAN proxy + Tauri commands.
pub static COMPANY_PORTAL: CompanyPortalHttpAdapter = CompanyPortalHttpAdapter;
