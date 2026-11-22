use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::infrastructure::database::repos::admin::app_kv as app_kv_repo;

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

/// Vendor URL the API key may be sent to. `https` with a host, or `http` on loopback
/// for the local company server.
pub fn require_vendor_base_url(raw: &str) -> Result<String, AppError> {
    let url = raw.trim().trim_end_matches('/');
    if url.is_empty() {
        return Err(AppError::Validation("Vendor portal URL is empty.".into()));
    }
    let Some((scheme, rest)) = url.split_once("://") else {
        return Err(AppError::Validation(
            "Vendor portal URL must use https.".into(),
        ));
    };
    if rest.is_empty() || rest.starts_with('/') {
        return Err(AppError::Validation(
            "Vendor portal URL is missing a host.".into(),
        ));
    }
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    if authority.contains('@') || authority.is_empty() {
        return Err(AppError::Validation(
            "Vendor portal URL must not include credentials.".into(),
        ));
    }
    let host = if let Some(inner) = authority.strip_prefix('[') {
        inner.split(']').next().unwrap_or("")
    } else {
        authority.split(':').next().unwrap_or("")
    };
    if host.is_empty() {
        return Err(AppError::Validation(
            "Vendor portal URL is missing a host.".into(),
        ));
    }
    let loopback = matches!(host, "localhost" | "127.0.0.1" | "::1");
    let allowed =
        scheme.eq_ignore_ascii_case("https") || (scheme.eq_ignore_ascii_case("http") && loopback);
    if !allowed {
        return Err(AppError::Validation(
            "Vendor portal URL must use https.".into(),
        ));
    }
    Ok(url.to_string())
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
    let base = require_vendor_base_url(&base)?;
    if effective_api_key(cfg).trim().is_empty() {
        return Err(AppError::Validation(
            "Vendor portal: API key missing (configuration or MEDOC_COMPANY_API_KEY).".into(),
        ));
    }
    if cfg.practice_slug.trim().is_empty() {
        return Err(AppError::Validation(
            "Vendor portal: practice_slug (tenant id) is missing.".into(),
        ));
    }
    Ok((base, cfg.clone()))
}

/// Prefix of the placeholder key written by offline (USB) onboarding.
pub const LOCAL_STUB_KEY_PREFIX: &str = "local-";

/// F134: an offline onboarding stub (`local-…`) is not a vendor key.
pub fn effective_api_key(cfg: &CompanyPortalConfig) -> String {
    let env = std::env::var("MEDOC_COMPANY_API_KEY").unwrap_or_default();
    if !env.trim().is_empty() {
        return env.trim().to_string();
    }
    let key = cfg.api_key.trim();
    if key.starts_with(LOCAL_STUB_KEY_PREFIX) {
        return String::new();
    }
    key.to_string()
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

#[cfg(test)]
mod tests {
    use super::require_vendor_base_url;

    #[test]
    fn vendor_url_accepts_https_and_loopback_http_only() {
        assert_eq!(
            require_vendor_base_url("https://portal.example/").unwrap(),
            "https://portal.example"
        );
        assert_eq!(
            require_vendor_base_url("http://127.0.0.1:9797").unwrap(),
            "http://127.0.0.1:9797"
        );
        assert!(require_vendor_base_url("http://portal.example").is_err());
        assert!(require_vendor_base_url("https://user:secret@portal.example").is_err());
        assert!(require_vendor_base_url("portal.example").is_err());
    }
}
