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

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowPhase {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowPhase {
    fn as_str(self) -> &'static str {
        match self {
            WorkflowPhase::RouteEnter => "route_enter",
            WorkflowPhase::PrimaryAction => "primary_action",
            WorkflowPhase::Success => "success",
            WorkflowPhase::Cancel => "cancel",
            WorkflowPhase::Error => "error",
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct WorkflowLogEvent {
    pub phase: WorkflowPhase,
    pub route: Option<String>,
    pub action: Option<String>,
    pub status: Option<String>,
    pub detail: Option<String>,
}

fn sanitize_opt(input: Option<String>) -> Option<String> {
    input.map(|value| logging::sanitizer::sanitize(&value))
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEvent) -> Result<(), AppError> {
    let route = sanitize_opt(event.route);
    let action = sanitize_opt(event.action);
    let status = sanitize_opt(event.status);
    let detail = sanitize_opt(event.detail);

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        phase = event.phase.as_str(),
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        status = status.as_deref().unwrap_or(""),
        detail = detail.as_deref().unwrap_or("")
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

#[cfg(test)]
mod tests {
    use super::{log_workflow_event, sanitize_opt, WorkflowLogEvent, WorkflowPhase};

    #[test]
    fn sanitize_opt_masks_tokens() {
        let out =
            sanitize_opt(Some("password=hunter2 token=abc123".to_string())).expect("sanitized");
        assert!(out.contains("password=***"));
        assert!(out.contains("token=***"));
        assert!(!out.contains("hunter2"));
    }

    #[test]
    fn workflow_event_command_accepts_payload() {
        let event = WorkflowLogEvent {
            phase: WorkflowPhase::RouteEnter,
            route: Some("/patients/12345?name=alice".to_string()),
            action: Some("route_change".to_string()),
            status: None,
            detail: Some("password=abc".to_string()),
        };
        assert!(log_workflow_event(event).is_ok());
    }
}
