use super::super::goz::{unit_fee_cents, validate_invoice};
use super::*;

#[test]
fn null_strings_from_the_ui_deserialize_as_empty() {
    let raw = r#"{
        "number": null,
        "date": "2026-11-10",
        "recipient_name": "Ada",
        "recipient_address": null,
        "practice_name": null,
        "practice_address": [],
        "patient_name": null,
        "locale": null,
        "rtl": null,
        "kind": null,
        "note": null,
        "lines": [{
            "description": null,
            "amount_cents": 1294,
            "fee_schedule": null,
            "tooth_nr": null,
            "treatment_date": null
        }]
    }"#;
    let inv: Invoice = serde_json::from_str(raw).expect("invoice json");
    assert_eq!(inv.number, "");
    assert_eq!(inv.locale, "");
    assert!(!inv.rtl);
    assert_eq!(inv.kind, InvoiceKind::Invoice);
    assert!(inv.note.is_none());
    assert_eq!(inv.lines.len(), 1);
    assert_eq!(inv.lines[0].description, "");
    assert_eq!(inv.lines[0].fee_schedule, FeeSchedule::Goz);
    assert!(inv.lines[0].tooth_nr.is_none());
}

pub fn sample() -> Invoice {
    Invoice {
        number: "RE-2026-000001".into(),
        date: "2026-06-02".into(),
        recipient_name: "Max Muster".into(),
        recipient_address: vec!["Musterweg 1".into(), "10115 Berlin".into()],
        patient_name: "Lena Muster".into(),
        patient_birth_date: Some("2014-03-01".into()),
        practice_name: "Zahnarztpraxis Dr. Beispiel".into(),
        practice_address: vec!["Hauptstraße 2".into(), "10115 Berlin".into()],
        clinician_name: Some("Dr. Maria Beispiel".into()),
        practice_bsnr: Some("123456789".into()),
        clinician_zanr: Some("987654321".into()),
        tax_number: Some("12/345/67890".into()),
        bank_details: Some(vec![
            "IBAN DE89 3704 0044 0532 0130 00".into(),
            "BIC COBADEFFXXX".into(),
        ]),
        vat_notice: Some("Umsatzsteuerfrei gem. § 4 Nr. 14 UStG.".into()),
        payment_terms_text: Some("Zahlbar innerhalb von 14 Tagen ohne Abzug.".into()),
        lines: vec![
            InvoiceLine {
                description: "Eingehende Untersuchung".into(),
                goz_nr: Some("0010".into()),
                points: Some(100),
                factor: Some(2.3),
                amount_cents: unit_fee_cents(FeeSchedule::Goz, 100, 2.3),
                treatment_date: Some("2026-05-20".into()),
                ..Default::default()
            },
            InvoiceLine {
                description: "Testposition Füllung, dreiflächig".into(),
                goz_nr: Some("9999".into()),
                points: Some(1_000),
                factor: Some(3.0),
                amount_cents: unit_fee_cents(FeeSchedule::Goz, 1_000, 3.0),
                tooth_nr: Some("36".into()),
                treatment_date: Some("2026-05-27".into()),
                diagnosis_reason: Some(
                    "Erschwerte Trockenlegung bei subgingivaler Ausdehnung".into(),
                ),
                ..Default::default()
            },
            InvoiceLine {
                description: "Komposit-Material".into(),
                fee_schedule: FeeSchedule::Material,
                amount_cents: 3_200,
                material: Some("Komposit, Charge 4711".into()),
                receipt_attached: true,
                treatment_date: Some("2026-05-27".into()),
                ..Default::default()
            },
        ],
        ..Default::default()
    }
}

#[test]
fn valid_sample_passes_and_renders_german_form() {
    let inv = sample();
    validate_invoice(&inv).expect("valid");
    let pdf = render_goz_invoice(&inv).unwrap();
    let s = String::from_utf8_lossy(&pdf);
    for needle in [
        "Rechnung",
        "Leistungsbeschreibung",
        "Zwischensumme GOZ",
        "Rechnungsbetrag",
        "Behandelte Person",
        "Steuer-Nr. 12/345/67890",
        "Begr\\374ndung",
        "Leistungszeitraum",
        "12,94 EUR",
    ] {
        assert!(s.contains(needle), "missing {needle}");
    }
}

#[test]
fn rejects_factor_above_2_3_without_reason_and_wrong_amount() {
    let mut inv = sample();
    inv.lines[1].diagnosis_reason = None;
    inv.lines[0].amount_cents += 50;
    let err = validate_invoice(&inv).unwrap_err().to_string();
    assert!(err.contains("error.invoice.line_factor_reason"));
    assert!(err.contains("error.invoice.line_amount_mismatch"));
}

