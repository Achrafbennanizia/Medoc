// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

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

fn sanitize_workflow_value(raw: Option<String>, max_len: usize) -> Option<String> {
    raw.map(|v| {
        let sanitized = logging::sanitizer::sanitize(v.trim());
        sanitized.chars().take(max_len).collect::<String>()
    })
    .filter(|v| !v.is_empty())
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(step, route, action, outcome, command, details))]
pub fn workflow_log_event(
    step: String,
    route: Option<String>,
    action: Option<String>,
    outcome: Option<String>,
    command: Option<String>,
    details: Option<String>,
) -> Result<(), AppError> {
    let step = logging::sanitizer::sanitize(step.trim());
    if step.is_empty() {
        return Err(AppError::Validation("Workflow step missing".into()));
    }
    let route = sanitize_workflow_value(route, 256);
    let action = sanitize_workflow_value(action, 128);
    let outcome = sanitize_workflow_value(outcome, 64);
    let command = sanitize_workflow_value(command, 128);
    let details = sanitize_workflow_value(details, 1024);
    log_workflow!(
        info,
        event = "WORKFLOW_UI_EVENT",
        step = %step,
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        outcome = outcome.as_deref().unwrap_or(""),
        command = command.as_deref().unwrap_or(""),
        details = details.as_deref().unwrap_or("")
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
        $crate::commands::logging_commands::workflow_log_event,
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workflow_log_event_requires_step() {
        let res = workflow_log_event(
            "   ".to_string(),
            None,
            None,
            None,
            None,
            Some("details".to_string()),
        );
        assert!(res.is_err());
    }

    #[test]
    fn workflow_values_are_sanitized() {
        let masked =
            sanitize_workflow_value(Some("token=super-secret-value".to_string()), 128).unwrap();
        assert!(masked.contains("token=***"));
    }
}
