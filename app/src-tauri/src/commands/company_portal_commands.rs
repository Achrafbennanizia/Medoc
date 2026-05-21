//! Hersteller-Portal-Konfiguration (nur `ops.system` — enthält API-Schlüssel).
use serde_json::{json, Value};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::company_portal::config::{
    load_company_portal_config, CompanyPortalConfig, COMPANY_PORTAL_KV_KEY,
};
use crate::infrastructure::company_portal::{
    attach_payment_method_remote, fetch_feature_flags, fetch_integration_statuses,
    fetch_subscription_summary, fetch_update_manifest, post_billing_portal_url,
};
use crate::infrastructure::database::app_kv_repo;

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_company_portal_config(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<CompanyPortalConfig, AppError> {
    rbac::require(&session_state, "ops.system")?;
    Ok(load_company_portal_config(&pool).await)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, config))]
pub async fn set_company_portal_config(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    config: CompanyPortalConfig,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.system")?;
    let raw = serde_json::to_string(&config).map_err(|e| AppError::Internal(e.to_string()))?;
    app_kv_repo::set(&pool, COMPANY_PORTAL_KV_KEY, &raw).await
}

#[tauri::command]
pub async fn company_portal_fetch_summary(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Value, AppError> {
    rbac::require_authenticated(&session_state)?;
    let cfg = load_company_portal_config(&pool).await;
    fetch_subscription_summary(&cfg).await
}

#[tauri::command]
pub async fn company_portal_fetch_integrations(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Value, AppError> {
    rbac::require_authenticated(&session_state)?;
    let cfg = load_company_portal_config(&pool).await;
    fetch_integration_statuses(&cfg).await
}

#[tauri::command]
pub async fn company_portal_fetch_feature_flags(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Value, AppError> {
    rbac::require_authenticated(&session_state)?;
    let cfg = load_company_portal_config(&pool).await;
    fetch_feature_flags(&cfg).await
}

#[tauri::command]
pub async fn company_portal_billing_portal_url(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<String, AppError> {
    rbac::require(&session_state, "ops.system")?;
    let cfg = load_company_portal_config(&pool).await;
    post_billing_portal_url(&cfg).await
}

#[tauri::command]
pub async fn company_portal_attach_payment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    provider_token: String,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.system")?;
    let cfg = load_company_portal_config(&pool).await;
    attach_payment_method_remote(&cfg, &provider_token).await
}

/// Für `check_for_updates` — liefert JSON wie `UpdateInfo` oder Fehler.
#[tauri::command]
pub async fn company_portal_fetch_update_manifest(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    current_version: String,
) -> Result<Value, AppError> {
    rbac::require_authenticated(&session_state)?;
    let cfg = load_company_portal_config(&pool).await;
    fetch_update_manifest(&cfg, &current_version).await
}

/// Verbindungsprobe (ohne sensible Daten im Fehlerfall außer HTTP-Status).
#[tauri::command]
pub async fn company_portal_ping(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Value, AppError> {
    rbac::require(&session_state, "ops.system")?;
    let cfg = load_company_portal_config(&pool).await;
    match crate::infrastructure::company_portal::config::effective_base_url(&cfg) {
        None => Ok(json!({ "ok": false, "reason": "no_base_url" })),
        Some(base) => {
            let c = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .map_err(|e| AppError::Internal(e.to_string()))?;
            let url = format!("{base}/v1/health");
            let res = c.get(&url).send().await;
            match res {
                Ok(r) if r.status().is_success() => {
                    let http = r.status().as_u16();
                    let body: Value = r.json().await.unwrap_or_else(|_| json!({}));
                    let mut out = json!({ "ok": true, "http": http });
                    if let Some(demo) = body.get("_demo") {
                        out["_demo"] = demo.clone();
                    }
                    Ok(out)
                }
                Ok(r) => Ok(json!({ "ok": false, "http": r.status().as_u16() })),
                Err(e) => Ok(json!({ "ok": false, "error": e.to_string() })),
            }
        }
    }
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_company_portal_commands {
    () => {
        $crate::commands::company_portal_commands::get_company_portal_config,
        $crate::commands::company_portal_commands::set_company_portal_config,
        $crate::commands::company_portal_commands::company_portal_fetch_summary,
        $crate::commands::company_portal_commands::company_portal_fetch_integrations,
        $crate::commands::company_portal_commands::company_portal_fetch_feature_flags,
        $crate::commands::company_portal_commands::company_portal_billing_portal_url,
        $crate::commands::company_portal_commands::company_portal_attach_payment,
        $crate::commands::company_portal_commands::company_portal_fetch_update_manifest,
        $crate::commands::company_portal_commands::company_portal_ping,
    };
}
