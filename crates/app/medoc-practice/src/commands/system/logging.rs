// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::log_system;
use crate::log_workflow;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogPayload {
    pub workflow: String,
    pub step: String,
    pub status: String,
    pub route: Option<String>,
    pub action: Option<String>,
    pub detail: Option<String>,
    pub source: Option<String>,
    pub timestamp: Option<String>,
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state))]
pub fn get_log_level(session_state: State<'_, SessionState>) -> Result<LogLevel, AppError> {
    rbac::require(&session_state, "ops.logs")?;
    Ok(LOGGING_CONFIG.level())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, level))]
pub fn set_log_level(
    session_state: State<'_, SessionState>,
    level: LogLevel,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.logs")?;
    let prev = LOGGING_CONFIG.level();
    LOGGING_CONFIG.set_level(level);
    log_system!(info, event = "LOG_LEVEL_CHANGED", from = ?prev, to = ?level);
    Ok(())
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
    audit_repo::verify_chain(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn log_dir(session_state: State<'_, SessionState>) -> Result<String, AppError> {
    rbac::require(&session_state, "ops.logs")?;
    Ok(logging::log_dir()?.display().to_string())
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state, payload))]
pub fn workflow_log_step(
    session_state: State<'_, SessionState>,
    payload: WorkflowLogPayload,
) -> Result<(), AppError> {
    let user_id = {
        let guard = session_state.lock_session();
        guard
            .as_ref()
            .map(|(session, _)| session.user_id.clone())
            .unwrap_or_else(|| "anonymous".to_string())
    };
    let workflow = logging::sanitizer::sanitize(&payload.workflow);
    let step = logging::sanitizer::sanitize(&payload.step);
    let status = logging::sanitizer::sanitize(&payload.status);
    let route = payload
        .route
        .as_deref()
        .map(logging::sanitizer::sanitize)
        .unwrap_or_default();
    let action = payload
        .action
        .as_deref()
        .map(logging::sanitizer::sanitize)
        .unwrap_or_default();
    let detail = payload
        .detail
        .as_deref()
        .map(logging::sanitizer::sanitize)
        .unwrap_or_default();
    let source = payload
        .source
        .as_deref()
        .map(logging::sanitizer::sanitize)
        .unwrap_or_else(|| "frontend".to_string());
    let timestamp = payload
        .timestamp
        .as_deref()
        .map(logging::sanitizer::sanitize)
        .unwrap_or_default();
    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        user_id = %user_id,
        workflow = %workflow,
        step = %step,
        status = %status,
        route = %route,
        action = %action,
        detail = %detail,
        source = %source,
        timestamp = %timestamp,
    );
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_logging_commands {
    () => {
        $crate::commands::logging_commands::get_log_level,
        $crate::commands::logging_commands::set_log_level,
        $crate::commands::logging_commands::export_logs,
        $crate::commands::logging_commands::verify_audit_chain,
        $crate::commands::logging_commands::log_dir,
        $crate::commands::logging_commands::workflow_log_step,
    };
}
