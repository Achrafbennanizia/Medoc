//! Tauri-State-bound RBAC entry points (`require`, `require_one_of`,
//! `require_authenticated`).
//!
//! Lives under `commands/` because each helper takes a
//! `&State<'_, SessionState>` — a Tauri runtime concept. The pure
//! policy (Role enum, matrix lookup, `effective_allowed`) stays in
//! `application::rbac` (or, eventually, `medoc-core`). The State-bound
//! functions are re-exported from `application::rbac` to keep the many
//! `use crate::application::rbac::require;` call sites compiling.

use tauri::State;

use crate::application::auth_service::Session;
use crate::application::rbac::{effective_allowed, Role};
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::log_security;

/// Require any non-expired session (same idle semantics as [`require`] —
/// caller must hold a session row). Does not check role / permission matrix.
pub fn require_authenticated(session_state: &State<'_, SessionState>) -> Result<Session, AppError> {
    let guard: std::sync::MutexGuard<'_, Option<(Session, std::time::Instant)>> =
        session_state.lock_session();
    let (session, _) = guard.as_ref().ok_or(AppError::Unauthorized)?;
    Ok(session.clone())
}

/// Extract the active session from state and verify it has permission.
/// Logs an `ACCESS_DENIED` event when authorisation fails.
pub fn require(session_state: &State<'_, SessionState>, action: &str) -> Result<Session, AppError> {
    let guard: std::sync::MutexGuard<'_, Option<(Session, std::time::Instant)>> =
        session_state.lock_session();
    let (session, _) = guard.as_ref().ok_or(AppError::Unauthorized)?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Forbidden)?;
    if !effective_allowed(action, role, &session.permission_overrides) {
        log_security!(warn,
            event = "ACCESS_DENIED",
            user_id = %session.user_id,
            role = %session.rolle,
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
            role = %session.rolle,
            action = action,
            reason = "audit_chain_broken",
        );
        return Err(AppError::Forbidden);
    }
    Ok(session.clone())
}

/// Session erlaubt, wenn mindestens eine der Aktionen für die Rolle erfüllt ist
/// (z. B. Arzt `patient.read_medical` oder Rezeption `patient.read_documents`).
pub fn require_one_of(
    session_state: &State<'_, SessionState>,
    actions: &[&str],
) -> Result<Session, AppError> {
    let guard: std::sync::MutexGuard<'_, Option<(Session, std::time::Instant)>> =
        session_state.lock_session();
    let (session, _) = guard.as_ref().ok_or(AppError::Unauthorized)?;
    let role = Role::parse(&session.rolle).ok_or(AppError::Forbidden)?;
    if actions
        .iter()
        .any(|a| effective_allowed(a, role, &session.permission_overrides))
    {
        return Ok(session.clone());
    }
    log_security!(warn,
        event = "ACCESS_DENIED",
        user_id = %session.user_id,
        role = %session.rolle,
        action = ?actions,
    );
    Err(AppError::Forbidden)
}
