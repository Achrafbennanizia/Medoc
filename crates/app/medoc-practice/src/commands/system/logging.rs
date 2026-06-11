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

fn sanitize_workflow_field(input: Option<String>, max_len: usize) -> Option<String> {
    let raw = input?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let clipped = trimmed.chars().take(max_len).collect::<String>();
    Some(logging::sanitizer::sanitize(&clipped))
}

fn sanitize_required_workflow_field(
    name: &str,
    input: Option<String>,
    max_len: usize,
) -> Result<String, AppError> {
    sanitize_workflow_field(input, max_len)
        .ok_or_else(|| AppError::Validation(format!("{name} fehlt")))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowEventInput {
    pub phase: String,
    pub step: String,
    pub outcome: String,
    pub route: Option<String>,
    pub action: Option<String>,
    pub command: Option<String>,
    pub detail: Option<String>,
    pub source: Option<String>,
    pub duration_ms: Option<u64>,
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

/// Records a sanitized workflow breadcrumb from the UI bridge.
///
/// This command is intentionally available pre-auth so login/onboarding
/// workflows can still be traced end-to-end.
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, event))]
pub fn record_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowEventInput,
) -> Result<(), AppError> {
    let phase = sanitize_required_workflow_field("phase", Some(event.phase), 32)?;
    let step = sanitize_required_workflow_field("step", Some(event.step), 64)?;
    let outcome = sanitize_required_workflow_field("outcome", Some(event.outcome), 32)?;
    let route = sanitize_workflow_field(event.route, 256);
    let action = sanitize_workflow_field(event.action, 128);
    let command = sanitize_workflow_field(event.command, 96);
    let detail = sanitize_workflow_field(event.detail, 512);
    let source = sanitize_workflow_field(event.source, 64);

    let (actor_user, actor_role) = {
        let guard = session_state.lock_session();
        match guard.as_ref() {
            Some((session, _)) => (Some(session.user_id.clone()), Some(session.rolle.clone())),
            None => (None, None),
        }
    };

    log_workflow!(
        info,
        event = "WORKFLOW_STEP",
        phase = %phase,
        step = %step,
        outcome = %outcome,
        route = route.as_deref().unwrap_or(""),
        action = action.as_deref().unwrap_or(""),
        command = command.as_deref().unwrap_or(""),
        detail = detail.as_deref().unwrap_or(""),
        source = source.as_deref().unwrap_or("frontend"),
        duration_ms = event.duration_ms.unwrap_or_default(),
        actor_user = actor_user.as_deref().unwrap_or("ANON"),
        actor_role = actor_role.as_deref().unwrap_or("ANON"),
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
    use super::*;

    #[test]
    fn sanitize_workflow_field_masks_token_like_values() {
        let value = sanitize_workflow_field(
            Some("password=secret-token jwt=eyJhbGciOiJIUzI1NiJ9.payload.sig".to_string()),
            300,
        )
        .expect("sanitized");
        assert!(!value.contains("secret-token"));
        assert!(value.contains("password=***"));
        assert!(value.contains("eyJ***"));
    }

    #[test]
    fn sanitize_workflow_field_clips_to_max_len() {
        let raw = "x".repeat(700);
        let value = sanitize_workflow_field(Some(raw), 64).expect("clipped");
        assert!(value.len() <= 64);
    }
}
