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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::entities::behandlung::{Behandlung, Untersuchung};
    use chrono::NaiveDateTime;

    fn sample_behandlung() -> Behandlung {
        Behandlung {
            id: "b1".into(),
            akte_id: "a1".into(),
            art: "standard".into(),
            behandlungsnummer: Some("B-1".into()),
            leistungsname: Some("Prophylaxe".into()),
            beschreibung: Some("SECRET".into()),
            zaehne: Some("11".into()),
            material: Some("composite".into()),
            notizen: Some("diagnose leak".into()),
            gesamtkosten: Some(80.0),
            created_at: NaiveDateTime::default(),
            kategorie: None,
            sitzung: None,
            behandlung_status: None,
            termin_erforderlich: None,
            behandlung_datum: None,
            freigegeben_von_arzt_id: None,
            freigegeben_am: None,
        }
    }

    fn sample_untersuchung() -> Untersuchung {
        Untersuchung {
            id: "u1".into(),
            akte_id: "a1".into(),
            untersuchungsnummer: Some("U-1".into()),
            leistungsname: Some("Kontrolle".into()),
            beschwerden: Some("SECRET".into()),
            ergebnisse: Some("SECRET".into()),
            diagnose: Some("SECRET".into()),
            gesamtkosten: Some(50.0),
            created_at: NaiveDateTime::default(),
            kategorie: None,
            freigegeben_von_arzt_id: None,
            freigegeben_am: None,
        }
    }

    #[test]
    fn gap01_rezeption_behandlung_redaction_strips_clinical_fields() {
        let redacted = apply_rezeption_redact_behandlungen("REZEPTION", vec![sample_behandlung()]);
        let b = &redacted[0];
        assert_eq!(b.leistungsname.as_deref(), Some("Prophylaxe"));
        assert_eq!(b.gesamtkosten, Some(80.0));
        assert!(b.beschreibung.is_none());
        assert!(b.zaehne.is_none());
        assert!(b.material.is_none());
        assert!(b.notizen.is_none());
    }

    #[test]
    fn gap01_arzt_behandlung_list_unredacted() {
        let rows = apply_rezeption_redact_behandlungen("ARZT", vec![sample_behandlung()]);
        assert_eq!(rows[0].notizen.as_deref(), Some("diagnose leak"));
    }

    #[test]
    fn gap01_rezeption_untersuchung_redaction_strips_clinical_fields() {
        let redacted =
            apply_rezeption_redact_untersuchungen("REZEPTION", vec![sample_untersuchung()]);
        let u = &redacted[0];
        assert_eq!(u.leistungsname.as_deref(), Some("Kontrolle"));
        assert!(u.beschwerden.is_none());
        assert!(u.ergebnisse.is_none());
        assert!(u.diagnose.is_none());
    }
}
