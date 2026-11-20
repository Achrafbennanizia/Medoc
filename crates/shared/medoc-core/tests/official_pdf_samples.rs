//! Renders one sample of every official document through the real issuing
//! path (in-memory database, server-side practice data, numbering, registry)
//! and checks the properties an official German practice document needs.
//!
//! The PDFs are written to `$MEDOC_PDF_SAMPLE_DIR` (default
//! `target/medoc-pdf-samples`) so they can be checked with qpdf/pdftotext and
//! looked at by a person before release.

use std::path::PathBuf;

use base64::Engine;
use medoc_core::application::auth_service::Session;
use medoc_core::application::documents::cash_book::{self, CloseDayArgs};
use medoc_core::application::documents::issue::{
    cancel_invoice, issue_clinical_document, issue_invoice, issue_report, IssueClinicalArgs,
    IssueInvoiceArgs, IssuedPdf,
};
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_core::infrastructure::pdf::{
    unit_fee_cents, FeeSchedule, Invoice, InvoiceLine, ReportPdfInput, ReportPdfSummaryRow,
};

const PRACTICE: &str = r#"{
  "name": "Zahnarztpraxis Dr. Anna Berger",
  "addr": "Hauptstraße 12\n49074 Osnabrück",
  "phone": "0541 123456", "email": "praxis@berger-zahn.de", "web": "https://berger-zahn.de",
  "clinician_name": "Dr. med. dent. Anna Berger", "professional_title": "Zahnärztin",
  "tax_number": "66/123/45678", "bsnr": "123456789", "zanr": "987654321",
  "bank_name": "Sparkasse Osnabrück", "bank_iban": "DE89 3704 0044 0532 0130 00",
  "bank_bic": "COBADEFFXXX", "account_holder": "Dr. Anna Berger",
  "chamber": "Zahnärztekammer Niedersachsen", "payment_terms_days": 30
}"#;

fn session() -> Session {
    Session {
        user_id: "seed-physician-001".into(),
        name: "Dr. Anna Berger".into(),
        email: "praxis@berger-zahn.de".into(),
        role: "PHYSICIAN".into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    }
}

fn out_dir() -> PathBuf {
    let dir = std::env::var("MEDOC_PDF_SAMPLE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../target/medoc-pdf-samples")
        });
    std::fs::create_dir_all(&dir).expect("sample dir");
    dir
}

async fn setup() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    app_kv_repo::set(&pool, "invoice.practice.v1", PRACTICE)
        .await
        .unwrap();
    app_kv_repo::set(&pool, "documents.locale.v1", "\"de\"")
        .await
        .unwrap();
    for sql in [
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, address)
         VALUES ('p1', 'Lena Müller', '1990-01-15', 'FEMALE', 'A123456789', 'ACTIVE',
                 'Musterweg 3, 49076 Osnabrück')",
        "INSERT INTO payment (id, patient_id, amount, payment_method, status)
         VALUES ('pay1', 'p1', 120.0, 'CARD', 'PAID')",
        "INSERT INTO certificate (id, patient_id, physician_id, kind, body_text, valid_from, valid_until)
         VALUES ('c1', 'p1', 'seed-physician-001', 'SICK_LEAVE', 'Akute Pulpitis 36', '2026-11-09', '2026-11-11')",
        "INSERT INTO prescription (id, patient_id, physician_id, medication, dosage, duration,
                                   dosage_form, pack_size, quantity, prescription_type, issued_at)
         VALUES ('rx1', 'p1', 'seed-physician-001', 'Ibuprofen 600 mg', '1-0-1 nach dem Essen',
                 '5 Tage', 'Filmtabletten', 'N1 (20 St.)', 1, 'PRIVAT', '2026-11-09')",
    ] {
        sqlx::query(sql).execute(&pool).await.unwrap();
    }
    pool
}

fn bytes(p: &IssuedPdf) -> Vec<u8> {
    base64::engine::general_purpose::STANDARD
        .decode(&p.pdf_base64)
        .expect("base64")
}

/// WinAnsi bytes as Latin-1 text, with PDF string escapes resolved
/// (`\\ddd` octal, `\\(`, `\\)`, `\\\\`). Content streams are uncompressed.
fn text(pdf: &[u8]) -> String {
    let mut out = String::with_capacity(pdf.len());
    let mut i = 0;
    while i < pdf.len() {
        let b = pdf[i];
        if b == b'\\' && i + 1 < pdf.len() {
            let n = pdf[i + 1];
            if n.is_ascii_digit()
                && i + 3 < pdf.len()
                && pdf[i + 2].is_ascii_digit()
                && pdf[i + 3].is_ascii_digit()
            {
                let v = (n - b'0') as u32 * 64
                    + (pdf[i + 2] - b'0') as u32 * 8
                    + (pdf[i + 3] - b'0') as u32;
                out.push(char::from_u32(v).unwrap_or('?'));
                i += 4;
                continue;
            }
            if matches!(n, b'(' | b')' | b'\\') {
                out.push(n as char);
                i += 2;
                continue;
            }
        }
        out.push(b as char);
        i += 1;
    }
    out
}

