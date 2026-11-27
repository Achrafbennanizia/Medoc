use super::*;

#[test]
fn prefixes_are_unique() {
    let all = [
        DocKind::Invoice,
        DocKind::Cancellation,
        DocKind::Receipt,
        DocKind::Certificate,
        DocKind::Prescription,
        DocKind::ChartExtract,
        DocKind::DischargeLeaflet,
        DocKind::DailyReport,
        DocKind::Report,
    ];
    // Unique across kinds *and* countries: a practice that changes country must never
    // continue another kind's series.
    let mut p: Vec<_> = [None, Some("fr"), Some("eu")]
        .iter()
        .flat_map(|j| all.iter().map(move |k| k.prefix_for(*j)))
        .chain(crate::application::documents::receivables::REMINDER_PREFIXES)
        .collect();
    p.sort_unstable();
    p.dedup();
    assert_eq!(p.len(), all.len() * 3 + 3);
    assert_eq!(DocKind::Invoice.prefix_for(Some("ma")), "FA");
    assert_eq!(DocKind::Invoice.prefix_for(Some("de")), "RE");
    assert_eq!(DocKind::Invoice.prefix_for(None), "RE");
    for k in all {
        assert_eq!(DocKind::from_db(k.as_db()), Some(k));
    }
}

#[test]
fn non_latin_payload_is_rejected() {
    assert!(check_renderable(&serde_json::json!({ "addressLines": ["محمد"] })).is_ok());
    assert!(check_renderable(&serde_json::json!({ "a": ["Müller"] })).is_ok());
    assert!(check_renderable(&serde_json::json!({ "a": ["中文"] })).is_err());
}

#[test]
fn server_fields_override_client_practice_and_strip_number() {
    let mut v = serde_json::json!({
        "kind": "certificate", "practiceLines": ["Fake Praxis"], "documentNumber": "X",
        "watermark": "", "logoKvJson": "{}", "documentTitle": "T"
    });
    let profile = PracticeProfile {
        name: "Echte Praxis".into(),
        addr: "Hauptstr. 1\n10115 Berlin".into(),
        ..Default::default()
    };
    apply_server_fields(&mut v, &profile, "de", "employer", true).unwrap();
    assert_eq!(v["practiceLines"][0], "Echte Praxis");
    assert!(v.get("documentNumber").is_none());
    assert!(v.get("logoKvJson").is_none());
    assert_eq!(v["copyVariant"], "employer");
}

#[test]
fn invoice_args_accept_camel_case_lines() {
    let raw = r#"{
        "patientId": "p",
        "preview": true,
        "invoice": {
            "recipientName": "Ada",
            "recipientAddress": ["Street 1"],
            "lines": [{
                "description": "Exam",
                "amountCents": 1000,
                "treatmentDate": "2026-01-02",
                "feeSchedule": "other",
                "sourceRef": "treatment:t1"
            }]
        }
    }"#;
    let args: IssueInvoiceArgs = serde_json::from_str(raw).unwrap();
    assert_eq!(args.patient_id, "p");
    assert!(args.preview);
    assert_eq!(args.invoice.recipient_name, "Ada");
    assert_eq!(args.invoice.recipient_address, vec!["Street 1".to_string()]);
    assert_eq!(args.invoice.lines[0].amount_cents, 1000);
    assert_eq!(
        args.invoice.lines[0].treatment_date.as_deref(),
        Some("2026-01-02")
    );
    assert_eq!(args.invoice.lines[0].fee_schedule, FeeSchedule::Other);
    assert_eq!(
        args.invoice.lines[0].source_ref.as_deref(),
        Some("treatment:t1")
    );
}

#[test]
fn invoice_line_accepts_service_name_cost_and_german_date() {
    let raw = r#"{
        "patientId": "p",
        "invoice": {
            "date": "02.06.2026",
            "recipientName": "Ada",
            "recipientAddress": ["Street 1"],
            "lines": [{
                "service_name": "Untersuchung",
                "total_cost": 12.94,
                "fee_schedule": "other"
            }]
        }
    }"#;
    let args: IssueInvoiceArgs = serde_json::from_str(raw).unwrap();
    assert_eq!(args.invoice.date, "2026-06-02");
    assert_eq!(args.invoice.lines[0].description, "Untersuchung");
    assert_eq!(args.invoice.lines[0].amount_cents, 1294);
    assert_eq!(
        args.invoice.lines[0].treatment_date.as_deref(),
        Some("2026-06-02")
    );
}

#[test]
fn reception_can_open_an_issued_document() {
    let reception = Session {
        user_id: "r".into(),
        name: "Reception".into(),
        email: "r@example.org".into(),
        role: "RECEPTION".into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    };
    assert!(can_open_issued(&reception, DocKind::Prescription));
    assert!(can_open_issued(&reception, DocKind::Certificate));
    assert!(can_open_issued(&reception, DocKind::Report));
    let outsider = Session {
        role: "TAX_ADVISOR".into(),
        ..reception
    };
    assert!(!can_open_issued(&outsider, DocKind::Prescription));
}

#[test]
fn reception_may_preview_clinical_and_receipt_pdfs() {
    use crate::application::rbac::{effective_allowed, Role};
    let role = Role::Reception;
    let ov: &[crate::domain::rbac::PermissionOverride] = &[];
    assert!(effective_allowed(
        DocKind::Certificate.preview_permission(),
        role,
        ov
    ));
    assert!(effective_allowed(
        DocKind::Prescription.preview_permission(),
        role,
        ov
    ));
    assert!(effective_allowed(
        DocKind::Receipt.preview_permission(),
        role,
        ov
    ));
    assert!(!effective_allowed(
        DocKind::Certificate.issue_permission(),
        role,
        ov
    ));
}
