// Logging-related Tauri commands (NFA-LOG-09, NFA-LOG-10)

use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::logging::{self, LogLevel, LOGGING_CONFIG};
use crate::{log_system, log_workflow};

#[tauri::command]
#[tracing::instrument(level = "debug", skip(session_state))]
pub fn get_log_level(session_state: State<'_, SessionState>) -> Result<LogLevel, AppError> {
    rbac::require(&session_state, "ops.logs")?;
    Ok(LOGGING_CONFIG.level())
}

/// F137: device-local app_kv key (`logging.` is never synced).
pub const LOG_LEVEL_KV: &str = "logging.level.v1";

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, level))]
pub async fn set_log_level(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    level: LogLevel,
) -> Result<(), AppError> {
    rbac::require(&session_state, "ops.logs")?;
    let prev = LOGGING_CONFIG.level();
    LOGGING_CONFIG.set_level(level);
    let raw = serde_json::to_string(&level).map_err(|e| AppError::Internal(e.to_string()))?;
    medoc_core::infrastructure::database::repos::admin::app_kv::set(&pool, LOG_LEVEL_KV, &raw)
        .await?;
    log_system!(info, event = "LOG_LEVEL_CHANGED", from = ?prev, to = ?level);
    Ok(())
}

/// F137: apply the stored level at startup (it used to reset on every restart).
pub async fn restore_log_level(pool: &SqlitePool) {
    if let Ok(Some(raw)) =
        medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, LOG_LEVEL_KV).await
    {
        if let Ok(level) = serde_json::from_str::<LogLevel>(&raw) {
            LOGGING_CONFIG.set_level(level);
        }
    }
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

/// Severity a UI report may carry. Anything else is rejected (the UI cannot write debug noise to disk).
#[derive(Debug, Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClientLogLevel {
    Error,
    Warn,
    Info,
}

/// One UI event (error boundary, failed command, unexpected state). Mirrors `ClientLogEvent` in
/// packages/shared/src/lib/client-log.ts.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientLogEvent {
    pub level: ClientLogLevel,
    /// Stable code from the error catalogue (`MD-…`) or wire key (`error.…`); empty when unknown.
    #[serde(default)]
    pub code: String,
    pub message: String,
    /// Route the user was on (`/patients/:id`), never query strings.
    #[serde(default)]
    pub route: String,
    /// Backend `ref=` when the UI error came from a command, so both sides can be joined.
    #[serde(default)]
    pub error_ref: Option<String>,
    /// Free-form context (component, action). Redacted like every other log line.
    #[serde(default)]
    pub context: Option<serde_json::Value>,
}

const CLIENT_LOG_MAX_CHARS: usize = 2_000;
const CLIENT_LOG_BURST: u32 = 30;
const CLIENT_LOG_WINDOW_SECS: u64 = 10;

/// Fixed-window rate limit for UI reports: a render loop must not be able to fill the disk.
fn client_log_allowed() -> bool {
    use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
    static WINDOW: AtomicU64 = AtomicU64::new(0);
    static COUNT: AtomicU32 = AtomicU32::new(0);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() / CLIENT_LOG_WINDOW_SECS)
        .unwrap_or(0);
    if WINDOW.swap(now, Ordering::Relaxed) != now {
        COUNT.store(0, Ordering::Relaxed);
    }
    COUNT.fetch_add(1, Ordering::Relaxed) < CLIENT_LOG_BURST
}

fn clip(s: &str, max: usize) -> String {
    s.chars().take(max).collect()
}

/// Writes a UI-side error or warning to `client.log` (and, for warn/error, `errors.log`).
/// No session required: sign-in and start-up errors happen before there is one.
#[tauri::command]
pub fn log_client_event(event: ClientLogEvent) -> Result<(), AppError> {
    if !client_log_allowed() {
        return Ok(());
    }
    let message = clip(&event.message, CLIENT_LOG_MAX_CHARS);
    let code = clip(&event.code, 120);
    let route = clip(event.route.split('?').next().unwrap_or_default(), 200);
    let error_ref = event
        .error_ref
        .as_deref()
        .map(|r| clip(r, 32))
        .unwrap_or_default();
    let context = event
        .context
        .map(|c| clip(&c.to_string(), CLIENT_LOG_MAX_CHARS))
        .unwrap_or_default();
    if matches!(event.level, ClientLogLevel::Error) && !code.is_empty() {
        // Counted for error reports (allow-listed code + area only; editions plan §11.4).
        crate::infrastructure::error_reports::record(&code, &route);
    }
    match event.level {
        ClientLogLevel::Error => {
            tracing::error!(target: "medoc::client", event = "CLIENT_ERROR", code = %code, route = %route, error_ref = %error_ref, context = %context, "{message}")
        }
        ClientLogLevel::Warn => {
            tracing::warn!(target: "medoc::client", event = "CLIENT_WARN", code = %code, route = %route, error_ref = %error_ref, context = %context, "{message}")
        }
        ClientLogLevel::Info => {
            tracing::info!(target: "medoc::client", event = "CLIENT_INFO", code = %code, route = %route, context = %context, "{message}")
        }
    }
    Ok(())
}
