// Role-Based Access Control (NFA-SEC-03).
//
// Centralised policy: maps a role to the set of resources/actions it may
// perform. Backend Tauri commands call `require()` with the active session
// before executing privileged operations.

use std::sync::Mutex;
use tauri::State;

use crate::application::auth_service::{PermissionOverride, Session};
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::log_security;

// `Role` itself lives in `domain::rbac` so lower layers (e.g. `domain::services`) can
// reference it without an upward dependency. Re-exported here for source compatibility
// with the many `use crate::application::rbac::Role;` (and `{self, Role}`) call sites.
pub use crate::domain::rbac::Role;

include!(concat!(env!("OUT_DIR"), "/rbac_generated.rs"));

/// Permission matrix from `config/rbac.yaml` (generated at build time).
pub fn allowed(action: &str, role: Role) -> bool {
    rbac_matrix_allowed(action, role)
}

/// FA-PERS-07: Rollenmatrix, überschrieben durch explizite ALLOW/DENY-Zeilen pro Benutzer.
pub fn effective_allowed(action: &str, role: Role, overrides: &[PermissionOverride]) -> bool {
    for o in overrides {
        if o.action == action {
            return match o.effect.as_str() {
                "ALLOW" => true,
                "DENY" => false,
                _ => allowed(action, role),
            };
        }
    }
    allowed(action, role)
}

/// Require any non-expired session (same idle semantics as [`require`] — caller
/// must hold a session row). Does not check role / permission matrix.
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

/// Session erlaubt, wenn mindestens eine der Aktionen für die Rolle erfüllt ist (z. B. Arzt `patient.read_medical` oder Rezeption `patient.read_documents`).
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

/// Suppress the `unused` warning when the helper is only referenced from cfg-gated code.
#[allow(dead_code)]
pub(crate) fn _keep_mutex_in_scope(_m: &Mutex<()>) {}
