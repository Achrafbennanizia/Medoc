use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;

pub const COMPANY_PORTAL_KV_KEY: &str = "company.portal.config.v1";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CompanyPortalConfig {
    /// Basis-URL ohne abschließenden Slash, z. B. `https://portal.medoc.example`
    #[serde(default)]
    pub base_url: String,
    /// Praxis-/Mandanten-Slug beim Hersteller
    #[serde(default)]
    pub practice_slug: String,
    /// Bearer-Token oder API-Key (nur Praxis-seitig gespeichert — TLS erzwingen)
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

/// Effektive Basis-URL: `MEDOC_COMPANY_API_BASE` überschreibt app_kv (Betrieb / CI).
pub fn effective_base_url(cfg: &CompanyPortalConfig) -> Option<String> {
    let env = std::env::var("MEDOC_COMPANY_API_BASE").unwrap_or_default().trim().to_string();
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

pub fn require_callable(cfg: &CompanyPortalConfig) -> Result<(String, CompanyPortalConfig), AppError> {
    let base = effective_base_url(cfg).ok_or_else(|| {
        AppError::Validation(
            "Hersteller-Portal nicht konfiguriert — Basis-URL in Einstellungen oder MEDOC_COMPANY_API_BASE setzen."
                .into(),
        )
    })?;
    if effective_api_key(cfg).trim().is_empty() {
        return Err(AppError::Validation(
            "Hersteller-Portal: API-Schlüssel fehlt (Konfiguration oder MEDOC_COMPANY_API_KEY).".into(),
        ));
    }
    if cfg.practice_slug.trim().is_empty() {
        return Err(AppError::Validation(
            "Hersteller-Portal: practice_slug (Mandanten-ID) fehlt.".into(),
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