/// Text as it appears in the content stream (WinAnsi = Latin-1 for these chars).
fn latin1(s: &str) -> String {
    s.to_string()
}

/// Checks every official PDF must pass.
fn assert_official(name: &str, pdf: &[u8], number: Option<&str>) -> String {
    let path = out_dir().join(format!("{name}.pdf"));
    std::fs::write(&path, pdf).unwrap();
    let t = text(pdf);
    assert!(t.starts_with("%PDF-1."), "{name}: header");
    assert!(t.trim_end().ends_with("%%EOF"), "{name}: trailer");
    assert!(t.contains("/MediaBox [0 0 595"), "{name}: A4 page size");
    assert!(
        t.contains("/Lang (de-DE)") || t.contains("/Lang (de)"),
        "{name}: /Lang"
    );
    assert!(t.contains("/CreationDate (D:"), "{name}: CreationDate");
    assert!(t.contains("/Title ("), "{name}: Title");
    for needle in ["Zahnarztpraxis Dr. Anna Berger", "Seite 1 von"] {
        assert!(t.contains(&latin1(needle)), "{name}: missing {needle:?}");
    }
    // Legal identity on every official document (footer).
    for needle in ["66/123/45678", "DE89 3704 0044 0532 0130 00"] {
        assert!(t.contains(needle), "{name}: footer missing {needle:?}");
    }
    if let Some(n) = number {
        assert!(t.contains(n), "{name}: document number {n} not printed");
    }
    assert!(
        !t.contains("ENTWURF"),
        "{name}: final document must not carry ENTWURF"
    );
    t
}

