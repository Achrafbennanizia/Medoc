// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::log_system;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEvent {
    pub workflow: String,
    pub step: String,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub metadata: Value,
}

fn sanitize_text(raw: impl AsRef<str>, max_chars: usize) -> String {
    let sanitized = logging::sanitizer::sanitize(raw.as_ref())
        .trim()
        .to_string();
    if sanitized.chars().count() <= max_chars {
        return sanitized;
    }
    sanitized.chars().take(max_chars).collect()
}

fn sanitize_optional_text(value: Option<String>, max_chars: usize) -> Option<String> {
    value
        .map(|raw| sanitize_text(raw, max_chars))
        .filter(|clean| !clean.is_empty())
}

fn sanitize_workflow_event(input: WorkflowLogEvent) -> WorkflowLogEvent {
    WorkflowLogEvent {
        workflow: sanitize_text(input.workflow, 120),
        step: sanitize_text(input.step, 120),
        status: sanitize_optional_text(input.status, 120),
        route: sanitize_optional_text(input.route, 240),
        action: sanitize_optional_text(input.action, 180),
        source: sanitize_optional_text(input.source, 120),
        message: sanitize_optional_text(input.message, 500),
        error: sanitize_optional_text(input.error, 500),
        metadata: logging::sanitizer::sanitize_json_value(&input.metadata),
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

#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEvent) -> Result<(), AppError> {
    let event = sanitize_workflow_event(event);
    tracing::info!(
        target: "medoc::workflow",
        event = "WORKFLOW_STEP",
        workflow = %event.workflow,
        step = %event.step,
        status = ?event.status,
        route = ?event.route,
        action = ?event.action,
        source = ?event.source,
        message = ?event.message,
        error = ?event.error,
        metadata = %event.metadata,
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
    fn workflow_event_sanitizes_sensitive_fields() {
        let input = WorkflowLogEvent {
            workflow: "token=my-token".into(),
            step: "primary_action".into(),
            status: Some("error".into()),
            route: Some("/patienten/123".into()),
            action: Some("create_patient".into()),
            source: Some("frontend".into()),
            message: Some("password=hunter2".into()),
            error: Some("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig".into()),
            metadata: serde_json::json!({
                "detail": "api_key=secret",
                "nested": { "jwt": "eyJhbGciOiJIUzI1NiJ9.payload.sig" }
            }),
        };

        let out = sanitize_workflow_event(input);
        assert_eq!(out.workflow, "token=***");
        assert_eq!(out.message.as_deref(), Some("password=***"));
        assert_eq!(out.error.as_deref(), Some("Authorization: Bearer eyJ***"));
        assert_eq!(out.metadata["detail"], "api_key=***");
        assert_eq!(out.metadata["nested"]["jwt"], "eyJ***");
    }
}
