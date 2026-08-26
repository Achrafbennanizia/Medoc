// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use sqlx::SqlitePool;
use serde::Deserialize;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEventPayload {
    pub step: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub arg_keys: Vec<String>,
}

fn sanitize_optional(input: Option<String>) -> Option<String> {
    let trimmed = input.map(|s| s.trim().to_string())?;
    if trimmed.is_empty() {
        None
    } else {
        Some(logging::sanitizer::sanitize(&trimmed))
    }
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

/// Frontend→backend workflow telemetry bridge.
/// Event payload is sanitised before it reaches tracing/file sinks.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(payload))]
pub fn log_workflow_event(payload: WorkflowEventPayload) -> Result<(), AppError> {
    let step_raw = payload.step.trim();
    if step_raw.is_empty() {
        return Err(AppError::Validation("workflow step missing".into()));
    }
    let step = logging::sanitizer::sanitize(step_raw);
    let route = sanitize_optional(payload.route);
    let action = sanitize_optional(payload.action);
    let status = sanitize_optional(payload.status);
    let command = sanitize_optional(payload.command);
    let detail = sanitize_optional(payload.detail);
    let mut arg_keys: Vec<String> = payload
        .arg_keys
        .into_iter()
        .map(|k| logging::sanitizer::sanitize(k.trim()))
        .filter(|k| !k.is_empty())
        .collect();
    if arg_keys.len() > 64 {
        arg_keys.truncate(64);
    }

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        step = %step,
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        status = status.as_deref().unwrap_or(""),
        command = command.as_deref().unwrap_or(""),
        detail = detail.as_deref().unwrap_or(""),
        arg_keys = ?arg_keys,
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
