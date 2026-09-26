// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10 + workflow channel).

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowLogEventInput {
    pub workflow: String,
    pub step: String,
    pub outcome: Option<String>,
    pub command: Option<String>,
    pub details: Option<Value>,
    pub error: Option<String>,
}

fn is_sensitive_detail_key(key: &str) -> bool {
    let lower = key.to_ascii_lowercase();
    lower.contains("patient")
        || lower.contains("name")
        || lower.contains("email")
        || lower.contains("phone")
        || lower.contains("address")
        || lower.contains("birth")
        || lower.contains("dob")
        || lower.contains("diagnosis")
        || lower.contains("password")
        || lower.contains("token")
        || lower.contains("secret")
        || lower.contains("license")
}

fn sanitize_detail_value(key: Option<&str>, value: &Value) -> Value {
    if key.is_some_and(is_sensitive_detail_key) {
        return Value::String("[REDACTED]".into());
    }
    match value {
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(k, version)| (k.clone(), sanitize_detail_value(Some(k), version)))
                .collect(),
        ),
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(|item| sanitize_detail_value(None, item))
                .collect(),
        ),
        Value::String(s) => Value::String(logging::sanitizer::sanitize(s)),
        other => other.clone(),
    }
}

fn sanitize_dynamic_path(path: &str) -> String {
    let mut result = Vec::new();
    for segment in path.split('/') {
        if segment.is_empty() {
            result.push(String::new());
            continue;
        }
        let looks_numeric = segment.chars().all(|c| c.is_ascii_digit());
        let looks_id =
            segment.len() >= 8 && segment.chars().all(|c| c.is_ascii_hexdigit() || c == '-');
        if looks_numeric || looks_id {
            result.push(":id".into());
        } else {
            result.push(logging::sanitizer::sanitize(segment));
        }
    }
    let joined = result.join("/");
    if joined.is_empty() {
        "/".into()
    } else {
        joined
    }
}

fn sanitize_workflow_label(raw: &str) -> String {
    let trimmed = raw.trim();
    let (path, query) = trimmed.split_once('?').unwrap_or((trimmed, ""));
    let path_sanitized = sanitize_dynamic_path(path);
    if query.is_empty() {
        path_sanitized
    } else {
        format!("{path_sanitized}?...")
    }
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state, event))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowLogEventInput,
) -> Result<(), AppError> {
    let (actor_role, has_session) = {
        let guard = session_state.lock_session();
        match guard.as_ref() {
            Some((session, _)) => (Some(session.role.clone()), true),
            None => (None, false),
        }
    };
    let workflow = sanitize_workflow_label(&event.workflow);
    let step = logging::sanitizer::sanitize(event.step.trim());
    let outcome = event
        .outcome
        .as_deref()
        .map(logging::sanitizer::sanitize)
        .unwrap_or_else(|| "UNKNOWN".into());
    let command = event
        .command
        .as_deref()
        .map(logging::sanitizer::sanitize)
        .unwrap_or_default();
    let error = event
        .error
        .as_deref()
        .map(logging::sanitizer::sanitize)
        .unwrap_or_default();
    let details = event
        .details
        .as_ref()
        .map(|value| sanitize_detail_value(None, value))
        .and_then(|value| serde_json::to_string(&value).ok())
        .unwrap_or_default();

    log_workflow!(
        info,
        event = "WORKFLOW_EVENT",
        workflow = %workflow,
        step = %step,
        outcome = %outcome,
        command = %command,
        has_session,
        actor_role = actor_role.as_deref().unwrap_or("ANON"),
        details = %details,
        error = %error,
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
        $crate::commands::logging_commands::log_workflow_event,
        $crate::commands::logging_commands::get_log_level,
        $crate::commands::logging_commands::set_log_level,
        $crate::commands::logging_commands::export_logs,
        $crate::commands::logging_commands::verify_audit_chain,
        $crate::commands::logging_commands::log_dir,
    };
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sanitize_workflow_masks_dynamic_path_segments() {
        let value = sanitize_workflow_label("/patients/1234567890abcdef/notes?tab=clinical");
        assert_eq!(value, "/patients/:id/notes?...");
    }

    #[test]
    fn sanitize_details_redacts_sensitive_keys() {
        let input = json!({
            "patientName": "Alice Example",
            "meta": {
                "email": "alice@example.com",
                "note": "password=secret123",
            },
            "ok": true
        });
        let out = sanitize_detail_value(None, &input);
        assert_eq!(out["patientName"], Value::String("[REDACTED]".into()));
        assert_eq!(out["meta"]["email"], Value::String("[REDACTED]".into()));
        assert_eq!(out["meta"]["note"], Value::String("password=***".into()));
        assert_eq!(out["ok"], Value::Bool(true));
    }
}
