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
pub struct FrontendWorkflowEvent {
    pub stage: WorkflowStage,
    #[serde(default)]
    pub workflow: Option<String>,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
}

fn sanitize_field(value: &str, max_len: usize) -> String {
    let cleaned = logging::sanitizer::sanitize(value).trim().to_string();
    if cleaned.len() <= max_len {
        cleaned
    } else {
        cleaned.chars().take(max_len).collect()
    }
}

fn sanitize_optional_field(value: Option<String>, max_len: usize) -> Option<String> {
    value.and_then(|raw| {
        let cleaned = sanitize_field(&raw, max_len);
        if cleaned.is_empty() {
            None
        } else {
            Some(cleaned)
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
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_frontend_workflow_event(event: FrontendWorkflowEvent) -> Result<(), AppError> {
    let workflow = sanitize_optional_field(event.workflow, 64).unwrap_or_else(|| "ui".to_string());
    let route = sanitize_optional_field(event.route, 160);
    let action = sanitize_optional_field(event.action, 96);
    let outcome = sanitize_optional_field(event.outcome, 48);
    let detail = sanitize_optional_field(event.detail, 240);
    log_workflow!(
        info,
        event = "UI_WORKFLOW_STEP",
        stage = event.stage.as_str(),
        workflow = %workflow,
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        outcome = outcome.as_deref().unwrap_or(""),
        detail = detail.as_deref().unwrap_or("")
    );
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
        $crate::commands::logging_commands::log_frontend_workflow_event,
        $crate::commands::logging_commands::get_log_level,
        $crate::commands::logging_commands::set_log_level,
        $crate::commands::logging_commands::export_logs,
        $crate::commands::logging_commands::verify_audit_chain,
        $crate::commands::logging_commands::log_dir,
    };
}
