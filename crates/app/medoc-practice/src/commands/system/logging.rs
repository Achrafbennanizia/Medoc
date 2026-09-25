// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, sanitizer, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

const MAX_WORKFLOW_ROUTE_CHARS: usize = 256;
const MAX_WORKFLOW_STEP_CHARS: usize = 128;
const MAX_WORKFLOW_PHASE_CHARS: usize = 64;
const MAX_WORKFLOW_OUTCOME_CHARS: usize = 64;
const MAX_WORKFLOW_DETAILS_CHARS: usize = 512;

#[derive(Debug, Deserialize)]
pub struct WorkflowLogEvent {
    pub route: String,
    pub step: String,
    pub phase: String,
    pub outcome: Option<String>,
    pub details: Option<String>,
}

fn sanitize_text(value: &str, max_chars: usize) -> String {
    sanitizer::sanitize(value).chars().take(max_chars).collect()
}

fn sanitize_optional_text(value: Option<String>, max_chars: usize) -> Option<String> {
    value
        .map(|v| sanitize_text(&v, max_chars))
        .filter(|v| !v.trim().is_empty())
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

/// Writes sanitized route/action lifecycle events from the frontend workflow bridge.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state, event))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowLogEvent,
) -> Result<(), AppError> {
    let route = sanitize_text(&event.route, MAX_WORKFLOW_ROUTE_CHARS);
    let step = sanitize_text(&event.step, MAX_WORKFLOW_STEP_CHARS);
    let phase = sanitize_text(&event.phase, MAX_WORKFLOW_PHASE_CHARS);
    if route.trim().is_empty() || step.trim().is_empty() || phase.trim().is_empty() {
        return Err(AppError::Validation(
            "workflow log route/step/phase required".into(),
        ));
    }

    let outcome = sanitize_optional_text(event.outcome, MAX_WORKFLOW_OUTCOME_CHARS);
    let details = sanitize_optional_text(event.details, MAX_WORKFLOW_DETAILS_CHARS);
    let (user_id, role) = {
        let guard = session_state.lock_session();
        guard
            .as_ref()
            .map(|(session, _)| (session.user_id.clone(), session.role.clone()))
            .unwrap_or_else(|| ("anonymous".into(), "ANONYMOUS".into()))
    };

    log_workflow!(
        info,
        event = "UI_WORKFLOW_STEP",
        route = %route,
        step = %step,
        phase = %phase,
        outcome = ?outcome,
        role = %role,
        user_id = %user_id,
        details = ?details,
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
