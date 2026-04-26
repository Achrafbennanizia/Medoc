// License & update commands.

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::license::{self, LicenseStatus};
use crate::infrastructure::perf;
use crate::log_system;
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, token))]
pub fn verify_license(
    session_state: State<'_, SessionState>,
    token: String,
) -> Result<LicenseStatus, AppError> {
    rbac::require_authenticated(&session_state)?;
    let status = license::verify(&token);
    log_system!(
        info,
        event = "LICENSE_CHECK",
        valid = status.valid,
        reason = status.reason.as_deref().unwrap_or(""),
    );
    Ok(status)
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state))]
pub fn get_perf_threshold_ms(session_state: State<'_, SessionState>) -> Result<u64, AppError> {
    rbac::require(&session_state, "ops.system")?;
    Ok(perf::threshold_ms())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn set_perf_threshold_ms(
    session_state: State<'_, SessionState>,
    ms: u64,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.system")?;
    let ms = ms.max(1);
    perf::set_threshold_ms(ms);
    log_system!(info, event = "PERF_THRESHOLD_CHANGED", ms);
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub channel: String,
}

/// Stub: in production this would query an HTTPS update server with a signed
/// manifest. For now returns "no update available" but exercises the logging
/// path so the contract is in place.
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn check_for_updates(session_state: State<'_, SessionState>) -> Result<UpdateInfo, AppError> {
    rbac::require_authenticated(&session_state)?;
    let current = env!("CARGO_PKG_VERSION").to_string();
    log_system!(info, event = "UPDATE_CHECK", current_version = %current);
    Ok(UpdateInfo {
        current_version: current.clone(),
        latest_version: current,
        update_available: false,
        channel: "stable".to_string(),
    })
}

#[derive(Debug, Serialize)]
pub struct HealthCheck {
    pub db_ok: bool,
    pub db_latency_ms: u128,
    pub audit_chain_ok: bool,
    pub audit_broken_at: Option<String>,
    pub log_dir_writable: bool,
    pub version: String,
}

/// Run a self-test over the critical subsystems: database connectivity,
/// audit-chain integrity, log directory writability. Used by the Ops UI
/// and — per ISO 13485 §7.5.1 — service engineers.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn system_health_check(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<HealthCheck, AppError> {
    rbac::require(&session_state, "ops.system")?;

    let t0 = std::time::Instant::now();
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(pool.inner())
        .await
        .is_ok();
    let db_latency_ms = t0.elapsed().as_millis();

    let audit_broken_at = audit_repo::verify_chain(&pool).await.ok().flatten();
    let audit_chain_ok = audit_broken_at.is_none();

    let log_dir = dirs::home_dir()
        .map(|h| h.join("medoc-data").join("logs"))
        .unwrap_or_else(|| std::path::PathBuf::from("./logs"));
    let log_dir_writable = std::fs::create_dir_all(&log_dir)
        .and_then(|_| {
            let probe = log_dir.join(".health-probe");
            std::fs::write(&probe, b"ok")?;
            std::fs::remove_file(&probe)?;
            Ok(())
        })
        .is_ok();

    log_system!(
        info,
        event = "HEALTH_CHECK",
        db_ok,
        db_latency_ms = db_latency_ms as u64,
        audit_chain_ok,
        log_dir_writable,
    );

    Ok(HealthCheck {
        db_ok,
        db_latency_ms,
        audit_chain_ok,
        audit_broken_at,
        log_dir_writable,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}
