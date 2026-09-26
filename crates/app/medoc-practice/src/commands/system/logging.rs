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

const WORKFLOW_TEXT_LIMIT: usize = 160;
const WORKFLOW_DETAIL_LIMIT: usize = 512;
const WORKFLOW_ARG_KEY_LIMIT: usize = 32;
const WORKFLOW_MAX_ARG_KEYS: usize = 24;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEvent {
    pub step: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub correlation_id: Option<String>,
    #[serde(default)]
    pub arg_keys: Vec<String>,
}

#[derive(Debug)]
struct SanitizedWorkflowLogEvent {
    step: String,
    route: Option<String>,
    action: Option<String>,
    status: Option<String>,
    command: Option<String>,
    detail: Option<String>,
    correlation_id: Option<String>,
    arg_keys: Vec<String>,
}

fn sanitize_text(value: &str, max_len: usize) -> String {
    let clipped: String = value.chars().take(max_len).collect();
    logging::sanitizer::sanitize(clipped.trim())
}

fn sanitize_optional(value: Option<String>, max_len: usize) -> Option<String> {
    value.and_then(|v| {
        let cleaned = sanitize_text(&v, max_len);
        if cleaned.is_empty() {
            None
        } else {
            Some(cleaned)
        }
    })
}

fn sanitize_workflow_event(input: WorkflowLogEvent) -> Result<SanitizedWorkflowLogEvent, AppError> {
    let step = sanitize_text(&input.step, WORKFLOW_TEXT_LIMIT);
    if step.is_empty() {
        return Err(AppError::Validation("workflow step missing".into()));
    }
    let arg_keys = input
        .arg_keys
        .into_iter()
        .take(WORKFLOW_MAX_ARG_KEYS)
        .map(|k| sanitize_text(&k, WORKFLOW_ARG_KEY_LIMIT))
        .filter(|k| !k.is_empty())
        .collect();
    Ok(SanitizedWorkflowLogEvent {
        step,
        route: sanitize_optional(input.route, WORKFLOW_TEXT_LIMIT),
        action: sanitize_optional(input.action, WORKFLOW_TEXT_LIMIT),
        status: sanitize_optional(input.status, WORKFLOW_TEXT_LIMIT),
        command: sanitize_optional(input.command, WORKFLOW_TEXT_LIMIT),
        detail: sanitize_optional(input.detail, WORKFLOW_DETAIL_LIMIT),
        correlation_id: sanitize_optional(input.correlation_id, WORKFLOW_TEXT_LIMIT),
        arg_keys,
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
#[tracing::instrument(level = "info", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEvent) -> Result<(), AppError> {
    let event = sanitize_workflow_event(event)?;
    tracing::info!(
        target: "medoc::workflow",
        event = "UI_WORKFLOW_STEP",
        step = %event.step,
        route = %event.route.as_deref().unwrap_or(""),
        action = %event.action.as_deref().unwrap_or(""),
        status = %event.status.as_deref().unwrap_or(""),
        command = %event.command.as_deref().unwrap_or(""),
        correlation_id = %event.correlation_id.as_deref().unwrap_or(""),
        arg_keys = ?event.arg_keys,
        detail = %event.detail.as_deref().unwrap_or(""),
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
