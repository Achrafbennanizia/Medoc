// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::log_system;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowStepPayload {
    pub route: String,
    pub step: String,
    pub status: String,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
}

#[derive(Debug)]
struct SanitizedWorkflowStep {
    route: String,
    step: String,
    status: String,
    action: Option<String>,
    detail: Option<String>,
}

fn sanitize_workflow_text(raw: &str, max_len: usize) -> String {
    let collapsed = logging::sanitizer::sanitize(raw)
        .replace(['\n', '\r'], " ")
        .trim()
        .to_string();
    collapsed.chars().take(max_len).collect()
}

fn looks_like_uuid(segment: &str) -> bool {
    let b = segment.as_bytes();
    if b.len() != 36 {
        return false;
    }
    for (idx, ch) in b.iter().enumerate() {
        if [8, 13, 18, 23].contains(&idx) {
            if *ch != b'-' {
                return false;
            }
            continue;
        }
        if !(*ch as char).is_ascii_hexdigit() {
            return false;
        }
    }
    true
}

fn should_redact_route_segment(segment: &str) -> bool {
    if segment.is_empty() || matches!(segment, "new" | "edit" | "bearbeiten") {
        return false;
    }
    if segment.chars().all(|ch| ch.is_ascii_digit()) || looks_like_uuid(segment) {
        return true;
    }
    let has_digit = segment.chars().any(|ch| ch.is_ascii_digit());
    let has_alpha = segment.chars().any(|ch| ch.is_ascii_alphabetic());
    let has_sep = segment.contains('-') || segment.contains('_');
    segment.len() >= 8 && has_digit && (has_alpha || has_sep)
}

fn sanitize_workflow_route(route: &str) -> String {
    let cleaned = sanitize_workflow_text(route, 256);
    let path_only = cleaned
        .split(['?', '#'])
        .next()
        .unwrap_or_default()
        .to_string();
    let mut segments = Vec::new();
    for segment in path_only.split('/') {
        if segment.is_empty() {
            continue;
        }
        if should_redact_route_segment(segment) {
            segments.push(":id".to_string());
        } else {
            segments.push(segment.to_string());
        }
    }
    if segments.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", segments.join("/"))
    }
}

fn sanitize_workflow_payload(payload: WorkflowStepPayload) -> SanitizedWorkflowStep {
    let action = payload
        .action
        .map(|raw| sanitize_workflow_text(&raw, 80))
        .filter(|v| !v.is_empty());
    let detail = payload
        .detail
        .map(|raw| sanitize_workflow_text(&raw, 160))
        .filter(|v| !v.is_empty());
    SanitizedWorkflowStep {
        route: sanitize_workflow_route(&payload.route),
        step: sanitize_workflow_text(&payload.step, 48),
        status: sanitize_workflow_text(&payload.status, 48),
        action,
        detail,
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
#[tracing::instrument(level = "debug", skip(session_state, payload))]
pub fn log_workflow_step(
    session_state: State<'_, SessionState>,
    payload: WorkflowStepPayload,
) -> Result<(), AppError> {
    rbac::require_authenticated(&session_state)?;
    let sanitized = sanitize_workflow_payload(payload);
    tracing::info!(
        target: "medoc::workflow",
        event = "WORKFLOW_STEP",
        route = %sanitized.route,
        step = %sanitized.step,
        status = %sanitized.status,
        action = sanitized.action.as_deref().unwrap_or(""),
        detail = sanitized.detail.as_deref().unwrap_or(""),
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
        $crate::commands::logging_commands::log_workflow_step,
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_workflow_route_redacts_dynamic_segments() {
        let route = sanitize_workflow_route("/patients/seed-yr-pat-0120?tab=overview");
        assert_eq!(route, "/patients/:id");
        let uuid_route = sanitize_workflow_route(
            "/administration/templates/editor/5f47f130-4cbf-4c0f-b4c1-5f8ff3b24782",
        );
        assert_eq!(uuid_route, "/administration/templates/editor/:id");
    }

    #[test]
    fn sanitize_workflow_payload_masks_secrets() {
        let payload = WorkflowStepPayload {
            route: "/settings".into(),
            step: "error".into(),
            status: "error".into(),
            action: Some("save_settings".into()),
            detail: Some("password=hunter2 token=abcd1234".into()),
        };
        let sanitized = sanitize_workflow_payload(payload);
        assert_eq!(sanitized.route, "/settings");
        assert!(sanitized
            .detail
            .as_deref()
            .is_some_and(|v| v.contains("password=***")));
        assert!(sanitized
            .detail
            .as_deref()
            .is_some_and(|v| !v.contains("hunter2")));
    }
}
