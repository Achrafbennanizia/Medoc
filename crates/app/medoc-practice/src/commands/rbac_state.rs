//! Tauri-State-bound RBAC entry points (`require`, `require_one_of`,
//! `require_authenticated`).
//!
//! Lives under `commands/` because each helper takes a
//! `&State<'_, SessionState>` — a Tauri runtime concept. The pure
//! policy (Role enum, matrix lookup, `effective_allowed`) stays in
//! `application::rbac` (or, eventually, `medoc-core`). The State-bound
//! functions are re-exported from `application::rbac` to keep the many
//! `use crate::application::rbac::require;` call sites compiling.

use std::time::{Duration, Instant};
use tauri::State;

use crate::application::auth_service::Session;
use crate::application::rbac::{effective_allowed, Role};
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::log_security;

/// Same bound as [`crate::application::authorize::IDLE_TIMEOUT`].
const IDLE_TIMEOUT: Duration = Duration::from_secs(30 * 60);

/// Returns the session, or clears it and returns unauthorized after 30 minutes idle.
fn live_session(slot: &mut Option<(Session, Instant)>) -> Result<Session, AppError> {
    let idle = slot
        .as_ref()
        .is_some_and(|(_, last)| last.elapsed() > IDLE_TIMEOUT);
    if idle {
        crate::commands::admin::auth::set_slot(slot, None);
        return Err(AppError::Unauthorized);
    }
    slot.as_ref()
        .map(|(session, _)| session.clone())
        .ok_or(AppError::Unauthorized)
}

/// Require any non-expired session (same idle semantics as [`require`] —
/// caller must hold a session row). Does not check role / permission matrix.
pub fn require_authenticated(session_state: &State<'_, SessionState>) -> Result<Session, AppError> {
    let mut guard = session_state.lock_session();
    live_session(&mut guard)
}

/// Extract the active session from state and verify it has permission.
/// Logs an `ACCESS_DENIED` event when authorisation fails.
pub fn require(session_state: &State<'_, SessionState>, action: &str) -> Result<Session, AppError> {
    let mut guard = session_state.lock_session();
    let session = live_session(&mut guard)?;
    let role = Role::parse(&session.role).ok_or(AppError::Forbidden)?;
    if !effective_allowed(action, role, &session.permission_overrides) {
        log_security!(warn,
            event = "ACCESS_DENIED",
            user_id = %session.user_id,
            role = %session.role,
            action = action,
        );
        return Err(AppError::Forbidden);
    }
    if action.starts_with("ops.")
        && action != "ops.audit_chain_ack"
        && crate::application::audit_chain_guard::blocks_ops()
    {
        log_security!(error,
            event = "ACCESS_DENIED",
            user_id = %session.user_id,
            role = %session.role,
            action = action,
            reason = "audit_chain_broken",
        );
        return Err(AppError::Forbidden);
    }
    Ok(session.clone())
}

/// Session allowed when at least one of the actions is granted for the role
/// (e.g. doctor `patient.read_medical` or reception `patient.read_documents`).
pub fn require_one_of(
    session_state: &State<'_, SessionState>,
    actions: &[&str],
) -> Result<Session, AppError> {
    let mut guard = session_state.lock_session();
    let session = live_session(&mut guard)?;
    let role = Role::parse(&session.role).ok_or(AppError::Forbidden)?;
    if actions
        .iter()
        .any(|a| effective_allowed(a, role, &session.permission_overrides))
    {
        return Ok(session.clone());
    }
    log_security!(warn,
        event = "ACCESS_DENIED",
        user_id = %session.user_id,
        role = %session.role,
        action = ?actions,
    );
    Err(AppError::Forbidden)
}

#[cfg(test)]
mod tests {
    use super::live_session;
    use crate::application::auth_service::Session;
    use std::time::{Duration, Instant};

    fn session() -> Session {
        Session {
            user_id: "u".into(),
            name: "A".into(),
            email: "a@practice.de".into(),
            role: "PHYSICIAN".into(),
            permission_overrides: vec![],
            device_session_id: None,
            token_version: 0,
        }
    }

    #[test]
    fn idle_session_is_cleared() {
        let past = Instant::now()
            .checked_sub(Duration::from_secs(31 * 60))
            .expect("system uptime is under 31 minutes");
        let mut slot = Some((session(), past));
        assert!(live_session(&mut slot).is_err());
        assert!(slot.is_none());
    }

    #[test]
    fn fresh_session_stays() {
        let mut slot = Some((session(), Instant::now()));
        assert!(live_session(&mut slot).is_ok());
        assert!(slot.is_some());
    }
}
