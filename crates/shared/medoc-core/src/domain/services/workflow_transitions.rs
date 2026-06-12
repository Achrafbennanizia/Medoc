//! Status transition rules (authoritative; commands must not embed ad-hoc match trees).
use crate::domain::rbac::Role;
use crate::error::AppError;

fn allowed_transition(current: &str, next: &str, allowed: &[&str]) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == nxt {
        tracing::info!(
            target: "medoc::workflow",
            event = "DOMAIN_STATUS_TRANSITION_NOOP",
            current = %cur,
            next = %nxt
        );
        return Ok(());
    }
    if allowed.iter().any(|s| s.eq_ignore_ascii_case(&nxt)) {
        tracing::info!(
            target: "medoc::workflow",
            event = "DOMAIN_STATUS_TRANSITION_ALLOWED",
            current = %cur,
            next = %nxt
        );
        Ok(())
    } else {
        tracing::warn!(
            target: "medoc::workflow",
            event = "DOMAIN_STATUS_TRANSITION_REJECTED",
            current = %cur,
            next = %nxt
        );
        Err(AppError::Validation(format!(
            "Status-Übergang {cur}→{nxt} ist nicht erlaubt"
        )))
    }
}

/// FA-TERM-01: Termin status workflow (see `termin_commands.rs` doc).
pub fn termin_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "GEPLANT" => &[
            "BESTAETIGT",
            "DURCHGEFUEHRT",
            "ABGESAGT",
            "NICHT_ERSCHIENEN",
        ],
        "BESTAETIGT" => &["DURCHGEFUEHRT", "ABGESAGT", "NICHT_ERSCHIENEN"],
        "DURCHGEFUEHRT" | "ABGESAGT" | "NICHT_ERSCHIENEN" | "NICHTERSCHIENEN" => &[],
        _ => return Ok(()),
    };
    allowed_transition(&cur, next, allowed)
}

/// FA-AKTE-15: validate Patientenakte → `VALIDIERT`.
pub fn patientenakte_validate_transition(current: &str) -> Result<(), AppError> {
    let s = current.trim().to_uppercase();
    if s == "VALIDIERT" || s == "READONLY" {
        tracing::warn!(
            target: "medoc::workflow",
            event = "PATIENTENAKTE_VALIDATE_REJECTED",
            status = %s
        );
        return Err(AppError::Validation(
            "Akte ist bereits validiert oder archiviert.".into(),
        ));
    }
    if s == "ENTWURF" || s == "IN_BEARBEITUNG" {
        tracing::info!(
            target: "medoc::workflow",
            event = "PATIENTENAKTE_VALIDATE_ALLOWED",
            from = %s,
            to = "VALIDIERT"
        );
        return Ok(());
    }
    tracing::warn!(
        target: "medoc::workflow",
        event = "PATIENTENAKTE_VALIDATE_REJECTED",
        status = %s
    );
    Err(AppError::Validation(format!(
        "Akten-Status {s} kann nicht validiert werden"
    )))
}

/// FA-PERS-08: Praxis ticket lifecycle.
pub fn praxis_ticket_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "OFFEN" => &["IN_BEARBEITUNG", "ERLEDIGT"],
        "IN_BEARBEITUNG" => &["ERLEDIGT", "OFFEN"],
        "ERLEDIGT" => &[],
        _ => {
            return Err(AppError::Validation(format!(
                "Unbekannter Ticket-Status: {cur}"
            )))
        }
    };
    allowed_transition(&cur, next, allowed)
}

const AUFGABE_STATUSES: &[&str] = &[
    "OFFEN",
    "IN_BEARBEITUNG",
    "ERLEDIGT_REZEPTION",
    "VALIDIERT",
    "ZURUECK",
];

/// Admin-RBAC: beliebiger Statuswechsel (außer aus `VALIDIERT`).
pub fn praxis_aufgabe_admin_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == nxt {
        tracing::info!(
            target: "medoc::workflow",
            event = "PRAXIS_AUFGABE_ADMIN_TRANSITION_NOOP",
            current = %cur
        );
        return Ok(());
    }
    if cur == "VALIDIERT" {
        tracing::warn!(
            target: "medoc::workflow",
            event = "PRAXIS_AUFGABE_ADMIN_TRANSITION_REJECTED",
            current = %cur,
            next = %nxt
        );
        return Err(AppError::Validation(
            "Aufgabe ist bereits geschlossen (VALIDIERT).".into(),
        ));
    }
    if !AUFGABE_STATUSES
        .iter()
        .any(|s| s.eq_ignore_ascii_case(&nxt))
    {
        tracing::warn!(
            target: "medoc::workflow",
            event = "PRAXIS_AUFGABE_ADMIN_TRANSITION_REJECTED",
            current = %cur,
            next = %nxt
        );
        return Err(AppError::Validation(format!(
            "Unbekannter Aufgaben-Status: {nxt}"
        )));
    }
    tracing::info!(
        target: "medoc::workflow",
        event = "PRAXIS_AUFGABE_ADMIN_TRANSITION_ALLOWED",
        current = %cur,
        next = %nxt
    );
    Ok(())
}

