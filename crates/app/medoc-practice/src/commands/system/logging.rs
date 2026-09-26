// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

const WORKFLOW_ROUTE_MAX: usize = 256;
const WORKFLOW_ACTION_MAX: usize = 128;
const WORKFLOW_MESSAGE_MAX: usize = 512;
const WORKFLOW_METADATA_MAX: usize = 512;

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
pub struct WorkflowEvent {
    pub step: WorkflowStep,
    pub route: Option<String>,
    pub action: Option<String>,
    pub message: Option<String>,
    pub metadata: Option<JsonValue>,
}

fn sanitize_text(value: Option<String>, max_len: usize) -> Option<String> {
    let raw = value?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let sanitized = logging::sanitizer::sanitize(trimmed);
    Some(sanitized.chars().take(max_len).collect())
}

fn sanitize_metadata(value: Option<JsonValue>) -> Option<String> {
    let raw = value?;
    let text = serde_json::to_string(&raw).unwrap_or_else(|_| String::from("<invalid-json>"));
    sanitize_text(Some(text), WORKFLOW_METADATA_MAX)
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

/// Frontend workflow telemetry bridge.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn record_workflow_event(event: WorkflowEvent) -> Result<(), AppError> {
    let route = sanitize_text(event.route, WORKFLOW_ROUTE_MAX);
    let action = sanitize_text(event.action, WORKFLOW_ACTION_MAX);
    let message = sanitize_text(event.message, WORKFLOW_MESSAGE_MAX);
    let metadata = sanitize_metadata(event.metadata);
    log_workflow!(
        info,
        event = "UI_WORKFLOW_STEP",
        step = event.step.as_str(),
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        message = message.as_deref().unwrap_or(""),
        metadata = metadata.as_deref().unwrap_or("")
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
        $crate::commands::logging_commands::record_workflow_event,
    };
}
