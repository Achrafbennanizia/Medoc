// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

const WORKFLOW_FIELD_MAX: usize = 120;
const WORKFLOW_ALLOWED_STAGES: &[&str] = &[
    "route_enter",
    "primary_action",
    "success",
    "cancel",
    "error",
];

fn sanitize_workflow_field(value: Option<String>) -> Option<String> {
    let raw = value?;
    let compact = raw.replace(['\n', '\r', '\t'], " ").trim().to_string();
    if compact.is_empty() {
        return None;
    }
    let mut sanitized = logging::sanitizer::sanitize(&compact);
    if sanitized.len() > WORKFLOW_FIELD_MAX {
        sanitized.truncate(WORKFLOW_FIELD_MAX);
    }
    Some(sanitized)
}

fn normalize_stage(stage: Option<String>) -> String {
    let stage = sanitize_workflow_field(stage).unwrap_or_else(|| "other".to_string());
    if WORKFLOW_ALLOWED_STAGES.contains(&stage.as_str()) {
        stage
    } else {
        "other".to_string()
    }
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

/// Sanitized frontend→backend workflow telemetry bridge.
///
/// The payload is intentionally constrained to route/action/state metadata so
/// UI workflows are traceable without leaking patient content.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(stage, route, action, outcome))]
pub fn record_workflow_event(
    stage: String,
    route: Option<String>,
    action: Option<String>,
    outcome: Option<String>,
) -> Result<(), AppError> {
    let stage = normalize_stage(Some(stage));
    let route = sanitize_workflow_field(route);
    let action = sanitize_workflow_field(action);
    let outcome = sanitize_workflow_field(outcome);

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        stage = %stage,
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        outcome = outcome.as_deref().unwrap_or(""),
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
        $crate::commands::logging_commands::record_workflow_event,
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn workflow_field_masks_secrets_and_limits_length() {
        let out = sanitize_workflow_field(Some(
            "password=hunter2 token=abc123456789 route=/patienten".to_string(),
        ))
        .expect("value");
        assert!(!out.contains("hunter2"));
        assert!(out.contains("password=***"));
        assert!(out.contains("token=***"));
        assert!(out.len() <= WORKFLOW_FIELD_MAX);
    }

    #[test]
    fn unknown_stage_is_normalized() {
        assert_eq!(normalize_stage(Some("step-42".to_string())), "other");
        assert_eq!(
            normalize_stage(Some("route_enter".to_string())),
            "route_enter"
        );
    }
}
