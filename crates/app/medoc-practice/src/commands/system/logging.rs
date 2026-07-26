// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

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

fn truncate_chars(input: &str, max_chars: usize) -> String {
    input.chars().take(max_chars).collect()
}

fn sanitize_field(input: &str, max_chars: usize) -> String {
    let cleaned = logging::sanitizer::sanitize(input.trim());
    truncate_chars(&cleaned, max_chars)
}

fn sanitize_optional_field(input: Option<String>, max_chars: usize) -> Option<String> {
    input.and_then(|value| {
        let cleaned = sanitize_field(&value, max_chars);
        if cleaned.is_empty() {
            None
        } else {
            Some(cleaned)
        }
    })
}

fn normalize_event_type(raw: &str) -> &'static str {
    match raw.trim().to_ascii_lowercase().as_str() {
        "route_enter" => "route_enter",
        "primary_action" => "primary_action",
        "success" => "success",
        "cancel" => "cancel",
        "error" => "error",
        _ => "unknown",
    }
}

/// Best-effort workflow telemetry bridge from frontend to `workflow.log`.
/// This command intentionally does not enforce RBAC so pre-login routes
/// (onboarding/login) can still emit route/action telemetry.
#[tauri::command]
#[tracing::instrument(
    level = "trace",
    skip(event_type, route, action, command, detail, correlation_id)
)]
pub fn log_workflow_event(
    event_type: String,
    route: Option<String>,
    action: Option<String>,
    command: Option<String>,
    detail: Option<String>,
    correlation_id: Option<String>,
) -> Result<(), AppError> {
    let raw_event_type = sanitize_field(&event_type, 48);
    let normalized = normalize_event_type(&raw_event_type);
    let route = sanitize_optional_field(route, 240);
    let action = sanitize_optional_field(action, 120);
    let command = sanitize_optional_field(command, 120);
    let detail = sanitize_optional_field(detail, 320);
    let correlation_id = sanitize_optional_field(correlation_id, 80);

    if normalized == "error" || normalized == "unknown" {
        log_workflow!(
            warn,
            event = "WORKFLOW_EVENT",
            event_type = normalized,
            raw_event_type = %raw_event_type,
            route = route.as_deref().unwrap_or(""),
            action = action.as_deref().unwrap_or(""),
            command = command.as_deref().unwrap_or(""),
            detail = detail.as_deref().unwrap_or(""),
            correlation_id = correlation_id.as_deref().unwrap_or(""),
        );
    } else {
        log_workflow!(
            info,
            event = "WORKFLOW_EVENT",
            event_type = normalized,
            raw_event_type = %raw_event_type,
            route = route.as_deref().unwrap_or(""),
            action = action.as_deref().unwrap_or(""),
            command = command.as_deref().unwrap_or(""),
            detail = detail.as_deref().unwrap_or(""),
            correlation_id = correlation_id.as_deref().unwrap_or(""),
        );
    }
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
