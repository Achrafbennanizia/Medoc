// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use uuid::Uuid;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStep {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowStep {
    fn as_str(&self) -> &'static str {
        match self {
            WorkflowStep::RouteEnter => "route_enter",
            WorkflowStep::PrimaryAction => "primary_action",
            WorkflowStep::Success => "success",
            WorkflowStep::Cancel => "cancel",
            WorkflowStep::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEvent {
    pub step: WorkflowStep,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
}

fn looks_like_route_id(segment: &str) -> bool {
    if segment.chars().all(|c| c.is_ascii_digit()) {
        return true;
    }
    if Uuid::parse_str(segment).is_ok() {
        return true;
    }
    segment.len() >= 24
        && segment
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn sanitize_workflow_route(route: Option<&str>) -> Option<String> {
    let raw = route.map(str::trim).filter(|s| !s.is_empty())?;
    let path_only = raw.split(['?', '#']).next().unwrap_or(raw);
    let mut out = Vec::new();
    for segment in path_only.split('/') {
        if segment.is_empty() {
            continue;
        }
        if looks_like_route_id(segment) {
            out.push(":id".to_string());
            continue;
        }
        out.push(logging::sanitizer::sanitize(segment));
    }
    if out.is_empty() {
        Some("/".to_string())
    } else {
        Some(format!("/{}", out.join("/")))
    }
}

fn sanitize_workflow_value(value: Option<&str>, max_chars: usize) -> Option<String> {
    value.map(str::trim).filter(|s| !s.is_empty()).map(|raw| {
        let redacted = logging::sanitizer::sanitize(raw);
        if redacted.chars().count() <= max_chars {
            redacted
        } else {
            let mut shortened = redacted.chars().take(max_chars).collect::<String>();
            shortened.push_str("...");
            shortened
        }
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
#[tracing::instrument(level = "info", skip(session_state, event))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowEvent,
) -> Result<(), AppError> {
    let authenticated = session_state.lock_session().is_some();
    let route = sanitize_workflow_route(event.route.as_deref()).unwrap_or_else(|| "/".to_string());
    let action = sanitize_workflow_value(event.action.as_deref(), 96)
        .unwrap_or_else(|| "unknown".to_string());
    let command =
        sanitize_workflow_value(event.command.as_deref(), 96).unwrap_or_else(|| "n/a".to_string());
    let message =
        sanitize_workflow_value(event.message.as_deref(), 240).unwrap_or_else(|| "".to_string());

    log_workflow!(
        info,
        event = "UI_WORKFLOW_STEP",
        step = event.step.as_str(),
        authenticated,
        route = %route,
        action = %action,
        command = %command,
        message = %message
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
    use super::{sanitize_workflow_route, sanitize_workflow_value};

    #[test]
    fn workflow_route_redacts_dynamic_segments_and_query() {
        let route = sanitize_workflow_route(Some(
            "/patients/5f7a7f00-5b95-463f-a85b-a73bb2a5602f?tab=clinical",
        ));
        assert_eq!(route.as_deref(), Some("/patients/:id"));
    }

    #[test]
    fn workflow_route_keeps_static_segments() {
        let route = sanitize_workflow_route(Some("/administration/finance-reports/day-close"));
        assert_eq!(
            route.as_deref(),
            Some("/administration/finance-reports/day-close")
        );
    }

    #[test]
    fn workflow_value_masks_secret_patterns() {
        let value = sanitize_workflow_value(Some("password=hunter2"), 96);
        assert_eq!(value.as_deref(), Some("password=***"));
    }
}
