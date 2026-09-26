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
use crate::log_workflow;

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

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStage {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowStage {
    fn as_str(self) -> &'static str {
        match self {
            WorkflowStage::RouteEnter => "route_enter",
            WorkflowStage::PrimaryAction => "primary_action",
            WorkflowStage::Success => "success",
            WorkflowStage::Cancel => "cancel",
            WorkflowStage::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct WorkflowLogEvent {
    pub stage: WorkflowStage,
    pub step: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub metadata: Option<Value>,
}

fn sanitize_optional_text(raw: Option<&str>) -> Option<String> {
    raw.map(logging::sanitizer::sanitize_workflow_text)
        .filter(|value| !value.trim().is_empty())
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state, event))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowLogEvent,
) -> Result<(), AppError> {
    let step = logging::sanitizer::sanitize_workflow_text(&event.step);
    if step.trim().is_empty() {
        return Err(AppError::Validation("workflow step missing".into()));
    }

    let route = sanitize_optional_text(event.route.as_deref());
    let action = sanitize_optional_text(event.action.as_deref());
    let message = sanitize_optional_text(event.message.as_deref());
    let metadata = event
        .metadata
        .as_ref()
        .map(logging::sanitizer::sanitize_workflow_value)
        .unwrap_or(Value::Null);
    let metadata_json = serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".to_string());
    let actor = {
        let guard = session_state.lock_session();
        guard
            .as_ref()
            .map(|(session, _)| logging::sanitizer::sanitize_workflow_text(&session.user_id))
            .unwrap_or_else(|| "anonymous".to_string())
    };

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        stage = event.stage.as_str(),
        step = %step,
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        message = message.as_deref().unwrap_or(""),
        actor = %actor,
        metadata = %metadata_json,
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
