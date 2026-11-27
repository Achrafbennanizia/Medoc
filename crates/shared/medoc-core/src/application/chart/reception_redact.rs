//! Reception need-to-know redaction for treatment/examination lists (GAP-01 mitigation).
//!
//! Skipped when the person may read the clinical record (e.g. Solo guest with
//! Settings → Guest → "May read the clinical record" / `solo.guest_clinical`).

use crate::application::rbac::{self, Role};
use crate::domain::entities::treatment::{Examination, Treatment};
use crate::domain::rbac::PermissionOverride;

pub fn redact_treatment_for_reception(mut b: Treatment) -> Treatment {
    b.description = None;
    b.teeth = None;
    b.material = None;
    b.notes = None;
    b
}

pub fn redact_examination_for_reception(mut u: Examination) -> Examination {
    u.chief_complaint = None;
    u.results = None;
    u.diagnosis = None;
    u
}

fn should_redact(role: &str, overrides: &[PermissionOverride]) -> bool {
    match Role::parse(role) {
        Some(Role::Reception) => {
            !rbac::effective_allowed("patient.read_medical", Role::Reception, overrides)
        }
        _ => false,
    }
}

pub fn apply_reception_redact_treatments(
    role: &str,
    overrides: &[PermissionOverride],
    rows: Vec<Treatment>,
) -> Vec<Treatment> {
    if should_redact(role, overrides) {
        rows.into_iter()
            .map(redact_treatment_for_reception)
            .collect()
    } else {
        rows
    }
}

pub fn apply_reception_redact_examinations(
    role: &str,
    overrides: &[PermissionOverride],
    rows: Vec<Examination>,
) -> Vec<Examination> {
    if should_redact(role, overrides) {
        rows.into_iter()
            .map(redact_examination_for_reception)
            .collect()
    } else {
        rows
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::entities::treatment::{Examination, Treatment};
    use chrono::NaiveDateTime;

    fn sample_treatment() -> Treatment {
        Treatment {
            id: "b1".into(),
            chart_id: "a1".into(),
            kind: "standard".into(),
            treatment_number: Some("B-1".into()),
            service_name: Some("Prophylaxe".into()),
            description: Some("SECRET".into()),
            teeth: Some("11".into()),
            material: Some("composite".into()),
            notes: Some("diagnosis leak".into()),
            total_cost: Some(80.0),
            created_at: NaiveDateTime::default(),
            updated_at: None,
            category: None,
            session_number: None,
            treatment_status: None,
            appointment_required: None,
            treatment_date: None,
            released_by_physician_id: None,
            released_at: None,
            fee_schedule: None,
            goz_nr: None,
            points: None,
            factor: None,
            factor_reason: None,
            quantity: None,
            analog_of: None,
            agreement_ref: None,
            responsible_staff_id: None,
        }
    }

    fn sample_examination() -> Examination {
        Examination {
            id: "u1".into(),
            chart_id: "a1".into(),
            examination_number: Some("U-1".into()),
            service_name: Some("Kontrolle".into()),
            chief_complaint: Some("SECRET".into()),
            results: Some("SECRET".into()),
            diagnosis: Some("SECRET".into()),
            total_cost: Some(50.0),
            created_at: NaiveDateTime::default(),
            updated_at: None,
            category: None,
            released_by_physician_id: None,
            released_at: None,
            responsible_staff_id: None,
        }
    }

    #[test]
    fn gap_01_reception_treatment_redaction_strips_clinical_fields() {
        let redacted = apply_reception_redact_treatments("RECEPTION", &[], vec![sample_treatment()]);
        let b = &redacted[0];
        assert_eq!(b.service_name.as_deref(), Some("Prophylaxe"));
        assert_eq!(b.total_cost, Some(80.0));
        assert!(b.description.is_none());
        assert!(b.teeth.is_none());
        assert!(b.material.is_none());
        assert!(b.notes.is_none());
    }

    #[test]
    fn gap_01_physician_treatment_list_unredacted() {
        let rows = apply_reception_redact_treatments("PHYSICIAN", &[], vec![sample_treatment()]);
        assert_eq!(rows[0].notes.as_deref(), Some("diagnosis leak"));
    }

    #[test]
    fn gap_01_reception_examination_redaction_strips_clinical_fields() {
        let redacted =
            apply_reception_redact_examinations("RECEPTION", &[], vec![sample_examination()]);
        let u = &redacted[0];
        assert_eq!(u.service_name.as_deref(), Some("Kontrolle"));
        assert!(u.chief_complaint.is_none());
        assert!(u.results.is_none());
        assert!(u.diagnosis.is_none());
    }

    #[test]
    fn guest_clinical_read_keeps_treatment_and_examination_fields() {
        let overrides = vec![PermissionOverride {
            action: "patient.read_medical".into(),
            effect: "ALLOW".into(),
        }];
        let treatments =
            apply_reception_redact_treatments("RECEPTION", &overrides, vec![sample_treatment()]);
        assert_eq!(treatments[0].notes.as_deref(), Some("diagnosis leak"));
        assert_eq!(treatments[0].description.as_deref(), Some("SECRET"));
        let examinations =
            apply_reception_redact_examinations("RECEPTION", &overrides, vec![sample_examination()]);
        assert_eq!(examinations[0].diagnosis.as_deref(), Some("SECRET"));
    }
}
