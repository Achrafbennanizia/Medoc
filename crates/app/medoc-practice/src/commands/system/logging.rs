// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, sanitizer, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

const WORKFLOW_TEXT_LIMIT: usize = 512;
const WORKFLOW_CONTEXT_LIMIT: usize = 4096;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStep {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowStep {
    fn as_str(self) -> &'static str {
        match self {
            Self::RouteEnter => "route_enter",
            Self::PrimaryAction => "primary_action",
            Self::Success => "success",
            Self::Cancel => "cancel",
            Self::Error => "error",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEvent {
    pub step: WorkflowStep,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub details: Option<String>,
    #[serde(default)]
    pub context: Option<serde_json::Value>,
}

fn truncate_chars(input: &str, max_chars: usize) -> String {
    input.chars().take(max_chars).collect()
}

fn sanitize_text(value: Option<&str>, max_chars: usize) -> String {
    let Some(raw) = value else {
        return "-".to_string();
    };
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return "-".to_string();
    }
    sanitizer::sanitize(&truncate_chars(trimmed, max_chars))
}

fn sanitize_context(value: &Option<serde_json::Value>) -> String {
    let Some(raw) = value else {
        return "-".to_string();
    };
    let serialized =
        serde_json::to_string(raw).unwrap_or_else(|_| "\"<context-serialize-error>\"".into());
    sanitizer::sanitize(&truncate_chars(&serialized, WORKFLOW_CONTEXT_LIMIT))
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

/// Writes a sanitized frontend workflow step into the dedicated workflow channel.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEvent) -> Result<(), AppError> {
    let route = sanitize_text(event.route.as_deref(), WORKFLOW_TEXT_LIMIT);
    let action = sanitize_text(event.action.as_deref(), WORKFLOW_TEXT_LIMIT);
    let outcome = sanitize_text(event.outcome.as_deref(), WORKFLOW_TEXT_LIMIT);
    let details = sanitize_text(event.details.as_deref(), WORKFLOW_TEXT_LIMIT);
    let context = sanitize_context(&event.context);
    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        step = event.step.as_str(),
        route = %route,
        action = %action,
        outcome = %outcome,
        details = %details,
        context = %context
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
    use super::*;

    #[test]
    fn sanitize_text_masks_secrets_and_trims() {
        let got = sanitize_text(Some("password=hunter2"), WORKFLOW_TEXT_LIMIT);
        assert_eq!(got, "password=***");
        assert!(!got.contains("hunter2"));
    }

    #[test]
    fn sanitize_context_masks_nested_tokens() {
        let value = serde_json::json!({
            "patientId": "pat-123",
            "auth": "token=abc123",
            "jwt": "eyJhbGciOiJIUzI1NiJ9.payload.sig"
        });
        let got = sanitize_context(&Some(value));
        assert!(got.contains("\"auth\":\"token=***\""));
        assert!(got.contains("\"jwt\":\"eyJ***\""));
        assert!(!got.contains("abc123"));
    }
}
