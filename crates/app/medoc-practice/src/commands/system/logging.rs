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
pub struct WorkflowLogEventInput {
    pub stage: String,
    pub action: String,
    pub route: Option<String>,
    pub status: Option<String>,
    pub correlation_id: Option<String>,
    pub message: Option<String>,
    pub meta: Option<serde_json::Value>,
}

fn sanitize_field(input: &str, max_len: usize) -> String {
    let clean = logging::sanitizer::sanitize(input.trim());
    if clean.len() <= max_len {
        return clean;
    }
    clean.chars().take(max_len).collect()
}

fn sanitize_optional_field(value: Option<String>, max_len: usize) -> Option<String> {
    value
        .map(|v| sanitize_field(&v, max_len))
        .filter(|v| !v.is_empty())
}

/// Sanitized workflow bridge from frontend -> backend log channel.
///
/// This command intentionally skips RBAC/session checks so login/onboarding
/// flows can emit route/action lifecycle traces before authentication.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEventInput) -> Result<(), AppError> {
    let stage = sanitize_field(&event.stage, 64);
    let action = sanitize_field(&event.action, 128);
    if stage.is_empty() || action.is_empty() {
        return Err(AppError::Validation(
            "workflow stage/action fehlt".to_string(),
        ));
    }

    let route = sanitize_optional_field(event.route, 256);
    let status = sanitize_optional_field(event.status, 64);
    let correlation_id = sanitize_optional_field(event.correlation_id, 128);
    let message = sanitize_optional_field(event.message, 256);
    let meta = event
        .meta
        .as_ref()
        .map(|m| sanitize_field(&m.to_string(), 1024))
        .unwrap_or_default();

    log_workflow!(
        info,
        event = "WORKFLOW_EVENT",
        workflow_stage = %stage,
        workflow_action = %action,
        route = route.as_deref().unwrap_or(""),
        status = status.as_deref().unwrap_or(""),
        correlation_id = correlation_id.as_deref().unwrap_or(""),
        message = message.as_deref().unwrap_or(""),
        meta = %meta,
    );
    Ok(())
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

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_logging_commands {
    () => {
        $crate::commands::logging_commands::log_workflow_event,
        $crate::commands::logging_commands::get_log_level,
        $crate::commands::logging_commands::set_log_level,
        $crate::commands::logging_commands::export_logs,
        $crate::commands::logging_commands::verify_audit_chain,
        $crate::commands::logging_commands::log_dir,
    };
}
