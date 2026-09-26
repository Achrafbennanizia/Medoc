// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

const WORKFLOW_TEXT_LIMIT: usize = 160;

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkflowLogStage {
    RouteEnter,
    PrimaryAction,
    Success,
    Cancel,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEvent {
    pub stage: WorkflowLogStage,
    pub workflow: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub error_kind: Option<String>,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub meta: Option<Value>,
}

fn sanitize_workflow_text(raw: &str) -> String {
    let masked = logging::sanitizer::sanitize(raw.trim());
    let mut clipped: String = masked.chars().take(WORKFLOW_TEXT_LIMIT).collect();
    if clipped.is_empty() {
        clipped = "_".into();
    }
    clipped
}

fn sanitize_workflow_optional(raw: Option<String>) -> Option<String> {
    raw.map(|s| sanitize_workflow_text(&s))
        .filter(|s| s.as_str() != "_")
}

fn sanitize_workflow_meta(raw: Option<Value>) -> Option<String> {
    raw.map(|value| sanitize_workflow_text(&value.to_string()))
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn record_workflow_event(event: WorkflowLogEvent) -> Result<(), AppError> {
    let workflow = sanitize_workflow_text(&event.workflow);
    let route = sanitize_workflow_optional(event.route);
    let source = sanitize_workflow_optional(event.source);
    let action = sanitize_workflow_optional(event.action);
    let error_kind = sanitize_workflow_optional(event.error_kind);
    let meta = sanitize_workflow_meta(event.meta);
    let duration_ms = event.duration_ms.unwrap_or_default();

    log_workflow!(
        info,
        event = "WORKFLOW_EVENT",
        stage = ?event.stage,
        workflow = %workflow,
        route = ?route,
        source = ?source,
        action = ?action,
        error_kind = ?error_kind,
        duration_ms,
        meta = ?meta
    );
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
        $crate::commands::logging_commands::verify_audit_chain,
        $crate::commands::logging_commands::log_dir,
        $crate::commands::logging_commands::record_workflow_event,
    };
}
