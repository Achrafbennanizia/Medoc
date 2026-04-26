// Role-Based Access Control (NFA-SEC-03).
//
// Centralised policy: maps a role to the set of resources/actions it may
// perform. Backend Tauri commands call `require()` with the active session
// before executing privileged operations.

use std::sync::Mutex;
use tauri::State;

use crate::application::auth_service::Session;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::log_security;

/// Roles defined in the requirements (4 personae).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Arzt,
    Rezeption,
    Steuerberater,
    Pharmaberater,
}

impl Role {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "ARZT" => Some(Role::Arzt),
            "REZEPTION" => Some(Role::Rezeption),
            "STEUERBERATER" => Some(Role::Steuerberater),
            "PHARMABERATER" => Some(Role::Pharmaberater),
            _ => None,
        }
    }
}

/// Permission matrix. The list of roles allowed to perform an action.
pub fn allowed(action: &str, role: Role) -> bool {
    match action {
        // Patient medical records — clinicians only
        "patient.read_medical" | "patient.write_medical" => role == Role::Arzt,
        // Behandlung/Untersuchung-Zeilen für Zahlungszuordnung (Kundenleistungen, Finanzen → Neue Zahlung)
        "patient.behandlungen_list_for_zahlung" => {
            matches!(role, Role::Arzt | Role::Rezeption | Role::Steuerberater)
        },
        // Patient demographics — clinicians + reception (not full medical record)
        "patient.read" | "patient.write" => matches!(role, Role::Arzt | Role::Rezeption),
        // Schedule: list doctors for appointment assignment (same audience as termin)
        "termin.list_aerzte" => matches!(role, Role::Arzt | Role::Rezeption),
        // Appointments — clinicians + reception
        "termin.read" | "termin.write" => matches!(role, Role::Arzt | Role::Rezeption),
        // Finance & invoicing — reception + tax advisor
        "finanzen.read" => matches!(role, Role::Arzt | Role::Rezeption | Role::Steuerberater),
        // Buchungen und Rechnungs-PDF: Praxisalltag oft auch durch Ärzt:in (FA-FIN).
        "finanzen.write" => matches!(role, Role::Arzt | Role::Rezeption | Role::Steuerberater,),
        // Dashboard aggregates — any authenticated staff
        "dashboard.read" => true,
        // Inventory / products — clinicians + reception + pharma rep
        "produkt.read" => true,
        "produkt.write" => matches!(role, Role::Arzt | Role::Rezeption | Role::Pharmaberater),
        // Purchase orders (Bestellungen) — same audience as products
        "bestellung.read" => true,
        "bestellung.write" => matches!(role, Role::Arzt | Role::Rezeption | Role::Pharmaberater),
        // Personnel administration — clinicians only
        "personal.read" | "personal.write" => role == Role::Arzt,
        // Audit log read — clinicians only
        "audit.read" => role == Role::Arzt,
        // Operations / system / DSGVO actions — clinicians only
        "ops.backup" | "ops.dsgvo" | "ops.migration" | "ops.system" | "ops.logs" => {
            role == Role::Arzt
        }
        // Anything else: deny by default
        _ => false,
    }
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
    if !allowed(action, role) {
        log_security!(warn,
            event = "ACCESS_DENIED",
            user_id = %session.user_id,
            role = %session.rolle,
            action = action,
        );
        return Err(AppError::Forbidden);
    }
    Ok(session.clone())
}

/// Suppress the `unused` warning when the helper is only referenced from cfg-gated code.
#[allow(dead_code)]
pub(crate) fn _keep_mutex_in_scope(_m: &Mutex<()>) {}
