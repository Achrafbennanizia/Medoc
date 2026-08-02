use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;

pub const COMPANY_PORTAL_KV_KEY: &str = "company.portal.config.v1";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompanyPortalConfig {
    /// Base URL without trailing slash, e.g. `https://portal.medoc.example`
    #[serde(default)]
    pub base_url: String,
    /// Practice/tenant slug at the vendor
    #[serde(default)]
    pub practice_slug: String,
    /// Bearer token or API key (stored on the practice side only — enforce TLS)
    #[serde(default)]
    pub api_key: String,
}

pub async fn load_company_portal_config(pool: &SqlitePool) -> CompanyPortalConfig {
    if let Ok(Some(raw)) = app_kv_repo::get(pool, COMPANY_PORTAL_KV_KEY).await {
        if let Ok(c) = serde_json::from_str::<CompanyPortalConfig>(&raw) {
            return c;
        }
    }
    CompanyPortalConfig::default()
}

/// Effective base URL: `MEDOC_COMPANY_API_BASE` overrides app_kv (ops / CI).
pub fn effective_base_url(cfg: &CompanyPortalConfig) -> Option<String> {
    let env = std::env::var("MEDOC_COMPANY_API_BASE")
        .unwrap_or_default()
        .trim()
        .to_string();
    if !env.is_empty() {
        return Some(env.trim_end_matches('/').to_string());
    }
    let u = cfg.base_url.trim().trim_end_matches('/').to_string();
    if u.is_empty() {
        None
    } else {
        Some(u)
    }
}

pub fn require_callable(
    cfg: &CompanyPortalConfig,
) -> Result<(String, CompanyPortalConfig), AppError> {
    let base = effective_base_url(cfg).ok_or_else(|| {
        AppError::Validation(
            "Vendor portal not configured — set base URL in settings or MEDOC_COMPANY_API_BASE."
                .into(),
        )
    })?;
    if effective_api_key(cfg).trim().is_empty() {
        return Err(AppError::Validation(
            "Vendor portal: API key missing (configuration or MEDOC_COMPANY_API_KEY)."
                .into(),
        ));
    }
    if cfg.practice_slug.trim().is_empty() {
        return Err(AppError::Validation(
            "Vendor portal: practice_slug (tenant id) is missing.".into(),
        ));
    }
    Ok((base, cfg.clone()))
}

pub fn effective_api_key(cfg: &CompanyPortalConfig) -> String {
    let env = std::env::var("MEDOC_COMPANY_API_KEY").unwrap_or_default();
    if !env.trim().is_empty() {
        return env.trim().to_string();
    }
    cfg.api_key.trim().to_string()
}

/// Default vendor portal URL for local dev onboarding (company server).
pub fn default_onboarding_base_url() -> String {
    std::env::var("MEDOC_COMPANY_API_BASE")
        .unwrap_or_else(|_| "http://127.0.0.1:9797".into())
        .trim()
        .trim_end_matches('/')
        .to_string()
}

pub fn is_portal_configured(cfg: &CompanyPortalConfig) -> bool {
    !cfg.practice_slug.trim().is_empty() && !effective_api_key(cfg).trim().is_empty()
}
