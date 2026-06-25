// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEvent {
    pub workflow: Option<String>,
    pub step: String,
    pub route: Option<String>,
    pub action: Option<String>,
    pub status: Option<String>,
    pub message: Option<String>,
    pub error: Option<String>,
}

fn sanitize_opt(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return None;
        }
        Some(crate::infrastructure::logging::sanitizer::sanitize(trimmed))
    })
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
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEvent) -> Result<(), AppError> {
    let step = crate::infrastructure::logging::sanitizer::sanitize(event.step.trim());
    if step.is_empty() {
        return Err(AppError::Validation("workflow step fehlt".into()));
    }
    let workflow = sanitize_opt(event.workflow).unwrap_or_else(|| "ui".to_string());
    let route = sanitize_opt(event.route).unwrap_or_default();
    let action = sanitize_opt(event.action).unwrap_or_default();
    let status = sanitize_opt(event.status).unwrap_or_default();
    let message = sanitize_opt(event.message).unwrap_or_default();
    let error = sanitize_opt(event.error).unwrap_or_default();
    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        workflow = workflow.as_str(),
        step = step.as_str(),
        route = route.as_str(),
        action = action.as_str(),
        status = status.as_str(),
        message = message.as_str(),
        error = error.as_str(),
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
        $crate::commands::logging_commands::log_workflow_event,
    };
}
