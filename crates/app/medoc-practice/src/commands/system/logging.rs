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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct WorkflowLogEvent {
    pub step: String,
    pub route: Option<String>,
    pub action: Option<String>,
    pub outcome: Option<String>,
    pub detail: Option<String>,
    pub duration_ms: Option<u64>,
}

fn sanitize_text(value: Option<&str>) -> Option<String> {
    value
        .map(sanitizer::sanitize)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(|s| {
            const MAX_LEN: usize = 256;
            if s.len() <= MAX_LEN {
                s
            } else {
                format!("{}…", &s[..MAX_LEN])
            }
        })
}

fn sanitize_step(step: &str) -> String {
    sanitize_text(Some(step))
        .unwrap_or_else(|| "unknown".into())
        .to_ascii_lowercase()
}

fn sanitize_route(route: Option<&str>) -> Option<String> {
    let route = sanitize_text(route)?;
    let bare = route.split('?').next().unwrap_or(route.as_str());
    let mut parts = Vec::new();
    for segment in bare.split('/') {
        if segment.is_empty() {
            continue;
        }
        let looks_like_id = segment.len() > 8
            && segment
                .chars()
                .all(|c| c.is_ascii_hexdigit() || c == '-' || c == '_');
        if looks_like_id {
            parts.push(":id".to_string());
        } else {
            parts.push(segment.to_string());
        }
    }
    Some(format!("/{}", parts.join("/")))
}

fn actor_from_state(session_state: &State<'_, SessionState>) -> Option<(String, String)> {
    let guard = session_state.lock_session();
    let (session, _) = guard.as_ref()?;
    let actor = sanitizer::mask_token(&session.user_id);
    let role = sanitizer::sanitize(&session.rolle);
    Some((actor, role))
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

/// Frontend → backend workflow bridge.
///
/// We intentionally keep this unauthenticated so pre-login route transitions
/// can be observed as part of the startup and onboarding workflows.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state, event))]
pub fn log_workflow_event(
    session_state: State<'_, SessionState>,
    event: WorkflowLogEvent,
) -> Result<(), AppError> {
    let step = sanitize_step(&event.step);
    let route = sanitize_route(event.route.as_deref());
    let action = sanitize_text(event.action.as_deref());
    let outcome = sanitize_text(event.outcome.as_deref());
    let detail = sanitize_text(event.detail.as_deref());
    let duration_ms = event.duration_ms;
    let actor = actor_from_state(&session_state);

    let (actor_id, actor_role) = actor
        .map(|(id, role)| (Some(id), Some(role)))
        .unwrap_or((None, None));

    match step.as_str() {
        "error" => log_workflow!(
            error,
            event = "UI_WORKFLOW",
            step = %step,
            route = route.as_deref().unwrap_or(""),
            action = action.as_deref().unwrap_or(""),
            outcome = outcome.as_deref().unwrap_or(""),
            detail = detail.as_deref().unwrap_or(""),
            duration_ms = duration_ms.unwrap_or_default(),
            actor = actor_id.as_deref().unwrap_or(""),
            role = actor_role.as_deref().unwrap_or(""),
        ),
        "cancel" => log_workflow!(
            warn,
            event = "UI_WORKFLOW",
            step = %step,
            route = route.as_deref().unwrap_or(""),
            action = action.as_deref().unwrap_or(""),
            outcome = outcome.as_deref().unwrap_or(""),
            detail = detail.as_deref().unwrap_or(""),
            duration_ms = duration_ms.unwrap_or_default(),
            actor = actor_id.as_deref().unwrap_or(""),
            role = actor_role.as_deref().unwrap_or(""),
        ),
        _ => log_workflow!(
            info,
            event = "UI_WORKFLOW",
            step = %step,
            route = route.as_deref().unwrap_or(""),
            action = action.as_deref().unwrap_or(""),
            outcome = outcome.as_deref().unwrap_or(""),
            detail = detail.as_deref().unwrap_or(""),
            duration_ms = duration_ms.unwrap_or_default(),
            actor = actor_id.as_deref().unwrap_or(""),
            role = actor_role.as_deref().unwrap_or(""),
        ),
    }
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
