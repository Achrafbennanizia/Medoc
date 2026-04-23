use crate::application::auth_service::{self, LoginRequest, Session};
use crate::error::AppError;
use crate::infrastructure::database::audit_repo;
use crate::infrastructure::logging::brute_force::{BruteForceTracker, CheckResult};
use crate::log_security;
use sqlx::SqlitePool;
use std::sync::Mutex;
use std::time::Instant;
use tauri::State;

/// Holds the active session and the timestamp of the last user interaction.
/// Sessions expire after 30 minutes of inactivity (FA-AUTH-03, NFA-SEC-09).
const IDLE_TIMEOUT_SECS: u64 = 30 * 60;

pub struct SessionState(pub Mutex<Option<(Session, Instant)>>);
pub struct BruteForceState(pub BruteForceTracker);

impl Default for SessionState {
    fn default() -> Self {
        Self::new()
    }
}

impl SessionState {
    pub fn new() -> Self {
        Self(Mutex::new(None))
    }

    /// Poison-safe lock: recovers [Mutex::into_inner] after poison so login/session paths never panic.
    pub fn lock_session(&self) -> std::sync::MutexGuard<'_, Option<(Session, Instant)>> {
        self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// Redacts login identifiers for security logs (limits PII in log files).
fn redact_login_identifier(raw: &str) -> String {
    let Some((local, domain)) = raw.split_once('@') else {
        return "***".into();
    };
    let prefix = local.chars().take(1).collect::<String>();
    format!("{prefix}***@{domain}")
}

#[tauri::command]
pub async fn login(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    brute_force: State<'_, BruteForceState>,
    email: String,
    passwort: String,
) -> Result<Session, AppError> {
    // Use email as the brute-force key for desktop (no real client IP).
    match brute_force.0.check(&email) {
        CheckResult::Locked { remaining_secs } => {
            log_security!(warn,
                event = "LOGIN_BLOCKED_LOCKED",
                subject = %redact_login_identifier(&email),
                remaining_secs
            );
            return Err(AppError::RateLimited(remaining_secs));
        }
        CheckResult::Allowed => {}
    }

    let req = LoginRequest {
        email: email.clone(),
        passwort,
    };
    let session = match auth_service::authenticate(&pool, &req).await {
        Ok(s) => s,
        Err(e) => {
            let locked = brute_force.0.record_failure(&email);
            log_security!(warn,
                event = "LOGIN_FAILED",
                subject = %redact_login_identifier(&email),
                locked
            );
            if locked {
                log_security!(error,
                    event = "BRUTE_FORCE_LOCKOUT",
                    subject = %redact_login_identifier(&email),
                    lockout_secs = 900
                );
            }
            return Err(e);
        }
    };
    brute_force.0.record_success(&email);
    log_security!(info,
        event = "LOGIN_SUCCESS",
        user_id = %session.user_id,
        email = %redact_login_identifier(&session.email),
    );

    audit_repo::create(
        &pool,
        &session.user_id,
        "LOGIN",
        "Personal",
        Some(&session.user_id),
        None,
    )
    .await
    .ok();

    let result = Session {
        user_id: session.user_id.clone(),
        name: session.name.clone(),
        email: session.email.clone(),
        rolle: session.rolle.clone(),
    };

    *session_state.lock_session() = Some((session, Instant::now()));
    Ok(result)
}

#[tauri::command]
pub async fn logout(session_state: State<'_, SessionState>) -> Result<(), AppError> {
    let mut guard = session_state.lock_session();
    if let Some((s, _)) = guard.as_ref() {
        log_security!(info, event = "LOGOUT", user_id = %s.user_id);
    }
    *guard = None;
    Ok(())
}

#[tauri::command]
pub async fn get_session(
    session_state: State<'_, SessionState>,
) -> Result<Option<Session>, AppError> {
    let mut guard = session_state.lock_session();
    if let Some((sess, last)) = guard.as_ref() {
        if last.elapsed().as_secs() > IDLE_TIMEOUT_SECS {
            log_security!(info, event = "SESSION_EXPIRED", user_id = %sess.user_id);
            *guard = None;
            return Ok(None);
        }
    }
    Ok(guard.as_ref().map(|(s, _)| s.clone()))
}

#[tauri::command]
pub async fn touch_session(session_state: State<'_, SessionState>) -> Result<bool, AppError> {
    let mut guard = session_state.lock_session();
    if let Some((_, last)) = guard.as_mut() {
        *last = Instant::now();
        Ok(true)
    } else {
        Ok(false)
    }
}
