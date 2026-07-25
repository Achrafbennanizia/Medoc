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

const MAX_WORKFLOW_FIELD_CHARS: usize = 240;

#[derive(Debug, Deserialize)]
pub struct WorkflowLogEventInput {
    pub stage: String,
    pub route: Option<String>,
    pub action: Option<String>,
    pub outcome: Option<String>,
    pub details: Option<String>,
    pub command: Option<String>,
    pub duration_ms: Option<u64>,
}

fn sanitize_workflow_text(raw: &str) -> String {
    let masked = logging::sanitizer::sanitize(raw.trim());
    let mut out = String::new();
    for (idx, ch) in masked.chars().enumerate() {
        if idx >= MAX_WORKFLOW_FIELD_CHARS {
            out.push_str("...[truncated]");
            break;
        }
        out.push(ch);
    }
    out
}

fn sanitize_workflow_optional(raw: Option<String>) -> Option<String> {
    let value = sanitize_workflow_text(raw.as_deref().unwrap_or_default());
    if value.is_empty() {
        None
    } else {
        Some(value)
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

/// Sanitized frontend → backend workflow bridge.
///
/// Intentionally does not require an authenticated session so pre-login flows
/// (onboarding/login route transitions and errors) can still be observed.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(input))]
pub fn log_workflow_event(input: WorkflowLogEventInput) -> Result<(), AppError> {
    let WorkflowLogEventInput {
        stage,
        route,
        action,
        outcome,
        details,
        command,
        duration_ms,
    } = input;

    let stage = sanitize_workflow_text(&stage);
    if stage.is_empty() {
        return Err(AppError::Validation("workflow stage fehlt".into()));
    }

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        stage = %stage,
        route = ?sanitize_workflow_optional(route),
        action = ?sanitize_workflow_optional(action),
        outcome = ?sanitize_workflow_optional(outcome),
        details = ?sanitize_workflow_optional(details),
        command = ?sanitize_workflow_optional(command),
        duration_ms = duration_ms,
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
    use super::{sanitize_workflow_optional, sanitize_workflow_text, MAX_WORKFLOW_FIELD_CHARS};

    #[test]
    fn workflow_sanitizer_masks_secret_patterns() {
        let value = sanitize_workflow_text("password=hunter2");
        assert_eq!(value, "password=***");
    }

    #[test]
    fn workflow_sanitizer_truncates_long_values() {
        let long = "x".repeat(MAX_WORKFLOW_FIELD_CHARS + 20);
        let value = sanitize_workflow_text(&long);
        assert!(value.ends_with("...[truncated]"));
        assert!(value.len() > MAX_WORKFLOW_FIELD_CHARS);
    }

    #[test]
    fn workflow_optional_returns_none_for_blank_values() {
        assert_eq!(sanitize_workflow_optional(Some("   ".to_string())), None);
    }
}
