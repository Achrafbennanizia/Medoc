//! Status transition rules (authoritative; commands must not embed ad-hoc match trees).
use crate::error::AppError;

fn allowed_transition(current: &str, next: &str, allowed: &[&str]) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let nxt = next.trim().to_uppercase();
    if cur == nxt {
        return Ok(());
    }
    if allowed.iter().any(|s| s.eq_ignore_ascii_case(&nxt)) {
        Ok(())
    } else {
        Err(AppError::Validation(format!(
            "Status-Übergang {cur}→{nxt} ist nicht erlaubt"
        )))
    }
}

/// FA-TERM-01: Termin status workflow (see `termin_commands.rs` doc).
pub fn termin_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "GEPLANT" => &["BESTAETIGT", "DURCHGEFUEHRT", "ABGESAGT", "NICHT_ERSCHIENEN"],
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
        return Err(AppError::Validation(
            "Akte ist bereits validiert oder archiviert.".into(),
        ));
    }
    if s == "ENTWURF" || s == "IN_BEARBEITUNG" {
        return Ok(());
    }
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
        _ => return Err(AppError::Validation(format!("Unbekannter Ticket-Status: {cur}"))),
    };
    allowed_transition(&cur, next, allowed)
}

/// Bestellung lifecycle: `OFFEN` → `UNTERWEGS` → `GELIEFERT` (or `STORNIERT`).
pub fn bestellung_status_transition(current: &str, next: &str) -> Result<(), AppError> {
    let cur = current.trim().to_uppercase();
    let allowed: &[&str] = match cur.as_str() {
        "OFFEN" => &["UNTERWEGS", "GELIEFERT", "STORNIERT"],
        "UNTERWEGS" => &["GELIEFERT", "STORNIERT"],
        "GELIEFERT" | "STORNIERT" => &[],
        _ => return Err(AppError::Validation(format!("Unbekannter Bestellstatus: {cur}"))),
    };
    allowed_transition(&cur, next, allowed)
}
