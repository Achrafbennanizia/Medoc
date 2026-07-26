// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

const WORKFLOW_FIELD_MAX_LEN: usize = 120;

#[derive(Debug, Clone, Deserialize)]
pub struct WorkflowEventPayload {
    pub step: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub error_class: Option<String>,
    #[serde(default)]
    pub duration_ms: Option<u64>,
}

fn sanitize_workflow_field(raw: Option<&str>) -> Option<String> {
    raw.map(str::trim)
        .filter(|v| !v.is_empty())
        .map(logging::sanitizer::sanitize)
        .map(|v| v.chars().take(WORKFLOW_FIELD_MAX_LEN).collect::<String>())
}

fn normalize_workflow_step(raw: &str) -> &'static str {
    match raw.trim().to_ascii_lowercase().as_str() {
        "route_enter" => "route_enter",
        "primary_action" => "primary_action",
        "success" => "success",
        "cancel" => "cancel",
        "error" => "error",
        _ => "unknown",
    }
}

fn normalize_workflow_outcome(raw: Option<&str>) -> &'static str {
    match raw.map(|v| v.trim().to_ascii_lowercase()) {
        Some(v) if v == "start" => "start",
        Some(v) if v == "success" => "success",
        Some(v) if v == "cancel" => "cancel",
        Some(v) if v == "error" => "error",
        _ => "unknown",
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

/// Sanitized workflow telemetry from frontend route/action lifecycle events.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(payload))]
pub fn log_workflow_event(payload: WorkflowEventPayload) -> Result<(), AppError> {
    let step = normalize_workflow_step(&payload.step);
    let route = sanitize_workflow_field(payload.route.as_deref());
    let action = sanitize_workflow_field(payload.action.as_deref());
    let command = sanitize_workflow_field(payload.command.as_deref());
    let outcome = normalize_workflow_outcome(payload.outcome.as_deref());
    let error_class = sanitize_workflow_field(payload.error_class.as_deref());
    let duration_ms = payload.duration_ms.unwrap_or_default();

    log_workflow!(
        info,
        event = "WORKFLOW_EVENT",
        step = step,
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        command = command.as_deref().unwrap_or(""),
        outcome = outcome,
        error_class = error_class.as_deref().unwrap_or(""),
        duration_ms,
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
