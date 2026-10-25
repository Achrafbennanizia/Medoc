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
pub struct WorkflowEventArgs {
    pub phase: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub duration_ms: Option<u64>,
}

fn sanitize_workflow_field(raw: Option<&str>, max_chars: usize) -> Option<String> {
    let value = raw.map(str::trim).filter(|s| !s.is_empty())?;
    let redacted = crate::infrastructure::logging::sanitizer::sanitize(value);
    Some(redacted.chars().take(max_chars).collect())
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

#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowEventArgs) -> Result<(), AppError> {
    let phase = sanitize_workflow_field(Some(&event.phase), 48).unwrap_or_else(|| "unknown".into());
    let route = sanitize_workflow_field(event.route.as_deref(), 256);
    let action = sanitize_workflow_field(event.action.as_deref(), 128);
    let status = sanitize_workflow_field(event.status.as_deref(), 48);
    let detail = sanitize_workflow_field(event.detail.as_deref(), 512);
    let duration_ms = event.duration_ms.unwrap_or_default();

    log_workflow!(
        info,
        event = "UI_WORKFLOW",
        phase = %phase,
        route = ?route,
        action = ?action,
        status = ?status,
        detail = ?detail,
        duration_ms
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
