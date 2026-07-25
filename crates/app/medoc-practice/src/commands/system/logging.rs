// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

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

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowPhase {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowPhase {
    fn as_str(self) -> &'static str {
        match self {
            WorkflowPhase::RouteEnter => "route_enter",
            WorkflowPhase::PrimaryAction => "primary_action",
            WorkflowPhase::Success => "success",
            WorkflowPhase::Cancel => "cancel",
            WorkflowPhase::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEvent {
    pub workflow: String,
    pub step: String,
    pub phase: WorkflowPhase,
    pub status: Option<String>,
    pub detail: Option<String>,
    pub duration_ms: Option<u64>,
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

/// Frontend→backend workflow bridge.
/// Intentionally public without RBAC so route/action telemetry can start before login.
#[tauri::command]
#[tracing::instrument(level = "trace", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEvent) -> Result<(), AppError> {
    let workflow = logging::sanitizer::sanitize_workflow_label(&event.workflow);
    let step = logging::sanitizer::sanitize_workflow_label(&event.step);
    let status = event
        .status
        .as_deref()
        .map(logging::sanitizer::sanitize_workflow_label);
    let detail = event
        .detail
        .as_deref()
        .map(logging::sanitizer::sanitize_workflow_label);
    let duration_ms = event.duration_ms.unwrap_or(0);
    let phase = event.phase.as_str();
    log_workflow!(
        info,
        event = "UI_WORKFLOW",
        workflow = %workflow,
        step = %step,
        phase = %phase,
        status = %status.as_deref().unwrap_or(""),
        detail = %detail.as_deref().unwrap_or(""),
        duration_ms = duration_ms
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
