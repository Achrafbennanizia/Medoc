//! REZ need-to-know redaction for B/U lists (GAP-01 mitigation).

use crate::application::rbac::Role;
use crate::domain::entities::behandlung::{Behandlung, Untersuchung};

pub fn redact_behandlung_for_rezeption(mut b: Behandlung) -> Behandlung {
    b.beschreibung = None;
    b.zaehne = None;
    b.material = None;
    b.notizen = None;
    b
}

pub fn redact_untersuchung_for_rezeption(mut u: Untersuchung) -> Untersuchung {
    u.beschwerden = None;
    u.ergebnisse = None;
    u.diagnose = None;
    u
}

pub fn apply_rezeption_redact_behandlungen(rolle: &str, rows: Vec<Behandlung>) -> Vec<Behandlung> {
    match Role::parse(rolle) {
        Some(Role::Rezeption) => rows
            .into_iter()
            .map(redact_behandlung_for_rezeption)
            .collect(),
        _ => rows,
    }
}

pub fn apply_rezeption_redact_untersuchungen(
    rolle: &str,
    rows: Vec<Untersuchung>,
) -> Vec<Untersuchung> {
    match Role::parse(rolle) {
        Some(Role::Rezeption) => rows
            .into_iter()
            .map(redact_untersuchung_for_rezeption)
            .collect(),
        _ => rows,
    }
}
