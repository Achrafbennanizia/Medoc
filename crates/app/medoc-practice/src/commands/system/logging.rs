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

const WORKFLOW_FIELD_MAX_LEN: usize = 160;

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
            Self::RouteEnter => "route_enter",
            Self::PrimaryAction => "primary_action",
            Self::Success => "success",
            Self::Cancel => "cancel",
            Self::Error => "error",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct WorkflowEventInput {
    pub step: WorkflowStep,
    pub route: Option<String>,
    pub action: Option<String>,
    pub detail: Option<String>,
    pub context: Option<String>,
}

#[derive(Debug, Clone)]
struct WorkflowEvent {
    step: WorkflowStep,
    route: Option<String>,
    action: Option<String>,
    detail: Option<String>,
    context: Option<String>,
}

fn sanitize_workflow_value(value: Option<String>) -> Option<String> {
    let raw = value?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut sanitized = logging::sanitizer::sanitize(trimmed);
    if sanitized.len() > WORKFLOW_FIELD_MAX_LEN {
        sanitized.truncate(WORKFLOW_FIELD_MAX_LEN);
    }
    Some(sanitized)
}

fn sanitize_workflow_route(value: Option<String>) -> Option<String> {
    let route = sanitize_workflow_value(value)?;
    let redacted = route
        .split('/')
        .map(|segment| {
            let is_id_like = (segment.len() >= 16
                && segment
                    .chars()
                    .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-'))
                || (segment.len() >= 2 && segment.chars().all(|c| c.is_ascii_digit()));
            if is_id_like {
                ":id".to_string()
            } else {
                segment.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("/");
    Some(redacted)
}

impl WorkflowEventInput {
    fn sanitize(self) -> WorkflowEvent {
        WorkflowEvent {
            step: self.step,
            route: sanitize_workflow_route(self.route),
            action: sanitize_workflow_value(self.action),
            detail: sanitize_workflow_value(self.detail),
            context: sanitize_workflow_value(self.context),
        }
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

/// Sanitized frontend → backend workflow bridge.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowEventInput) -> Result<(), AppError> {
    let event = event.sanitize();
    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        step = event.step.as_str(),
        route = event.route.as_deref().unwrap_or(""),
        action = event.action.as_deref().unwrap_or(""),
        detail = event.detail.as_deref().unwrap_or(""),
        context = event.context.as_deref().unwrap_or(""),
    );
    Ok(())
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

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_logging_commands {
    () => {
        $crate::commands::logging_commands::get_log_level,
        $crate::commands::logging_commands::set_log_level,
        $crate::commands::logging_commands::export_logs,
        $crate::commands::logging_commands::log_workflow_event,
        $crate::commands::logging_commands::verify_audit_chain,
        $crate::commands::logging_commands::log_dir,
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_masks_secrets_and_truncates() {
        let event = WorkflowEventInput {
            step: WorkflowStep::Error,
            route: Some("/patienten/123".into()),
            action: Some("create_patient".into()),
            detail: Some(format!("password=secret {}", "x".repeat(300))),
            context: Some("  ctx  ".into()),
        }
        .sanitize();

        let detail = event.detail.expect("detail");
        assert!(detail.contains("password=***"));
        assert!(!detail.contains("secret"));
        assert!(detail.len() <= WORKFLOW_FIELD_MAX_LEN);
        assert_eq!(event.route.as_deref(), Some("/patienten/:id"));
        assert_eq!(event.context.as_deref(), Some("ctx"));
    }

    #[test]
    fn sanitize_drops_blank_values() {
        let event = WorkflowEventInput {
            step: WorkflowStep::RouteEnter,
            route: Some("   ".into()),
            action: None,
            detail: Some("\n".into()),
            context: None,
        }
        .sanitize();

        assert!(event.route.is_none());
        assert!(event.detail.is_none());
    }
}