#[test]
fn rejects_missing_patient_dob_and_service_date() {
    let mut inv = sample();
    inv.patient_birth_date = None;
    inv.lines[0].treatment_date = None;
    let err = validate_invoice(&inv).unwrap_err().to_string();
    assert!(err.contains("error.invoice.patient_identity_missing"));
    assert!(err.contains("error.invoice.line_date"));
}

#[test]
fn taxable_line_needs_tax_id_and_shows_vat() {
    let mut inv = sample();
    inv.tax_number = None;
    inv.lines[2].vat_percent = Some(19.0);
    assert!(validate_invoice(&inv)
        .unwrap_err()
        .to_string()
        .contains("error.invoice.tax_id_missing"));
    inv.tax_number = Some("12/345/67890".into());
    validate_invoice(&inv).unwrap();
    let s = String::from_utf8_lossy(&render_goz_invoice(&inv).unwrap()).into_owned();
    assert!(s.contains("zzgl. 19 % USt"));
    assert_eq!(inv.total_cents(), compute_totals(&inv).net + 608);
}

#[test]
fn cancellation_references_original() {
    let mut inv = sample();
    inv.kind = InvoiceKind::Cancellation;
    inv.number = "ST-2026-000001".into();
    inv.cancels_number = Some("RE-2026-000001".into());
    for l in &mut inv.lines {
        l.amount_cents = -l.amount_cents;
    }
    validate_invoice(&inv).unwrap();
    let s = String::from_utf8_lossy(&render_goz_invoice(&inv).unwrap()).into_owned();
    assert!(s.contains("Stornorechnung"));
    assert!(s.contains("RE-2026-000001"));
}

#[test]
fn long_invoice_repeats_header_on_every_page() {
    let mut inv = sample();
    let base = inv.lines[0].clone();
    inv.lines = (0..80).map(|_| base.clone()).collect();
    let s = String::from_utf8_lossy(&render_goz_invoice(&inv).unwrap()).into_owned();
    let pages = s.matches("/Type /Page ").count();
    assert!(pages >= 3);
    assert_eq!(s.matches("(Leistungsbeschreibung)").count(), pages);
}

#[test]
fn invoice_chrome_follows_document_locale() {
    let markers = [
        ("de", "Rechnung", "Leistungsbeschreibung", "Rechnungsbetrag"),
        ("en", "Invoice", "Service description", "Invoice total"),
        (
            "fr",
            "Facture",
            "Description des prestations",
            "Montant de la facture",
        ),
    ];
    for (locale, title, desc, total) in markers {
        let mut inv = sample();
        inv.locale = locale.into();
        let s = String::from_utf8_lossy(&render_goz_invoice(&inv).unwrap()).into_owned();
        assert!(s.contains(title), "locale={locale} missing title {title}");
        assert!(s.contains(desc), "locale={locale} missing desc {desc}");
        assert!(s.contains(total), "locale={locale} missing total {total}");
    }
    let mut ar = sample();
    ar.locale = "ar".into();
    ar.rtl = true;
    let pdf = render_goz_invoice(&ar).unwrap();
    let s = String::from_utf8_lossy(&pdf);
    assert!(
        s.contains("+NotoNaskhArabic") || s.contains("/F3 "),
        "ar invoice missing arabic font"
    );
    assert!(s.contains("/Lang (ar)"), "ar invoice /Lang");
}

#[test]
fn legal_sub_lines_follow_the_document_language() {
    let mut inv = sample();
    inv.locale = "fr".into();
    inv.watermark = Some("ENTWURF".into());
    let s = String::from_utf8_lossy(&render_goz_invoice(&inv).unwrap()).into_owned();
    assert!(s.contains("Justificatif joint."), "receipt line in French");
    assert!(
        s.contains("Justification \\(\\247 10 al. 3 GOZ\\)"),
        "justification in French"
    );
    assert!(!s.contains("Beleg liegt bei"), "no German sub-line");
    assert!(!s.contains("Begr\\374ndung"), "no German justification");
    assert!(s.contains("(BROUILLON)"), "German watermark word localised");
}

#[test]
fn invoice_carries_a_document_id() {
    let inv = sample();
    let uid = "4f1c2b8e-1111-4222-8333-944455556666";
    let pdf = super::super::core::with_document_uid(uid, || render_goz_invoice(&inv)).unwrap();
    assert_eq!(
        super::super::core::document_uid_of(&pdf).as_deref(),
        Some(uid)
    );
    let s = String::from_utf8_lossy(&pdf);
    assert!(
        s.contains(&format!("Dokument-ID: {uid}")),
        "id printed in the footer"
    );
    assert!(s.contains("/ID [<4F1C2B8E111142228333944455556666>"));
    // Without a fixed id every render still gets one.
    let other = render_goz_invoice(&inv).unwrap();
    assert!(super::super::core::document_uid_of(&other).is_some());
    assert_ne!(
        super::super::core::document_uid_of(&other).as_deref(),
        Some(uid)
    );
}
