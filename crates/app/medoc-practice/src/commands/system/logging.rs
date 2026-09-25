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
pub struct WorkflowLogEvent {
    pub workflow: String,
    pub step: String,
    pub status: Option<String>,
    pub route: Option<String>,
    pub action: Option<String>,
    pub message: Option<String>,
}

fn sanitize_workflow_value(raw: &str) -> String {
    const MAX_FIELD_LEN: usize = 200;
    let trimmed = raw.trim();
    let bounded = if trimmed.len() > MAX_FIELD_LEN {
        &trimmed[..MAX_FIELD_LEN]
    } else {
        trimmed
    };
    logging::sanitizer::sanitize(bounded)
}

fn sanitize_workflow_opt(raw: &Option<String>) -> Option<String> {
    raw.as_ref().map(|v| sanitize_workflow_value(v))
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
pub fn log_workflow_event(event: WorkflowLogEvent) -> Result<(), AppError> {
    let workflow = sanitize_workflow_value(&event.workflow);
    let step = sanitize_workflow_value(&event.step);
    let status = sanitize_workflow_opt(&event.status).unwrap_or_else(|| "unknown".into());
    let route = sanitize_workflow_opt(&event.route).unwrap_or_default();
    let action = sanitize_workflow_opt(&event.action).unwrap_or_default();
    let message = sanitize_workflow_opt(&event.message).unwrap_or_default();
    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        workflow = %workflow,
        step = %step,
        status = %status,
        route = %route,
        action = %action,
        message = %message
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

#[cfg(test)]
mod tests {
    use super::sanitize_workflow_value;

    #[test]
    fn workflow_value_is_sanitized() {
        let got = sanitize_workflow_value("password=supersecret");
        assert_eq!(got, "password=***");
        assert!(!got.contains("supersecret"));
    }

    #[test]
    fn workflow_value_is_capped() {
        let long = "x".repeat(300);
        let got = sanitize_workflow_value(&long);
        assert_eq!(got.len(), 200);
    }
}
