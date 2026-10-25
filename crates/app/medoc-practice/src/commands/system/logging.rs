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

const WORKFLOW_FIELD_LIMIT: usize = 512;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowUiStep {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowUiStep {
    fn as_str(self) -> &'static str {
        match self {
            WorkflowUiStep::RouteEnter => "route_enter",
            WorkflowUiStep::PrimaryAction => "primary_action",
            WorkflowUiStep::Success => "success",
            WorkflowUiStep::Cancel => "cancel",
            WorkflowUiStep::Error => "error",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowUiEvent {
    pub step: WorkflowUiStep,
    pub route: Option<String>,
    pub action: Option<String>,
    pub detail: Option<String>,
    pub correlation_id: Option<String>,
}

fn sanitize_workflow_field(raw: Option<String>) -> Option<String> {
    raw.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return None;
        }
        let mut sanitized = logging::sanitizer::sanitize(trimmed);
        if sanitized.len() > WORKFLOW_FIELD_LIMIT {
            sanitized.truncate(WORKFLOW_FIELD_LIMIT);
        }
        Some(sanitized)
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
    let broken = audit_repo::verify_chain(&pool).await?;
    log_workflow!(
        info,
        event = "AUDIT_CHAIN_VERIFY",
        broken = broken.is_some()
    );
    Ok(broken)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn log_dir(session_state: State<'_, SessionState>) -> Result<String, AppError> {
    rbac::require(&session_state, "ops.logs")?;
    Ok(logging::log_dir()?.display().to_string())
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state, event))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowUiEvent,
) -> Result<(), AppError> {
    let route = sanitize_workflow_field(event.route);
    let action = sanitize_workflow_field(event.action);
    let detail = sanitize_workflow_field(event.detail);
    let correlation_id = sanitize_workflow_field(event.correlation_id);
    let user_id = session_state
        .lock_session()
        .as_ref()
        .map(|(session, _)| session.user_id.clone());

    log_workflow!(
        info,
        event = "UI_WORKFLOW_STEP",
        step = event.step.as_str(),
        route = ?route,
        action = ?action,
        detail = ?detail,
        correlation_id = ?correlation_id,
        user_id = ?user_id
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
