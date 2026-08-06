// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, sanitizer, LogLevel, LOGGING_CONFIG};
use crate::log_system;

const WORKFLOW_FIELD_LIMIT: usize = 256;

#[derive(Debug, Deserialize)]
pub struct WorkflowLogEventInput {
    pub step: String,
    pub route: Option<String>,
    pub action: Option<String>,
    pub status: Option<String>,
    pub detail: Option<String>,
}

fn sanitize_workflow_field(raw: &str) -> String {
    let cleaned = sanitizer::sanitize(raw.trim());
    if cleaned.chars().count() <= WORKFLOW_FIELD_LIMIT {
        return cleaned;
    }
    let mut out = String::new();
    for (idx, ch) in cleaned.chars().enumerate() {
        if idx >= WORKFLOW_FIELD_LIMIT {
            break;
        }
        out.push(ch);
    }
    out.push_str("...");
    out
}

fn sanitize_workflow_optional(raw: Option<String>) -> String {
    raw.map(|v| sanitize_workflow_field(&v))
        .filter(|v| !v.is_empty())
        .unwrap_or_default()
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

/// Dedicated frontend→backend workflow bridge.
/// Logs route + action milestones into `workflow.log` through the sanitizer.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEventInput) -> Result<(), AppError> {
    let step = sanitize_workflow_field(&event.step);
    if step.is_empty() {
        return Err(AppError::Validation("workflow step fehlt".into()));
    }
    let route = sanitize_workflow_optional(event.route);
    let action = sanitize_workflow_optional(event.action);
    let status = sanitize_workflow_optional(event.status);
    let detail = sanitize_workflow_optional(event.detail);
    tracing::info!(
        target: "medoc::workflow",
        event = "WORKFLOW_UI_STEP",
        step = %step,
        route = %route,
        action = %action,
        status = %status,
        detail = %detail,
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

#[cfg(test)]
mod tests {
    use super::{sanitize_workflow_field, sanitize_workflow_optional};

    #[test]
    fn workflow_field_uses_secret_sanitizer() {
        let value = sanitize_workflow_field("password=hunter2");
        assert!(value.contains("password=***"));
        assert!(!value.contains("hunter2"));
    }

    #[test]
    fn workflow_optional_omits_empty_values() {
        assert_eq!(sanitize_workflow_optional(Some("   ".into())), "");
        assert_eq!(sanitize_workflow_optional(None), "");
    }
}
