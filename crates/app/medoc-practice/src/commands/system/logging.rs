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
pub struct WorkflowEventInput {
    pub workflow: String,
    pub step: String,
    pub route: Option<String>,
    pub action: Option<String>,
    pub outcome: Option<String>,
    pub detail: Option<String>,
    pub command: Option<String>,
}

const ALLOWED_WORKFLOW_STEPS: &[&str] = &[
    "route_enter",
    "primary_action",
    "success",
    "cancel",
    "error",
];

fn sanitize_required(
    value: &str,
    field_name: &'static str,
    max_chars: usize,
) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::Validation(format!("{field_name} missing")));
    }
    let sanitized = logging::sanitizer::sanitize(trimmed);
    Ok(sanitized.chars().take(max_chars).collect())
}

fn sanitize_optional(value: Option<&str>, max_chars: usize) -> Option<String> {
    value
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(logging::sanitizer::sanitize)
        .map(|s| s.chars().take(max_chars).collect())
}

fn sanitize_workflow_step(raw: &str) -> Result<String, AppError> {
    let step = sanitize_required(raw, "step", 32)?.to_ascii_lowercase();
    if ALLOWED_WORKFLOW_STEPS
        .iter()
        .any(|allowed| *allowed == step.as_str())
    {
        Ok(step)
    } else {
        Err(AppError::Validation(format!(
            "invalid workflow step: {step}"
        )))
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, input))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    input: WorkflowEventInput,
) -> Result<(), AppError> {
    let workflow = sanitize_required(&input.workflow, "workflow", 96)?;
    let step = sanitize_workflow_step(&input.step)?;
    let route = sanitize_optional(input.route.as_deref(), 256);
    let action = sanitize_optional(input.action.as_deref(), 128);
    let outcome = sanitize_optional(input.outcome.as_deref(), 96);
    let detail = sanitize_optional(input.detail.as_deref(), 1024);
    let command = sanitize_optional(input.command.as_deref(), 128);

    let actor_role = session_state
        .lock_session()
        .as_ref()
        .map(|(session, _)| logging::sanitizer::sanitize(&session.rolle))
        .unwrap_or_else(|| "ANONYMOUS".to_string());

    log_workflow!(
        info,
        event = "UI_WORKFLOW_EVENT",
        workflow = %workflow,
        step = %step,
        route = ?route,
        action = ?action,
        outcome = ?outcome,
        command = ?command,
        actor_role = %actor_role,
        detail = ?detail
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
