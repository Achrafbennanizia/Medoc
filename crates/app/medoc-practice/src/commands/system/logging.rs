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

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowStage {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

impl WorkflowStage {
    fn as_str(self) -> &'static str {
        match self {
            WorkflowStage::RouteEnter => "route_enter",
            WorkflowStage::PrimaryAction => "primary_action",
            WorkflowStage::Success => "success",
            WorkflowStage::Cancel => "cancel",
            WorkflowStage::Error => "error",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEvent {
    pub stage: WorkflowStage,
    pub route: Option<String>,
    pub action: Option<String>,
    pub outcome: Option<String>,
    pub detail: Option<String>,
    pub source: Option<String>,
    pub correlation_id: Option<String>,
    pub duration_ms: Option<u64>,
}

fn sanitize_workflow_value(raw: Option<String>) -> Option<String> {
    let trimmed = raw?.trim().to_string();
    if trimmed.is_empty() {
        return None;
    }
    let sanitized = logging::sanitizer::sanitize(&trimmed);
    let clipped = sanitized
        .chars()
        .take(WORKFLOW_FIELD_LIMIT)
        .collect::<String>();
    if clipped.is_empty() {
        None
    } else {
        Some(clipped)
    }
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state, event))]
pub fn record_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowLogEvent,
) -> Result<(), AppError> {
    let role = {
        let guard = session_state.lock_session();
        guard
            .as_ref()
            .map(|(session, _)| session.role.clone())
            .unwrap_or_else(|| "ANONYMOUS".to_string())
    };
    let authenticated = role != "ANONYMOUS";
    let route = sanitize_workflow_value(event.route);
    let action = sanitize_workflow_value(event.action).unwrap_or_else(|| "-".to_string());
    let outcome = sanitize_workflow_value(event.outcome).unwrap_or_else(|| "-".to_string());
    let detail = sanitize_workflow_value(event.detail).unwrap_or_else(|| "-".to_string());
    let source = sanitize_workflow_value(event.source).unwrap_or_else(|| "frontend".to_string());
    let correlation_id =
        sanitize_workflow_value(event.correlation_id).unwrap_or_else(|| "-".to_string());
    let duration_ms = event.duration_ms.unwrap_or_default();
    let stage = event.stage.as_str();

    match event.stage {
        WorkflowStage::Error => log_workflow!(
            warn,
            event = "UI_WORKFLOW_STEP",
            stage,
            route = %route.as_deref().unwrap_or("-"),
            action = %action,
            outcome = %outcome,
            detail = %detail,
            source = %source,
            correlation_id = %correlation_id,
            duration_ms,
            authenticated,
            role = %role,
        ),
        _ => log_workflow!(
            info,
            event = "UI_WORKFLOW_STEP",
            stage,
            route = %route.as_deref().unwrap_or("-"),
            action = %action,
            outcome = %outcome,
            detail = %detail,
            source = %source,
            correlation_id = %correlation_id,
            duration_ms,
            authenticated,
            role = %role,
        ),
    }
    Ok(())
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

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_logging_commands {
    () => {
        $crate::commands::logging_commands::record_workflow_event,
        $crate::commands::logging_commands::get_log_level,
        $crate::commands::logging_commands::set_log_level,
        $crate::commands::logging_commands::export_logs,
        $crate::commands::logging_commands::verify_audit_chain,
        $crate::commands::logging_commands::log_dir,
    };
}

#[cfg(test)]
mod tests {
    use super::sanitize_workflow_value;

    #[test]
    fn workflow_sanitizer_masks_tokens() {
        let masked = sanitize_workflow_value(Some("password=secret123".to_string()))
            .expect("value should be present");
        assert!(masked.contains("password=***"));
        assert!(!masked.contains("secret123"));
    }

    #[test]
    fn workflow_sanitizer_truncates_long_values() {
        let raw = "a".repeat(500);
        let clipped = sanitize_workflow_value(Some(raw)).expect("value should be present");
        assert_eq!(clipped.chars().count(), 160);
    }
}
