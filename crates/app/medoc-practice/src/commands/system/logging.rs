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

const MAX_FIELD_LEN: usize = 96;
const MAX_DETAIL_LEN: usize = 256;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogPayload {
    pub step: String,
    pub route: Option<String>,
    pub action: Option<String>,
    pub outcome: Option<String>,
    pub command: Option<String>,
    pub duration_ms: Option<u64>,
    pub detail: Option<String>,
}

fn sanitize_text(raw: Option<String>, max_len: usize) -> Option<String> {
    let input = raw?.trim().to_string();
    if input.is_empty() {
        return None;
    }
    let sanitized = logging::sanitizer::sanitize(&input);
    Some(sanitized.chars().take(max_len).collect::<String>())
}

fn normalize_route(raw: Option<String>) -> Option<String> {
    let route = sanitize_text(raw, MAX_FIELD_LEN)?;
    let parts: Vec<&str> = route
        .trim()
        .trim_start_matches('/')
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    if parts.is_empty() {
        None
    } else if parts.len() == 4
        && parts[0] == "patients"
        && parts[2] == "prescription"
        && parts[3] != "new"
    {
        Some("/patients/:id/prescription/:prescriptionId".into())
    } else if parts.len() == 3
        && parts[0] == "tickets"
        && (parts[2] == "edit" || parts[2] == "bearbeiten")
    {
        Some(format!("/tickets/:id/{}", parts[2]))
    } else if parts.len() == 2 && parts[0] == "patients" && parts[1] != "new" {
        Some("/patients/:id".into())
    } else if parts.len() == 2 && parts[0] == "purchase-orders" && parts[1] != "new" {
        Some("/purchase-orders/:id".into())
    } else if parts.len() == 4
        && parts[0] == "administration"
        && parts[1] == "templates"
        && parts[2] == "editor"
    {
        Some("/administration/templates/editor/:id".into())
    } else {
        Some(format!("/{}", parts.join("/")))
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

#[tauri::command]
#[tracing::instrument(level = "debug", skip(payload))]
pub fn log_workflow_event(payload: WorkflowLogPayload) -> Result<(), AppError> {
    let step = sanitize_text(Some(payload.step), MAX_FIELD_LEN)
        .ok_or_else(|| AppError::Validation("workflow step missing".into()))?;
    let route = normalize_route(payload.route);
    let action = sanitize_text(payload.action, MAX_FIELD_LEN);
    let outcome = sanitize_text(payload.outcome, MAX_FIELD_LEN);
    let command = sanitize_text(payload.command, MAX_FIELD_LEN);
    let detail = sanitize_text(payload.detail, MAX_DETAIL_LEN);
    log_workflow!(
        info,
        event = "WORKFLOW_UI_STEP",
        step = %step,
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        outcome = outcome.as_deref().unwrap_or(""),
        command = command.as_deref().unwrap_or(""),
        duration_ms = payload.duration_ms.unwrap_or_default(),
        detail = detail.as_deref().unwrap_or(""),
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
    use super::{normalize_route, sanitize_text, MAX_DETAIL_LEN};

    #[test]
    fn sanitize_text_masks_tokens_and_truncates() {
        let raw = "password=hunter2 token=abcd1234".repeat(30);
        let result = sanitize_text(Some(raw), MAX_DETAIL_LEN).expect("sanitized");
        assert!(result.contains("password=***"));
        assert!(result.contains("token=***"));
        assert!(!result.contains("hunter2"));
        assert!(!result.contains("abcd1234"));
        assert!(result.len() <= MAX_DETAIL_LEN);
    }

    #[test]
    fn normalize_route_redacts_known_dynamic_segments() {
        assert_eq!(
            normalize_route(Some("/patients/p-123/prescription/rx-77".into())).as_deref(),
            Some("/patients/:id/prescription/:prescriptionId")
        );
        assert_eq!(
            normalize_route(Some("/tickets/task-9/edit".into())).as_deref(),
            Some("/tickets/:id/edit")
        );
        assert_eq!(
            normalize_route(Some("/administration/templates/editor/template-5".into())).as_deref(),
            Some("/administration/templates/editor/:id")
        );
    }
}
