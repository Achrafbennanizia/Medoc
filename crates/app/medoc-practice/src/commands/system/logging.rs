// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, sanitizer, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};
use serde::Deserialize;

fn sanitize_event_token(raw: &str, fallback: &str) -> String {
    let redacted = sanitizer::sanitize(raw);
    let mapped = redacted
        .trim()
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '/' | ':') {
                c.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect::<String>();
    let collapsed = mapped
        .split('_')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("_");
    let normalised = if collapsed.is_empty() {
        fallback.to_string()
    } else {
        collapsed
    };
    normalised.chars().take(96).collect()
}

fn sanitize_event_optional(raw: Option<String>) -> Option<String> {
    raw.map(|v| sanitize_event_token(&v, "unknown"))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEventArgs {
    pub workflow: String,
    pub step: String,
    pub phase: String,
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default, alias = "error_code")]
    pub error_code: Option<String>,
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
#[tracing::instrument(level = "info", skip(session_state, event))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowLogEventArgs,
) -> Result<(), AppError> {
    let workflow = sanitize_event_token(&event.workflow, "ui.workflow");
    let step = sanitize_event_token(&event.step, "unspecified");
    let phase = sanitize_event_token(&event.phase, "unspecified");
    let outcome = sanitize_event_optional(event.outcome);
    let route = sanitize_event_optional(event.route);
    let action = sanitize_event_optional(event.action);
    let error_code = sanitize_event_optional(event.error_code);

    let (actor_user_id, actor_role) = {
        let guard = session_state.lock_session();
        guard
            .as_ref()
            .map(|(session, _)| {
                (
                    sanitize_event_token(&session.user_id, "unknown"),
                    sanitize_event_token(&session.role, "unknown"),
                )
            })
            .unwrap_or_else(|| ("anonymous".into(), "unauthenticated".into()))
    };

    log_workflow!(
        info,
        event = "UI_WORKFLOW_EVENT",
        workflow = %workflow,
        step = %step,
        phase = %phase,
        outcome = %outcome.as_deref().unwrap_or("unspecified"),
        route = %route.as_deref().unwrap_or("unspecified"),
        action = %action.as_deref().unwrap_or("unspecified"),
        error_code = %error_code.as_deref().unwrap_or("none"),
        actor_user_id = %actor_user_id,
        actor_role = %actor_role,
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
