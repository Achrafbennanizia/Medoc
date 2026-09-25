// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, sanitizer, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogPayload {
    pub route: String,
    pub step: String,
    pub action: String,
    pub status: String,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

fn sanitize_workflow_value(raw: &str, field: &str) -> Result<String, AppError> {
    let cleaned = sanitizer::sanitize(raw.trim());
    if cleaned.is_empty() {
        return Err(AppError::Validation(format!("{field} missing")));
    }
    Ok(cleaned)
}

fn sanitize_workflow_payload(payload: WorkflowLogPayload) -> Result<WorkflowLogPayload, AppError> {
    Ok(WorkflowLogPayload {
        route: sanitize_workflow_value(&payload.route, "route")?,
        step: sanitize_workflow_value(&payload.step, "step")?,
        action: sanitize_workflow_value(&payload.action, "action")?,
        status: sanitize_workflow_value(&payload.status, "status")?,
        message: payload
            .message
            .map(|s| sanitizer::sanitize(s.trim()))
            .filter(|s| !s.is_empty()),
        error: payload
            .error
            .map(|s| sanitizer::sanitize(s.trim()))
            .filter(|s| !s.is_empty()),
    })
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
#[tracing::instrument(level = "debug", skip(session_state, payload))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    payload: WorkflowLogPayload,
) -> Result<(), AppError> {
    let session = crate::commands::rbac_state::require_authenticated(&session_state)?;
    let payload = sanitize_workflow_payload(payload)?;
    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        user_id = %session.user_id,
        role = %session.role,
        route = %payload.route,
        step = %payload.step,
        action = %payload.action,
        status = %payload.status,
        message = payload.message.as_deref().unwrap_or(""),
        error = payload.error.as_deref().unwrap_or(""),
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
    fn workflow_payload_sanitizes_secret_like_values() {
        let payload = WorkflowLogPayload {
            route: "/patients".into(),
            step: "error".into(),
            action: "create_patient".into(),
            status: "error".into(),
            message: Some("password=hunter2".into()),
            error: Some("token=abcdef".into()),
        };

        let cleaned = sanitize_workflow_payload(payload).expect("sanitized");
        assert_eq!(cleaned.message.as_deref(), Some("password=***"));
        assert_eq!(cleaned.error.as_deref(), Some("token=***"));
    }

    #[test]
    fn workflow_payload_rejects_blank_required_values() {
        let payload = WorkflowLogPayload {
            route: " ".into(),
            step: "route_enter".into(),
            action: "navigate".into(),
            status: "success".into(),
            message: None,
            error: None,
        };

        let err = sanitize_workflow_payload(payload).expect_err("route should be required");
        match err {
            AppError::Validation(msg) => assert!(msg.contains("route missing")),
            other => panic!("unexpected error variant: {other:?}"),
        }
    }
}
