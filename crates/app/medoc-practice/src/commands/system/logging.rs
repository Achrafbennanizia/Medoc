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

const WORKFLOW_FIELD_LIMIT: usize = 160;
const WORKFLOW_ROUTE_LIMIT: usize = 260;
const WORKFLOW_DETAIL_LIMIT: usize = 700;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogStepInput {
    pub workflow: String,
    pub route: String,
    pub step: String,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
}

fn sanitize_required(label: &str, value: &str, max_len: usize) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation(format!("{label} missing")));
    }
    Ok(logging::sanitizer::sanitize(trimmed)
        .chars()
        .take(max_len)
        .collect())
}

fn sanitize_optional(value: Option<&str>, max_len: usize) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(
        logging::sanitizer::sanitize(trimmed)
            .chars()
            .take(max_len)
            .collect(),
    )
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

/// Frontend → backend workflow bridge. Best-effort logging only.
#[tauri::command]
#[tracing::instrument(level = "info", skip(entry))]
pub fn log_workflow_step(entry: WorkflowLogStepInput) -> Result<(), AppError> {
    let workflow = sanitize_required("workflow", &entry.workflow, WORKFLOW_FIELD_LIMIT)?;
    let route = sanitize_required("route", &entry.route, WORKFLOW_ROUTE_LIMIT)?;
    let step = sanitize_required("step", &entry.step, WORKFLOW_FIELD_LIMIT)?;
    let action = sanitize_optional(entry.action.as_deref(), WORKFLOW_FIELD_LIMIT);
    let outcome = sanitize_optional(entry.outcome.as_deref(), WORKFLOW_FIELD_LIMIT);
    let detail = sanitize_optional(entry.detail.as_deref(), WORKFLOW_DETAIL_LIMIT);

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        workflow = %workflow,
        route = %route,
        step = %step,
        action = action.as_deref().unwrap_or(""),
        outcome = outcome.as_deref().unwrap_or(""),
        detail = detail.as_deref().unwrap_or(""),
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
