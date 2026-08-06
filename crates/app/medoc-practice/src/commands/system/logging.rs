// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::{self, sanitizer, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

const WORKFLOW_MAX_FIELD_CHARS: usize = 128;
const WORKFLOW_MAX_DETAIL_CHARS: usize = 512;
const WORKFLOW_MAX_ARG_KEYS: usize = 24;
const WORKFLOW_MAX_ARG_KEY_CHARS: usize = 64;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowLogEventInput {
    pub workflow: String,
    pub step: String,
    #[serde(default)]
    pub route: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    #[serde(default)]
    pub arg_keys: Vec<String>,
}

fn sanitize_string(value: &str, max_chars: usize) -> String {
    sanitizer::sanitize(value.trim())
        .chars()
        .take(max_chars)
        .collect::<String>()
}

fn sanitize_non_empty(value: &str, max_chars: usize) -> Option<String> {
    let cleaned = sanitize_string(value, max_chars);
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn sanitize_optional(value: Option<String>, max_chars: usize) -> Option<String> {
    value
        .as_deref()
        .and_then(|v| sanitize_non_empty(v, max_chars))
}

fn sanitize_arg_keys(keys: Vec<String>) -> Vec<String> {
    keys.into_iter()
        .take(WORKFLOW_MAX_ARG_KEYS)
        .filter_map(|raw| {
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                return None;
            }
            let mut out = String::with_capacity(trimmed.len().min(WORKFLOW_MAX_ARG_KEY_CHARS));
            for ch in trimmed.chars() {
                if out.len() >= WORKFLOW_MAX_ARG_KEY_CHARS {
                    break;
                }
                if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.' {
                    out.push(ch);
                }
            }
            if out.is_empty() {
                None
            } else {
                Some(out)
            }
        })
        .collect()
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

/// Frontend → backend workflow telemetry bridge.
///
/// Intentionally does **not** require auth: login/onboarding workflows must be
/// loggable before a session exists. Inputs are sanitised and truncated to
/// avoid persisting PII-heavy payloads.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(event))]
pub fn log_workflow_event(event: WorkflowLogEventInput) -> Result<(), AppError> {
    let Some(workflow) = sanitize_non_empty(&event.workflow, WORKFLOW_MAX_FIELD_CHARS) else {
        return Ok(());
    };
    let Some(step) = sanitize_non_empty(&event.step, WORKFLOW_MAX_FIELD_CHARS) else {
        return Ok(());
    };
    let route = sanitize_optional(event.route, WORKFLOW_MAX_FIELD_CHARS);
    let action = sanitize_optional(event.action, WORKFLOW_MAX_FIELD_CHARS);
    let command = sanitize_optional(event.command, WORKFLOW_MAX_FIELD_CHARS);
    let outcome = sanitize_optional(event.outcome, WORKFLOW_MAX_FIELD_CHARS)
        .unwrap_or_else(|| "event".to_string());
    let detail = sanitize_optional(event.detail, WORKFLOW_MAX_DETAIL_CHARS);
    let error = sanitize_optional(event.error, WORKFLOW_MAX_DETAIL_CHARS);
    let arg_keys = sanitize_arg_keys(event.arg_keys);
    let duration_ms = event.duration_ms.unwrap_or(0);

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        workflow = %workflow,
        step = %step,
        outcome = %outcome,
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        command = command.as_deref().unwrap_or(""),
        detail = detail.as_deref().unwrap_or(""),
        error = error.as_deref().unwrap_or(""),
        duration_ms,
        arg_keys = ?arg_keys,
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitize_string_masks_secrets_and_truncates() {
        let raw = "password=hunter2 token=abc123";
        let masked = sanitize_string(raw, 24);
        assert!(masked.contains("password=***"));
        assert!(!masked.contains("hunter2"));
        assert!(masked.len() <= 24);
    }

    #[test]
    fn sanitize_arg_keys_filters_invalid_chars_and_caps_length() {
        let keys = sanitize_arg_keys(vec![
            " patient_id ".into(),
            "normal-key".into(),
            "bad key !".into(),
            "".into(),
            "x".repeat(300),
        ]);
        assert_eq!(keys[0], "patient_id");
        assert_eq!(keys[1], "normal-key");
        assert_eq!(keys[2], "badkey");
        assert!(keys[3].len() <= WORKFLOW_MAX_ARG_KEY_CHARS);
    }
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
