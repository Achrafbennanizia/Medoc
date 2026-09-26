// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct WorkflowEventInput {
    pub phase: String,
    pub step: String,
    pub route: Option<String>,
    pub command: Option<String>,
    pub detail: Option<String>,
}

fn sanitize_workflow_field(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            return None;
        }
        // Keep workflow rows bounded to avoid oversized log lines while still
        // preserving enough context for flow reconstruction.
        let capped: String = trimmed.chars().take(256).collect();
        Some(logging::sanitizer::sanitize(&capped))
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
#[tracing::instrument(level = "debug", skip(session_state, event))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowEventInput,
) -> Result<(), AppError> {
    let session = session_state.lock_session();
    let actor = session
        .as_ref()
        .map(|(s, _)| s.user_id.clone())
        .unwrap_or_else(|| "anonymous".into());
    drop(session);

    let phase_raw = event.phase.trim();
    let step_raw = event.step.trim();
    let phase = logging::sanitizer::sanitize(if phase_raw.is_empty() {
        "unknown"
    } else {
        phase_raw
    });
    let step = logging::sanitizer::sanitize(if step_raw.is_empty() {
        "unknown"
    } else {
        step_raw
    });
    let route = sanitize_workflow_field(event.route);
    let command = sanitize_workflow_field(event.command);
    let detail = sanitize_workflow_field(event.detail);

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        phase = %phase,
        step = %step,
        actor = %actor,
        route = ?route,
        command = ?command,
        detail = ?detail,
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
