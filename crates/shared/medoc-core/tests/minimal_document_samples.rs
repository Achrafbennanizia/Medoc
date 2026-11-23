//! Documents without legal content requirements use the minimal layout: the practice name,
//! address and contact, and nothing else. No practitioner line, no professional numbers
//! (ZANR, BSNR, KV), no tax number, no bank details in header or footer.
//! Covers the period report, patient record export and discharge leaflet. Receipts and the day
//! close are covered in `official_pdf_samples.rs`, the payment reminder in `finance_workflow_tests.rs`.
//! PDFs land in `$MEDOC_PDF_SAMPLE_DIR` (default `target/medoc-pdf-samples`).

use std::path::PathBuf;

use base64::Engine;
use medoc_core::application::auth_service::Session;
use medoc_core::application::chart::pdf_export::{
    export_chart_pdf, export_discharge_leaflet_pdf, ExportChartPdfArgs,
    ExportDischargeLeafletPdfArgs,
};
use medoc_core::application::documents::issue::IssuedPdf;
use medoc_core::application::documents::period_report::{self, PeriodArgs};
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;

const PRACTICE: &str = r#"{
  "name": "Zahnarztpraxis Dr. Anna Berger", "country": "DE",
  "addr": "Hauptstraße 12\n49074 Osnabrück",
  "phone": "0541 123456", "email": "praxis@berger-zahn.de", "web": "https://berger-zahn.de",
  "clinician_name": "Dr. med. dent. Anna Berger", "professional_title": "Zahnärztin",
  "tax_number": "66/123/45678", "bsnr": "123456789", "zanr": "987654321", "kv_number": "01-234567",
  "bank_name": "Sparkasse Osnabrück", "bank_iban": "DE89 3704 0044 0532 0130 00",
  "bank_bic": "COBADEFFXXX", "account_holder": "Dr. Anna Berger",
  "chamber": "Zahnärztekammer Niedersachsen", "payment_terms_days": 30,
  "emergency_phone": "0541 999999"
}"#;

const TAX: &str = "66/123/45678";
const IBAN: &str = "DE89 3704 0044 0532 0130 00";

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

fn bytes(p: &IssuedPdf) -> Vec<u8> {
    base64::engine::general_purpose::STANDARD
        .decode(&p.pdf_base64)
        .expect("base64")
}

/// Latin-1 text of the content streams with PDF escapes (`\ddd`, `\(`, `\)`, `\\`) resolved.
fn text(pdf: &[u8]) -> String {
    let mut out = String::with_capacity(pdf.len());
    let mut i = 0;
    while i < pdf.len() {
        let b = pdf[i];
        if b == b'\\' && i + 3 < pdf.len() && pdf[i + 1..i + 4].iter().all(u8::is_ascii_digit) {
            let v = (pdf[i + 1] - b'0') as u32 * 64
                + (pdf[i + 2] - b'0') as u32 * 8
                + (pdf[i + 3] - b'0') as u32;
            out.push(char::from_u32(v).unwrap_or('?'));
            i += 4;
            continue;
        }
        if b == b'\\' && i + 1 < pdf.len() && matches!(pdf[i + 1], b'(' | b')' | b'\\') {
            out.push(pdf[i + 1] as char);
            i += 2;
            continue;
        }
        out.push(b as char);
        i += 1;
    }
    out
}

fn save_and_read(name: &str, pdf: &[u8]) -> String {
    let dir = std::env::var("MEDOC_PDF_SAMPLE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../target/medoc-pdf-samples")
        });
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join(format!("{name}.pdf")), pdf).unwrap();
    text(pdf)
}

/// Practice identity present; practitioner numbers and tax number absent.
fn assert_minimal(name: &str, t: &str) {
    for needle in [
        "Zahnarztpraxis Dr. Anna Berger",
        "Hauptstra\u{df}e 12",
        "49074 Osnabr\u{fc}ck",
        "0541 123456",
    ] {
        assert!(
            t.contains(needle),
            "{name}: practice identity missing {needle:?}"
        );
    }
    // (the BSNR value is not checked alone: it is also part of the patient's insurance number)
    for needle in [
        TAX,
        "ZANR",
        "BSNR",
        "987654321",
        "01-234567",
        "Zahn\u{e4}rztekammer",
    ] {
        assert!(
            !t.contains(needle),
            "{name}: minimal document shows {needle:?}"
        );
    }
}

#[tokio::test]
async fn reports_exports_and_leaflets_use_the_minimal_layout() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    app_kv_repo::set(&pool, "invoice.practice.v1", PRACTICE)
        .await
        .unwrap();
    app_kv_repo::set(&pool, "documents.locale.v1", "\"de\"")
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, address)
         VALUES ('p1', 'Lena Müller', '1990-01-15', 'FEMALE', 'A123456789', 'ACTIVE',
                 'Musterweg 3, 49076 Osnabrück')",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("INSERT INTO patient_chart (id, patient_id) VALUES ('c1', 'p1')")
        .execute(&pool)
        .await
        .unwrap();
    let s = session();

    // Period report.
    let report = period_report::create(
        &pool,
        &s,
        PeriodArgs {
            from: "2026-01-01".into(),
            to: "2026-12-31".into(),
            kind: "YEAR".into(),
            label: None,
            preview: true,
            locale: Some("de".into()),
        },
    )
    .await
    .expect("period report");
    let t = save_and_read("min-02-periodenbericht", &bytes(&report.pdf));
    assert_minimal("period report", &t);
    assert!(!t.contains(IBAN), "period report: no bank details");

    // Patient record export: no separate practice block, no practitioner line.
    let chart = export_chart_pdf(
        &pool,
        &s,
        ExportChartPdfArgs {
            patient_id: "p1".into(),
            sections: Default::default(),
            preview: true,
            locale: Some("de".into()),
        },
    )
    .await
    .expect("record export");
    let t = save_and_read("min-03-akte", &bytes(&chart));
    assert_minimal("record export", &t);
    assert!(!t.contains(IBAN), "record export: no bank details");
    assert!(
        !t.contains("Dr. med. dent. Anna Berger"),
        "record export: no practitioner line"
    );
    for raw in ["FEMALE", "ACTIVE", "(PHYSICIAN)", "1990-01-15"] {
        assert!(!t.contains(raw), "record export: raw value {raw:?} printed");
    }
    assert!(
        t.contains("Weiblich") && t.contains("15.01.1990"),
        "record export: readable sex and date"
    );

    // Discharge leaflet: minimal, plus the emergency number a patient needs after treatment.
    let leaflet = export_discharge_leaflet_pdf(
        &pool,
        &s,
        ExportDischargeLeafletPdfArgs {
            patient_id: "p1".into(),
            additional_notes: Some("Zwei Stunden nicht essen.".into()),
            referral_notes: None,
            preview: true,
            locale: Some("de".into()),
        },
    )
    .await
    .expect("leaflet");
    let t = save_and_read("min-04-entlassbrief", &bytes(&leaflet));
    assert_minimal("leaflet", &t);
    assert!(!t.contains(IBAN), "leaflet: no bank details");
    assert!(t.contains("0541 999999"), "leaflet: emergency number");
}
