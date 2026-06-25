// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use sqlx::SqlitePool;
use serde::Deserialize;
use serde_json::Value;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEventInput {
    pub workflow: String,
    pub step: String,
    pub route: Option<String>,
    pub action: Option<String>,
    pub status: Option<String>,
    #[serde(default)]
    pub metadata: Value,
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state, event))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowLogEventInput,
) -> Result<(), AppError> {
    let workflow = logging::sanitizer::sanitize(event.workflow.trim());
    let step = logging::sanitizer::sanitize(event.step.trim());
    if workflow.is_empty() || step.is_empty() {
        return Err(AppError::Validation("workflow/step fehlt".into()));
    }

    let route = event
        .route
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(logging::sanitizer::sanitize);
    let action = event
        .action
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(logging::sanitizer::sanitize);
    let status = event
        .status
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(logging::sanitizer::sanitize);
    let metadata = logging::sanitizer::sanitize_json_value(&event.metadata);
    let actor_user_id = session_state
        .lock_session()
        .as_ref()
        .map(|(s, _)| s.user_id.clone())
        .unwrap_or_else(|| "anonymous".to_string());

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        workflow = %workflow,
        step = %step,
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        status = status.as_deref().unwrap_or(""),
        actor_user_id = %actor_user_id,
        metadata = ?metadata,
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