#[tokio::test]
async fn render_official_document_samples() {
    let pool = setup().await;
    let s = session();
    let year = chrono::Local::now().format("%Y").to_string();

    // ---- Invoice (GOZ Anlage 2) --------------------------------------------
    let line = |nr: &str, desc: &str, points: u32, factor: f64, tooth: Option<&str>| InvoiceLine {
        description: desc.into(),
        goz_nr: Some(nr.into()),
        points: Some(points),
        factor: Some(factor),
        quantity: Some(1),
        amount_cents: unit_fee_cents(FeeSchedule::Goz, points, factor),
        tooth_nr: tooth.map(String::from),
        treatment_date: Some("2026-11-02".into()),
        ..Default::default()
    };
    let mut endo = line(
        "2410",
        "Aufbereitung eines Wurzelkanals",
        392,
        3.0,
        Some("36"),
    );
    endo.diagnosis_reason =
        Some("Stark gekrümmte, obliterierte Kanäle, erhöhter Zeitaufwand".into());
    let invoice = Invoice {
        recipient_name: "Lena Müller".into(),
        recipient_address: vec!["Musterweg 3".into(), "49076 Osnabrück".into()],
        lines: vec![
            line("0010", "Eingehende Untersuchung", 100, 2.3, None),
            line(
                "0090",
                "Intraorale Infiltrationsanästhesie",
                60,
                2.3,
                Some("36"),
            ),
            endo,
            InvoiceLine {
                description: "Wurzelfüllmaterial (Guttapercha, Sealer)".into(),
                fee_schedule: FeeSchedule::Material,
                amount_cents: 1850,
                quantity: Some(1),
                treatment_date: Some("2026-11-02".into()),
                ..Default::default()
            },
        ],
        ..Default::default()
    };
    let inv = issue_invoice(
        &pool,
        &s,
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice,
            preview: false,
        },
    )
    .await
    .expect("issue invoice");
    let inv_no = format!("RE-{year}-000001");
    assert_eq!(inv.document_number.as_deref(), Some(inv_no.as_str()));
    let t = assert_official("01-rechnung", &bytes(&inv), Some(&inv_no));
    for needle in [
        "GOZ",
        "Faktor",
        "2410",
        "Zwischensumme",
        "Rechnungsbetrag",
        "geb. 15.01.1990",
        "Leistungszeitraum",
        "Steuer-Nr. 66/123/45678",
        "Kammer: Zahnärztekammer Niedersachsen",
        "Tel. 0541 123456",
        "unter Angabe der Rechnungsnummer",
        "4 Nr. 14",
        "Zahlbar innerhalb von 30 Tagen",
    ] {
        assert!(t.contains(&latin1(needle)), "invoice: missing {needle:?}");
    }
    // § 10 Abs. 3 GOZ justification is printed next to the 3.0 factor.
    assert!(t.contains("Kan"), "invoice: factor justification missing");

    // ---- Cancellation (Stornorechnung) ------------------------------------
    let storno = cancel_invoice(
        &pool,
        &s,
        inv.document_id.as_deref().unwrap(),
        "Rechnungsadresse falsch",
    )
    .await
    .expect("cancel");
    let st_no = format!("ST-{year}-000001");
    let t = assert_official("02-stornorechnung", &bytes(&storno), Some(&st_no));
    assert!(
        t.contains(&inv_no),
        "storno must reference the original invoice"
    );

    // ---- Certificate (AU): patient copy and employer copy -------------------
    let cert_layout = r#"{
      "kind": "certificate",
      "documentTitle": "ARBEITSUNFÄHIGKEITSBESCHEINIGUNG",
      "metaLines": [{"label": "Ausgestellt am", "value": "09.11.2026"}],
      "introParagraphs": ["Hiermit wird bescheinigt, dass die unten genannte Person arbeitsunfähig ist."],
      "twoColumn": {"leftTitle": "Patient/in", "leftLines": ["Lena Müller", "Geb.-Datum: 15.01.1990"],
                    "rightTitle": "Anschrift", "rightLines": ["Musterweg 3, 49076 Osnabrück"]},
      "labelValueRows": [
        {"label": "Festgestellt am", "value": "09.11.2026"},
        {"label": "Arbeitsunfähig von", "value": "09.11.2026"},
        {"label": "Voraussichtlich bis einschließlich", "value": "11.11.2026"},
        {"label": "Diagnose (ICD-10)", "value": "K04.0 Pulpitis", "confidential": true},
        {"label": "Befund", "value": "Akute Pulpitis 36", "confidential": true}
      ]
    }"#;
    let cert = |variant: &str| IssueClinicalArgs {
        kind: "certificate".into(),
        source_id: "c1".into(),
        layout_json: cert_layout.into(),
        preview: false,
        copy_variant: Some(variant.into()),
    };
    let patient_copy = issue_clinical_document(&pool, &s, cert("patient"))
        .await
        .expect("AU patient");
    let at_no = patient_copy.document_number.clone().unwrap();
    let t = assert_official("03-au-patient", &bytes(&patient_copy), Some(&at_no));
    assert!(t.contains("K04.0"), "patient copy keeps the diagnosis");
    // Patient identity comes from the database, not from the client layout.
    for needle in [
        "Lena Müller",
        "Geb.-Datum: 15.01.1990",
        "Vers.-Nr.: A123456789",
    ] {
        assert!(t.contains(needle), "AU: missing {needle:?}");
    }

    let employer_copy = issue_clinical_document(&pool, &s, cert("employer"))
        .await
        .expect("AU employer");
    let t = assert_official(
        "04-au-arbeitgeber",
        &bytes(&employer_copy),
        employer_copy.document_number.as_deref(),
    );
    assert!(
        !t.contains("K04.0") && !t.contains("Pulpitis"),
        "employer copy must not show the diagnosis"
    );
    assert!(t.contains("Arbeitgeber"), "employer copy is labelled");
    assert!(t.contains("Lena Müller"), "employer copy names the patient");
    assert!(
        !t.contains("A123456789"),
        "employer copy omits the insurance number"
    );

    // ---- Private prescription (AMVV § 2) ----------------------------------
    let rx_layout = r#"{
      "kind": "prescription",
      "documentTitle": "PRIVATREZEPT",
      "metaLines": [{"label": "Ausstellungsdatum", "value": "09.11.2026"}],
      "twoColumn": {"leftTitle": "Patient/in", "leftLines": ["Lena Müller", "Geb.-Datum: 15.01.1990"],
                    "rightTitle": "Anschrift", "rightLines": ["Musterweg 3, 49076 Osnabrück"]},
      "tables": [{"title": "Rp.", "columnLayout": "prescription",
        "headers": ["Arzneimittel / Stärke", "Darreichungsform", "Packung", "Dosierung", "PZN"],
        "rows": [["Ibuprofen 600 mg", "Filmtabletten", "1 × N1 (20 St.)", "1-0-1 nach dem Essen", "—"]]}],
      "labelValueRows": [{"label": "Dauer", "value": "5 Tage"},
                         {"label": "Aut idem", "value": "Austausch zulässig"}],
      "closingParagraphs": ["Privatrezept: gültig 3 Monate ab Ausstellungsdatum."]
    }"#;
    let rx = issue_clinical_document(
        &pool,
        &s,
        IssueClinicalArgs {
            kind: "prescription".into(),
            source_id: "rx1".into(),
            layout_json: rx_layout.into(),
            preview: false,
            copy_variant: None,
        },
    )
    .await
    .expect("prescription");
    let t = assert_official(
        "05-privatrezept",
        &bytes(&rx),
        rx.document_number.as_deref(),
    );
    for needle in [
        "Ibuprofen 600 mg",
        "Filmtabletten",
        "1-0-1",
        "Dr. med. dent. Anna Berger",
        "ZANR 987654321",
    ] {
        assert!(t.contains(needle), "prescription: missing {needle:?}");
    }

    // ---- Receipt, reprint, preview ---------------------------------------
    let receipt_layout = r#"{
      "kind": "receipt",
      "documentTitle": "QUITTUNG",
      "metaLines": [{"label": "Zahlungsdatum", "value": "09.11.2026"}, {"label": "Zahlart", "value": "Karte"}],
      "addressLines": ["Lena Müller", "Musterweg 3", "49076 Osnabrück"],
      "tables": [{"columnLayout": "receipt", "headers": ["Datum", "Leistung", "Betrag"],
                  "rows": [["02.11.2026", "Wurzelkanalbehandlung 36", "112,24 EUR"], ["02.11.2026", "Anästhesie", "7,76 EUR"]]}],
      "totals": [{"label": "Rechnungsbetrag", "value": "120,00 EUR"},
                 {"label": "Erhaltener Betrag", "value": "120,00 EUR", "total": true},
                 {"label": "Noch offen", "value": "0,00 EUR"}],
      "closingParagraphs": ["Umsatzsteuerfrei gem. § 4 Nr. 14 Buchst. a UStG.", "Betrag dankend erhalten."]
    }"#;
    let receipt = |preview| IssueClinicalArgs {
        kind: "receipt".into(),
        source_id: "pay1".into(),
        layout_json: receipt_layout.into(),
        preview,
        copy_variant: None,
    };
    let preview = issue_clinical_document(&pool, &s, receipt(true))
        .await
        .expect("preview");
    assert!(preview.document_number.is_none());
    let preview_pdf = bytes(&preview);
    std::fs::write(out_dir().join("06-quittung-vorschau.pdf"), &preview_pdf).unwrap();
    assert!(
        text(&preview_pdf).contains("ENTWURF"),
        "preview carries ENTWURF"
    );

    let q = issue_clinical_document(&pool, &s, receipt(false))
        .await
        .expect("receipt");
    let qu_no = format!("QU-{year}-000001");
    let t = assert_official("07-quittung", &bytes(&q), Some(&qu_no));
    assert!(
        t.contains("Erhaltener Betrag") && t.contains("120,00"),
        "receipt totals"
    );

    let copy = issue_clinical_document(&pool, &s, receipt(false))
        .await
        .expect("reprint");
    assert!(copy.reprint);
    let t = assert_official("08-quittung-kopie", &bytes(&copy), Some(&qu_no));
    assert!(t.contains("KOPIE"), "reprint carries KOPIE");

    // ---- Day close → Kassenbericht (Tagesabschluss) ----------------------
    // Figures come from the cash journal; a client-built daily report is refused.
    let fake = ReportPdfInput {
        doc_title: "Tagesabschluss".into(),
        report_kind: Some("daily_report".into()),
        summary: vec![ReportPdfSummaryRow {
            label: "Einnahmen".into(),
            value: "1,00 EUR".into(),
        }],
        ..Default::default()
    };
    assert!(issue_report(&pool, &s, fake, None, false).await.is_err());
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let closed = cash_book::close_day(
        &pool,
        &s,
        CloseDayArgs {
            as_of_date: today,
            counted_cents: Some(0),
            card_terminal_cents: Some(12000),
            ..Default::default()
        },
    )
    .await
    .expect("day close");
    let tb_no = format!("TB-{year}-000001");
    assert_eq!(
        closed.report.document_number.as_deref(),
        Some(tb_no.as_str())
    );
    let t = assert_official("09-tagesabschluss", &bytes(&closed.report), Some(&tb_no));
    for needle in [
        "Kassenbericht",
        "Soll-Bestand",
        "Ist-Bestand",
        "Kartenterminal",
        "Lena Müller",
        "Kassierer/in",
    ] {
        assert!(t.contains(needle), "Kassenbericht: missing {needle:?}");
    }

    eprintln!("PDF samples written to {}", out_dir().display());
}
