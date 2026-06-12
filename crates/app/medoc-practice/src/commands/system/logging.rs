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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
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
            WorkflowStep::RouteEnter => "route_enter",
            WorkflowStep::PrimaryAction => "primary_action",
            WorkflowStep::Success => "success",
            WorkflowStep::Cancel => "cancel",
            WorkflowStep::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEvent {
    pub workflow: String,
    pub step: WorkflowStep,
    pub route: Option<String>,
    pub action: Option<String>,
    pub correlation_id: Option<String>,
    pub outcome: Option<String>,
    pub error_kind: Option<String>,
    pub timestamp_ms: Option<i64>,
}

#[derive(Debug, Clone)]
struct SanitizedWorkflowLogEvent {
    workflow: String,
    step: WorkflowStep,
    route: Option<String>,
    action: Option<String>,
    correlation_id: Option<String>,
    outcome: Option<String>,
    error_kind: Option<String>,
    timestamp_ms: Option<i64>,
}

fn normalize_optional_field(value: Option<String>, max_chars: usize) -> Option<String> {
    let value = value?;
    let value = sanitizer::sanitize(value.trim());
    if value.is_empty() {
        return None;
    }
    Some(value.chars().take(max_chars).collect())
}

fn normalize_required_field(
    value: String,
    field: &str,
    max_chars: usize,
) -> Result<String, AppError> {
    let value = sanitizer::sanitize(value.trim());
    if value.is_empty() {
        return Err(AppError::Validation(format!("{field} fehlt")));
    }
    Ok(value.chars().take(max_chars).collect())
}

fn sanitize_workflow_event(event: WorkflowLogEvent) -> Result<SanitizedWorkflowLogEvent, AppError> {
    Ok(SanitizedWorkflowLogEvent {
        workflow: normalize_required_field(event.workflow, "workflow", 64)?,
        step: event.step,
        route: normalize_optional_field(event.route, 256),
        action: normalize_optional_field(event.action, 96),
        correlation_id: normalize_optional_field(event.correlation_id, 96),
        outcome: normalize_optional_field(event.outcome, 96),
        error_kind: normalize_optional_field(event.error_kind, 96),
        timestamp_ms: event.timestamp_ms,
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

/// Bridge for frontend workflow instrumentation (route/action/success/cancel/error).
#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state, event))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowLogEvent,
) -> Result<(), AppError> {
    let event = sanitize_workflow_event(event)?;
    let session_state_label = if session_state.lock_session().is_some() {
        "authenticated"
    } else {
        "anonymous"
    };
    log_workflow!(info,
        event = "WORKFLOW_STEP",
        workflow = %event.workflow,
        step = event.step.as_str(),
        route = ?event.route,
        action = ?event.action,
        correlation_id = ?event.correlation_id,
        outcome = ?event.outcome,
        error_kind = ?event.error_kind,
        timestamp_ms = ?event.timestamp_ms,
        session = session_state_label,
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
    fn sanitize_workflow_event_masks_secret_like_values() {
        let event = WorkflowLogEvent {
            workflow: " ipc ".into(),
            step: WorkflowStep::Error,
            route: Some("/patienten/123".into()),
            action: Some("create_patient password=hunter2".into()),
            correlation_id: Some("abc-123".into()),
            outcome: Some("failed token=super-secret".into()),
            error_kind: Some("AuthError".into()),
            timestamp_ms: Some(123_456),
        };

        let sanitized = sanitize_workflow_event(event).expect("event sanitization");
        assert_eq!(sanitized.workflow, "ipc");
        assert_eq!(
            sanitized.action.as_deref(),
            Some("create_patient password=***")
        );
        assert_eq!(sanitized.outcome.as_deref(), Some("failed token=***"));
    }

    #[test]
    fn sanitize_workflow_event_rejects_missing_workflow() {
        let event = WorkflowLogEvent {
            workflow: "   ".into(),
            step: WorkflowStep::PrimaryAction,
            route: None,
            action: Some("sync_get_status".into()),
            correlation_id: None,
            outcome: None,
            error_kind: None,
            timestamp_ms: None,
        };
        let err = sanitize_workflow_event(event).expect_err("workflow should be required");
        assert!(matches!(err, AppError::Validation(_)));
    }
}
