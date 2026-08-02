use crate::application::auth_service::{self, LoginRequest, Session};
use crate::application::device_session_service;
use crate::application::mvp_security;
use crate::application::rbac;
use crate::error::AppError;
use crate::infrastructure::database::personal_repo;
use crate::infrastructure::database::{audit_repo, device_session_repo, personal_permission_repo};
use crate::infrastructure::logging::brute_force::{
    BruteForceTracker, BruteKey, CheckResult, DESKTOP_PEER_IP,
};
// TODO(deferred-security): 2FA unwired — see todos-deferred-security-features.md
// use crate::infrastructure::totp::{self, TotpEnrollmentDto};
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
#[allow(clippy::too_many_arguments)]
#[tracing::instrument(level = "info", skip(pool, session_state, brute_force, passwort), fields(subject = %redact_login_identifier(&email)))]
pub async fn login(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    brute_force: State<'_, BruteForceState>,
    email: String,
    passwort: String,
    #[allow(unused_variables)]
    totp_code: Option<String>,
    device_label: Option<String>,
    user_agent: Option<String>,
) -> Result<Session, AppError> {
    let brute_key = BruteKey::from_subject(&email, DESKTOP_PEER_IP)?;
    let pool_ref: &SqlitePool = &pool;
    match brute_force.0.check(Some(pool_ref), &brute_key).await {
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
        totp_code: None, // TODO(deferred-security): 2FA unwired
    };
    let mut session = match auth_service::authenticate(&pool, &req).await {
        Ok(s) => s,
        Err(e) => {
            let locked = brute_force
                .0
                .record_failure(Some(pool_ref), &brute_key)
                .await;
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
    // TODO(deferred-roles): remove when STEUERBERATER / PHARMABERATER are re-enabled.
    if !rbac::Role::parse(&session.rolle)
        .map(|r| !r.is_deferred())
        .unwrap_or(false)
        || !rbac::is_login_role_allowed(&session.rolle)
    {
        log_security!(warn,
            event = "LOGIN_BLOCKED_DEFERRED_ROLE",
            subject = %redact_login_identifier(&email),
            role = %session.rolle,
        );
        return Err(AppError::Unauthorized);
    }
    brute_force
        .0
        .record_success(Some(pool_ref), &brute_key)
        .await;
    log_security!(info,
        event = "LOGIN_SUCCESS",
        user_id = %session.user_id,
        email = %redact_login_identifier(&session.email),
    );

    session.permission_overrides =
        personal_permission_repo::list_for_personal(&pool, &session.user_id).await?;

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

    let ds_id = uuid::Uuid::new_v4().to_string();
    let label = device_label
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "MeDoc-Desktop".into());
    device_session_repo::insert(
        &pool,
        &ds_id,
        &session.user_id,
        &label,
        user_agent.as_deref(),
    )
    .await?;

    let result = Session {
        user_id: session.user_id.clone(),
        name: session.name.clone(),
        email: session.email.clone(),
        rolle: session.rolle.clone(),
        permission_overrides: session.permission_overrides.clone(),
        device_session_id: Some(ds_id),
    };

    *session_state.lock_session() = Some((result.clone(), Instant::now()));
    Ok(result)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn logout(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<(), AppError> {
    let device_id = {
        let guard = session_state.lock_session();
        guard
            .as_ref()
            .and_then(|(s, _)| s.device_session_id.clone())
    };
    if let Some(ref id) = device_id {
        let _ = device_session_repo::end(&pool, id).await;
    }
    let work_time_logout = {
        let guard = session_state.lock_session();
        guard.as_ref().map(|(s, _)| {
            log_security!(info, event = "LOGOUT", user_id = %s.user_id);
            s.user_id.clone()
        })
    };
    if let Some(user_id) = work_time_logout {
        if let Ok(pref) =
            crate::commands::work_time_commands::get_or_create_preference(&pool, &user_id).await
        {
            if pref.auto_record_on_logout {
                let _ = crate::commands::work_time_commands::end_open_session_for_user(
                    &pool,
                    &user_id,
                    "logout",
                )
                .await;
            }
        }
    }
    let mut guard = session_state.lock_session();
    *guard = None;
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_session(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Option<Session>, AppError> {
    let expired_device_id = {
        let mut guard = session_state.lock_session();
        match guard.as_ref() {
            Some((sess, last)) if last.elapsed().as_secs() > IDLE_TIMEOUT_SECS => {
                log_security!(info, event = "SESSION_EXPIRED", user_id = %sess.user_id);
                let id = sess.device_session_id.clone();
                *guard = None;
                id
            }
            _ => None,
        }
    };
    if let Some(ref id) = expired_device_id {
        let _ = device_session_repo::end(&pool, id).await;
        return Ok(None);
    }
    let guard = session_state.lock_session();
    Ok(guard.as_ref().map(|(s, _)| s.clone()))
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn touch_session(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<bool, AppError> {
    let device_id = {
        let mut guard = session_state.lock_session();
        if let Some((s, last)) = guard.as_mut() {
            *last = Instant::now();
            s.device_session_id.clone()
        } else {
            None
        }
    };
    if let Some(ref id) = device_id {
        device_session_repo::touch(&pool, id).await?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn list_my_device_sessions(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<device_session_repo::DeviceSessionRow>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    device_session_service::list_enriched_for_user(
        &pool,
        &session.user_id,
        session.device_session_id.as_deref(),
    )
    .await
}

/// Ends all **other** device sessions for this user (not the current one).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn revoke_my_other_device_sessions(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<u64, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let keep = session
        .device_session_id
        .as_deref()
        .ok_or_else(|| AppError::validation_code("error.auth.no_device_session_id"))?;
    let n = device_session_repo::end_other_than(&pool, &session.user_id, keep).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DEVICE_SESSION_REVOKE",
        "DeviceSession",
        None,
        Some(&format!("bulk_other_count={n}")),
    )
    .await
    .ok();
    Ok(n)
}

/// Forensic details for one of the caller's own device sessions (audit + risk indicators).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state), fields(session_id = %session_id))]
pub async fn investigate_my_device_session(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    session_id: String,
) -> Result<device_session_repo::DeviceSessionInvestigation, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let report = device_session_service::investigate_session(
        &pool,
        &session.user_id,
        session_id.trim(),
        session.device_session_id.as_deref(),
    )
    .await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DEVICE_SESSION_INVESTIGATE",
        "DeviceSession",
        Some(report.session.id.as_str()),
        Some(&format!(
            "suspected={}; reasons={}",
            report.session.is_suspected,
            report.session.suspected_reasons.join("; ")
        )),
    )
    .await
    .ok();
    Ok(report)
}

/// Ends a single **other** device session for this user.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state), fields(session_id = %session_id))]
pub async fn revoke_my_device_session(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    session_id: String,
) -> Result<(), AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    device_session_service::revoke_session(
        &pool,
        &session.user_id,
        session_id.trim(),
        session.device_session_id.as_deref(),
    )
    .await
}

/// Set or revoke trust for another of the caller's own device sessions.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state), fields(session_id = %session_id, trusted))]
pub async fn set_my_device_session_trusted(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    session_id: String,
    trusted: bool,
) -> Result<device_session_repo::DeviceSessionRow, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    device_session_service::set_session_trusted(
        &pool,
        &session.user_id,
        session_id.trim(),
        session.device_session_id.as_deref(),
        trusted,
    )
    .await
}

/*
// TODO(deferred-security): 2FA login enrollment IPC — re-enable with TOTP_2FA_ENABLED.

/// Start TOTP enrollment before a session exists (ARZT first login).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, passwort), fields(email = %redact_login_identifier(&email)))]
pub async fn start_totp_enrollment_login(
    pool: State<'_, SqlitePool>,
    email: String,
    passwort: String,
) -> Result<TotpEnrollmentDto, AppError> {
    mvp_security::require_totp_enabled()?;
    auth_service::verify_credentials(&pool, &email, &passwort).await?;
    let user = personal_repo::find_by_email(&pool, &email)
        .await?
        .ok_or(AppError::Unauthorized)?;
    if !personal_repo::totp_required_for_role(&user.rolle) {
        return Err(AppError::validation_code("error.auth.totp_optional_role"));
    }
    if personal_repo::is_totp_enrolled(&user) {
        return Err(AppError::Conflict("Two-factor authentication is already active".into()));
    }
    let (secret, dto) = totp::generate_enrollment(&user.email)?;
    personal_repo::set_totp_pending_secret(&pool, &user.id, &secret).await?;
    Ok(dto)
}

/// Confirm TOTP enrollment before a session exists; completes ARZT onboarding.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, passwort, code), fields(email = %redact_login_identifier(&email)))]
pub async fn confirm_totp_enrollment_login(
    pool: State<'_, SqlitePool>,
    email: String,
    passwort: String,
    code: String,
) -> Result<(), AppError> {
    mvp_security::require_totp_enabled()?;
    auth_service::verify_credentials(&pool, &email, &passwort).await?;
    let user = personal_repo::find_by_email(&pool, &email)
        .await?
        .ok_or(AppError::Unauthorized)?;
    let secret = user
        .totp_secret
        .as_deref()
        .ok_or_else(|| AppError::validation_code("error.auth.totp_setup_not_started"))?;
    if !totp::verify_code(secret, &code)? {
        return Err(AppError::validation_code("error.auth.totp_invalid_code"));
    }
    personal_repo::confirm_totp_enrollment(&pool, &user.id).await?;
    Ok(())
}
*/

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_auth_commands {
    () => {
        $crate::commands::auth_commands::login,
        $crate::commands::auth_commands::logout,
        $crate::commands::auth_commands::get_session,
        $crate::commands::auth_commands::touch_session,
        $crate::commands::auth_commands::list_my_device_sessions,
        $crate::commands::auth_commands::revoke_my_other_device_sessions,
        $crate::commands::auth_commands::investigate_my_device_session,
        $crate::commands::auth_commands::revoke_my_device_session,
        $crate::commands::auth_commands::set_my_device_session_trusted,
        // TODO(deferred-security): 2FA IPC unwired
        // $crate::commands::auth_commands::start_totp_enrollment_login,
        // $crate::commands::auth_commands::confirm_totp_enrollment_login,
    };
}
