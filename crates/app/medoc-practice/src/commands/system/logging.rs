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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEventInput {
    pub step: String,
    pub workflow: Option<String>,
    pub route: Option<String>,
    pub action: Option<String>,
    pub outcome: Option<String>,
    pub detail: Option<String>,
    pub duration_ms: Option<u64>,
    pub arg_keys: Option<Vec<String>>,
}

fn normalize_step(step: &str) -> &'static str {
    match step.trim().to_ascii_lowercase().as_str() {
        "route_enter" => "route_enter",
        "primary_action" => "primary_action",
        "success" => "success",
        "cancel" => "cancel",
        "error" => "error",
        _ => "other",
    }
}

fn sanitize_text(raw: Option<String>, max_chars: usize) -> Option<String> {
    let raw = raw?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut out: String = logging::sanitizer::sanitize(trimmed)
        .chars()
        .take(max_chars)
        .collect();
    if out.trim().is_empty() {
        None
    } else {
        out.shrink_to_fit();
        Some(out)
    }
}

fn sanitize_arg_keys(arg_keys: Option<Vec<String>>) -> String {
    let mut safe: Vec<String> = Vec::new();
    for key in arg_keys.unwrap_or_default() {
        if safe.len() >= 16 {
            break;
        }
        let cleaned: String = key
            .trim()
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
            .take(48)
            .collect();
        if !cleaned.is_empty() {
            safe.push(cleaned);
        }
    }
    safe.join(",")
}

/// Sanitized frontend workflow → backend logging bridge.
///
/// Accepts route and action telemetry from the UI and writes it into
/// the dedicated `workflow.log` tracing channel.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state, event))]
pub fn record_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowEventInput,
) -> Result<(), AppError> {
    let (authenticated, role) = {
        let guard = session_state.lock_session();
        match guard.as_ref() {
            Some((s, _)) => (true, s.rolle.clone()),
            None => (false, String::new()),
        }
    };
    let step = normalize_step(&event.step);
    let workflow = sanitize_text(event.workflow, 80).unwrap_or_else(|| "ui".to_string());
    let route = sanitize_text(event.route, 140).unwrap_or_default();
    let action = sanitize_text(event.action, 100).unwrap_or_default();
    let outcome = sanitize_text(event.outcome, 100).unwrap_or_default();
    let detail = sanitize_text(event.detail, 180).unwrap_or_default();
    let arg_keys = sanitize_arg_keys(event.arg_keys);
    log_workflow!(
        info,
        event = "UI_WORKFLOW",
        workflow = %workflow,
        step = %step,
        route = %route,
        action = %action,
        outcome = %outcome,
        detail = %detail,
        duration_ms = event.duration_ms.unwrap_or(0),
        arg_keys = %arg_keys,
        authenticated,
        role = %role,
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
    use super::{normalize_step, sanitize_arg_keys, sanitize_text};

    #[test]
    fn normalizes_unknown_step_to_other() {
        assert_eq!(normalize_step("unexpected"), "other");
    }

    #[test]
    fn sanitizes_sensitive_workflow_text() {
        let value = sanitize_text(Some("password=secret token=abc".to_string()), 120)
            .expect("sanitized string");
        assert!(value.contains("password=***"));
        assert!(value.contains("token=***"));
        assert!(!value.contains("secret"));
    }

    #[test]
    fn keeps_only_safe_argument_keys() {
        let keys = sanitize_arg_keys(Some(vec![
            "patient_id".to_string(),
            "__proto__".to_string(),
            "bad key!".to_string(),
        ]));
        assert_eq!(keys, "patient_id,__proto__,badkey");
    }
}
