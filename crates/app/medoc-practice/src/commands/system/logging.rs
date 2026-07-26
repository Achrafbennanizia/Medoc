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

const WORKFLOW_FIELD_MAX: usize = 256;

fn sanitize_workflow_value(raw: &str) -> String {
    let cleaned = logging::sanitizer::sanitize(raw.trim());
    if cleaned.chars().count() <= WORKFLOW_FIELD_MAX {
        return cleaned;
    }
    cleaned.chars().take(WORKFLOW_FIELD_MAX).collect()
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEvent {
    pub step: String,
    pub route: String,
    pub action: Option<String>,
    pub command: Option<String>,
    pub detail: Option<String>,
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

/// Sanitized frontend workflow bridge: route + action lifecycle into `workflow.log`.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEvent) -> Result<(), AppError> {
    let step = sanitize_workflow_value(&event.step);
    if step.is_empty() {
        return Err(AppError::Validation("workflow step fehlt".into()));
    }
    let route = sanitize_workflow_value(&event.route);
    if route.is_empty() {
        return Err(AppError::Validation("workflow route fehlt".into()));
    }
    let action = event
        .action
        .as_deref()
        .map(sanitize_workflow_value)
        .unwrap_or_default();
    let command = event
        .command
        .as_deref()
        .map(sanitize_workflow_value)
        .unwrap_or_default();
    let detail = event
        .detail
        .as_deref()
        .map(sanitize_workflow_value)
        .unwrap_or_default();

    crate::log_workflow!(
        info,
        event = "UI_WORKFLOW_STEP",
        step = %step,
        route = %route,
        action = %action,
        command = %command,
        detail = %detail,
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
    fn workflow_sanitizer_masks_secrets() {
        let redacted = sanitize_workflow_value("password=clear-text token=abc");
        assert!(redacted.contains("password=***"));
        assert!(redacted.contains("token=***"));
        assert!(!redacted.contains("clear-text"));
    }

    #[test]
    fn workflow_sanitizer_truncates_very_long_values() {
        let raw = "a".repeat(400);
        let cleaned = sanitize_workflow_value(&raw);
        assert_eq!(cleaned.chars().count(), 256);
    }
}