/// Fulfill-RBAC / Erfüller: `IN_BEARBEITUNG` und `ERLEDIGT_REZEPTION` (inkl. Rücknahme `OFFEN`).
fn praxis_aufgabe_fulfill_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == "VALIDIERT" {
        return Err(AppError::Validation(
            "Aufgabe ist bereits geschlossen (VALIDIERT).".into(),
        ));
    }
    let allowed: &[&str] = match cur.as_str() {
        "OFFEN" => &["IN_BEARBEITUNG"],
        "IN_BEARBEITUNG" => &["ERLEDIGT_REZEPTION", "OFFEN"],
        "ZURUECK" => &["OFFEN", "IN_BEARBEITUNG"],
        "ERLEDIGT_REZEPTION" => &[],
        _ => {
            return Err(AppError::Validation(format!(
                "Unbekannter Aufgaben-Status: {cur}"
            )))
        }
    };
    allowed_transition(&cur, &nxt, allowed)
}

/// FA-AUFG-06: Praxis-Aufgabe — Erfüller (REZ-Pool oder zugewiesener Arzt) vs. Ersteller (Validierung).
/// `rbac_fulfill` / `rbac_admin` spiegeln `aufgabe.status.fulfill` bzw. `aufgabe.status.admin`.
#[allow(clippy::too_many_arguments)]
pub fn praxis_aufgabe_status_transition(
    current: &str,
    next: &str,
    actor_role: Role,
    assignee_role: Option<&str>,
    assignee_user_id: Option<&str>,
    created_by: &str,
    actor_user_id: &str,
    rbac_fulfill: bool,
    rbac_admin: bool,
) -> Result<(), AppError> {
    if rbac_admin {
        return praxis_aufgabe_admin_status_transition(current, next);
    }

    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == "VALIDIERT" {
        return Err(AppError::Validation(
            "Aufgabe ist bereits geschlossen (VALIDIERT).".into(),
        ));
    }

    let to_rezeption = assignee_role
        .map(str::trim)
        .is_some_and(|r| r.eq_ignore_ascii_case("REZEPTION"));
    let assigned_user = assignee_user_id.map(str::trim).filter(|s| !s.is_empty());

    let is_fulfiller = match actor_role {
        Role::Rezeption => assigned_user
            .map(|id| id == actor_user_id)
            .unwrap_or(to_rezeption),
        Role::Arzt if assigned_user.is_some_and(|id| id == actor_user_id) => true,
        _ => false,
    };
    let is_validator = actor_user_id == created_by.trim();

    // Erledigte Aufgabe: Ersteller validiert/zurückgeben — auch wenn Ersteller zugleich Erfüller war.
    if is_validator && cur == "ERLEDIGT_REZEPTION" {
        return allowed_transition(&cur, &nxt, &["VALIDIERT", "ZURUECK"]);
    }

    if is_fulfiller {
        return praxis_aufgabe_fulfill_status_transition(current, next);
    }

    if rbac_fulfill {
        if nxt != "IN_BEARBEITUNG" && nxt != "ERLEDIGT_REZEPTION" {
            return Err(AppError::Unauthorized);
        }
        return praxis_aufgabe_fulfill_status_transition(current, next);
    }

    if is_validator {
        return match cur.as_str() {
            "ERLEDIGT_REZEPTION" => allowed_transition(&cur, &nxt, &["VALIDIERT", "ZURUECK"]),
            _ => Err(AppError::Validation(
                "Nur erledigte Aufgaben können validiert oder zurückgegeben werden.".into(),
            )),
        };
    }

    Err(AppError::Unauthorized)
}

/// Bestellung lifecycle: `OFFEN` → `UNTERWEGS` → `GELIEFERT` (or `STORNIERT`).
pub fn bestellung_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "OFFEN" => &["UNTERWEGS", "GELIEFERT", "STORNIERT"],
        "UNTERWEGS" => &["GELIEFERT", "STORNIERT"],
        "GELIEFERT" | "STORNIERT" => &[],
        _ => {
            return Err(AppError::Validation(format!(
                "Unbekannter Bestellstatus: {cur}"
            )))
        }
    };
    allowed_transition(&cur, next, allowed)
}
