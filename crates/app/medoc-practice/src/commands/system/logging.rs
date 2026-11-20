// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state))]
pub fn get_log_level(session_state: State<'_, SessionState>) -> Result<LogLevel, AppError> {
    rbac::require(&session_state, "ops.logs")?;
    Ok(LOGGING_CONFIG.level())
}

/// F137: device-local app_kv key (`logging.` is never synced).
pub const LOG_LEVEL_KV: &str = "logging.level.v1";

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, level))]
pub async fn set_log_level(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    level: LogLevel,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.logs")?;
    let prev = LOGGING_CONFIG.level();
    LOGGING_CONFIG.set_level(level);
    let raw = serde_json::to_string(&level).map_err(|e| AppError::Internal(e.to_string()))?;
    medoc_core::infrastructure::database::repos::admin::app_kv::set(&pool, LOG_LEVEL_KV, &raw)
        .await?;
    log_system!(info, event = "LOG_LEVEL_CHANGED", from = ?prev, to = ?level);
    Ok(())
}

/// F137: apply the stored level at startup (it used to reset on every restart).
pub async fn restore_log_level(pool: &SqlitePool) {
    if let Ok(Some(raw)) =
        medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, LOG_LEVEL_KV).await
    {
        if let Ok(level) = serde_json::from_str::<LogLevel>(&raw) {
            LOGGING_CONFIG.set_level(level);
        }
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn export_logs(session_state: State<'_, SessionState>) -> Result<Vec<u8>, AppError> {
    rbac::require(&session_state, "ops.logs")?;
    let zip = logging::export::export_to_vec(logging::log_dir()?)?;
    log_system!(info, event = "LOG_EXPORT", bytes = zip.len());
    Ok(zip)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn verify_audit_chain(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Option<String>, AppError> {
    rbac::require(&session_state, "ops.logs")?;
    let broken = audit_repo::verify_chain(&pool).await?;
    log_workflow!(
        info,
        event = "AUDIT_CHAIN_VERIFY",
        broken = broken.is_some()
    );
    Ok(broken)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn log_dir(session_state: State<'_, SessionState>) -> Result<String, AppError> {
    rbac::require(&session_state, "ops.logs")?;
    Ok(logging::log_dir()?.display().to_string())
}
