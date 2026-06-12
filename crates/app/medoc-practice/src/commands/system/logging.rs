// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEventInput {
    pub event: String,
    pub source: Option<String>,
    pub workflow: Option<String>,
    pub route: Option<String>,
    pub action: Option<String>,
    pub status: Option<String>,
    pub command: Option<String>,
    pub detail: Option<String>,
    pub error: Option<String>,
}

fn sanitize_required(value: String) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation("Workflow-Event fehlt".into()));
    }
    Ok(logging::sanitizer::sanitize(trimmed))
}

fn sanitize_optional(value: Option<String>) -> Option<String> {
    value
        .map(|v| logging::sanitizer::sanitize(v.trim()))
        .filter(|v| !v.is_empty())
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

/// Frontend → backend workflow event bridge.
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, input))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    input: WorkflowLogEventInput,
) -> Result<(), AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let event = sanitize_required(input.event)?;
    let source = sanitize_optional(input.source).unwrap_or_else(|| "frontend".to_string());
    let workflow = sanitize_optional(input.workflow).unwrap_or_else(|| "ui".to_string());
    let route = sanitize_optional(input.route).unwrap_or_else(|| "-".to_string());
    let action = sanitize_optional(input.action).unwrap_or_else(|| "-".to_string());
    let status = sanitize_optional(input.status).unwrap_or_else(|| "-".to_string());
    let command = sanitize_optional(input.command).unwrap_or_else(|| "-".to_string());
    let detail = sanitize_optional(input.detail).unwrap_or_else(|| "-".to_string());
    let error = sanitize_optional(input.error).unwrap_or_else(|| "-".to_string());

    log_workflow!(
        info,
        event = %event,
        source = %source,
        workflow = %workflow,
        route = %route,
        action = %action,
        status = %status,
        command = %command,
        detail = %detail,
        error = %error,
        actor_user_id = %session.user_id,
        actor_role = %session.rolle,
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
