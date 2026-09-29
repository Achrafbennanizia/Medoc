// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::Deserialize;
use serde_json::Value;
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
pub struct WorkflowLogEventInput {
    pub workflow: String,
    pub phase: String,
    pub step: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub context: Option<Value>,
}

#[derive(Debug)]
struct WorkflowLogEvent {
    workflow: String,
    phase: String,
    step: String,
    route: Option<String>,
    outcome: Option<String>,
    detail: Option<String>,
    context: Option<Value>,
}

fn sanitize_json_value(value: Value) -> Value {
    match value {
        Value::String(raw) => Value::String(logging::sanitizer::sanitize(raw.trim())),
        Value::Array(items) => Value::Array(items.into_iter().map(sanitize_json_value).collect()),
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(k, v)| (k, sanitize_json_value(v)))
                .collect(),
        ),
        other => other,
    }
}

fn sanitize_required_field(field: &'static str, value: String) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::validation_code_params(
            "error.logging.workflow_required",
            &[("field", field)],
        ));
    }
    Ok(logging::sanitizer::sanitize(trimmed))
}

fn sanitize_optional_field(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(logging::sanitizer::sanitize(trimmed))
        }
    })
}

fn sanitize_workflow_event(input: WorkflowLogEventInput) -> Result<WorkflowLogEvent, AppError> {
    Ok(WorkflowLogEvent {
        workflow: sanitize_required_field("workflow", input.workflow)?,
        phase: sanitize_required_field("phase", input.phase)?,
        step: sanitize_required_field("step", input.step)?,
        route: sanitize_optional_field(input.route),
        outcome: sanitize_optional_field(input.outcome),
        detail: sanitize_optional_field(input.detail),
        context: input.context.map(sanitize_json_value),
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
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEventInput) -> Result<(), AppError> {
    let event = sanitize_workflow_event(event)?;
    let context = event
        .context
        .as_ref()
        .and_then(|value| serde_json::to_string(value).ok());
    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        workflow = %event.workflow,
        phase = %event.phase,
        step = %event.step,
        route = ?event.route,
        outcome = ?event.outcome,
        detail = ?event.detail,
        context = ?context,
    );
    Ok(())
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
    use super::*;
    use serde_json::json;

    #[test]
    fn workflow_event_sanitizes_secrets_in_all_string_fields() {
        let event = sanitize_workflow_event(WorkflowLogEventInput {
            workflow: " ui.ipc ".into(),
            phase: " error ".into(),
            step: "create_patient".into(),
            route: Some("/patients/123".into()),
            outcome: Some("password=hunter2".into()),
            detail: Some("token=abc123".into()),
            context: Some(json!({
                "note": "jwt eyJhbGciOiJIUzI1NiJ9.payload.sig",
                "nested": { "password": "password=swordfish" },
            })),
        })
        .expect("event should be valid");

        assert_eq!(event.workflow, "ui.ipc");
        assert_eq!(event.phase, "error");
        assert_eq!(event.step, "create_patient");
        assert_eq!(event.outcome.as_deref(), Some("password=***"));
        assert_eq!(event.detail.as_deref(), Some("token=***"));

        let context = event.context.expect("context should be present");
        let as_text = context.to_string();
        assert!(as_text.contains("eyJ***"));
        assert!(as_text.contains("password=***"));
        assert!(!as_text.contains("swordfish"));
    }

    #[test]
    fn workflow_event_requires_non_empty_fields() {
        let err = sanitize_workflow_event(WorkflowLogEventInput {
            workflow: " ".into(),
            phase: "primary_action".into(),
            step: "list_patients".into(),
            route: None,
            outcome: None,
            detail: None,
            context: None,
        })
        .expect_err("blank workflow should fail");
        assert!(err.to_string().contains("error.logging.workflow_required"));
    }
}
