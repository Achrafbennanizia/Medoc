// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10, workflow telemetry)

use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::log_system;
use crate::log_workflow;

const WORKFLOW_FIELD_LIMIT: usize = 256;
const WORKFLOW_MESSAGE_LIMIT: usize = 1024;
const WORKFLOW_CONTEXT_LIMIT: usize = 4096;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowPhase {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowPhase {
    fn as_str(&self) -> &'static str {
        match self {
            WorkflowPhase::RouteEnter => "route_enter",
            WorkflowPhase::PrimaryAction => "primary_action",
            WorkflowPhase::Success => "success",
            WorkflowPhase::Cancel => "cancel",
            WorkflowPhase::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEventInput {
    pub workflow: String,
    pub step: String,
    pub phase: WorkflowPhase,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub context: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct SanitizedWorkflowLogEvent {
    workflow: String,
    step: String,
    phase: WorkflowPhase,
    route: Option<String>,
    action: Option<String>,
    status: Option<String>,
    message: Option<String>,
    context_json: String,
}

fn sanitize_text_field(input: &str, max_len: usize) -> String {
    let mut cleaned = crate::infrastructure::logging::sanitizer::sanitize(input.trim());
    if cleaned.len() > max_len {
        cleaned.truncate(max_len);
    }
    cleaned
}

fn sanitize_optional_text_field(input: Option<String>, max_len: usize) -> Option<String> {
    input
        .map(|value| sanitize_text_field(&value, max_len))
        .filter(|value| !value.is_empty())
}

fn sanitize_workflow_event(event: WorkflowLogEventInput) -> SanitizedWorkflowLogEvent {
    let mut context_json = serde_json::to_string(
        &crate::infrastructure::logging::sanitizer::sanitize_json(&event.context),
    )
    .unwrap_or_else(|_| "{}".to_string());
    if context_json.len() > WORKFLOW_CONTEXT_LIMIT {
        context_json.truncate(WORKFLOW_CONTEXT_LIMIT);
    }
    SanitizedWorkflowLogEvent {
        workflow: sanitize_text_field(&event.workflow, WORKFLOW_FIELD_LIMIT),
        step: sanitize_text_field(&event.step, WORKFLOW_FIELD_LIMIT),
        phase: event.phase,
        route: sanitize_optional_text_field(event.route, WORKFLOW_FIELD_LIMIT),
        action: sanitize_optional_text_field(event.action, WORKFLOW_FIELD_LIMIT),
        status: sanitize_optional_text_field(event.status, WORKFLOW_FIELD_LIMIT),
        message: sanitize_optional_text_field(event.message, WORKFLOW_MESSAGE_LIMIT),
        context_json,
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
pub fn log_workflow_step(event: WorkflowLogEventInput) -> Result<(), AppError> {
    let sanitized = sanitize_workflow_event(event);
    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        workflow = %sanitized.workflow,
        step = %sanitized.step,
        phase = sanitized.phase.as_str(),
        route = sanitized.route.as_deref(),
        action = sanitized.action.as_deref(),
        status = sanitized.status.as_deref(),
        message = sanitized.message.as_deref(),
        context = %sanitized.context_json
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
        $crate::commands::logging_commands::log_workflow_step,
    };
}
