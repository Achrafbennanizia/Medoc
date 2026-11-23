//! One invoice, prescription and certificate per practice country (France, EU) through the real
//! issuing path, for a legal-mentions review. Morocco and Germany have their own sample tests.
//! PDFs land in `$MEDOC_PDF_SAMPLE_DIR` (default `target/medoc-pdf-samples`).

use std::path::PathBuf;

use base64::Engine;
use medoc_core::application::auth_service::Session;
use medoc_core::application::documents::issue::{
    issue_clinical_document, issue_invoice, IssueClinicalArgs, IssueInvoiceArgs, IssuedPdf,
};
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_core::infrastructure::pdf::{FeeSchedule, Invoice, InvoiceLine};

const PRACTICE_FR: &str = r#"{
  "name": "Cabinet dentaire Dr. Claire Martin", "country": "FR", "currency": "EUR",
  "addr": "14 rue de la République\n69002 Lyon",
  "phone": "04 78 00 00 00", "email": "contact@cabinet-martin.fr",
  "clinician_name": "Dr. Claire Martin", "professional_title": "Chirurgien-dentiste",
  "bank_iban": "FR76 3000 6000 0112 3456 7890 189",
  "bank_bic": "AGRIFRPPXXX", "payment_terms_days": 30,
  "fr_rpps": "10101234567", "fr_siret": "12345678900012",
  "bsnr": "987654321", "zanr": "123456789", "emergency_phone": "04 78 99 99 99"
}"#;

const PRACTICE_EU: &str = r#"{
  "name": "Dental practice Dr. Jan de Vries", "country": "EU", "currency": "EUR",
  "addr": "Keizersgracht 100\n1015 CV Amsterdam",
  "phone": "+31 20 000 0000", "email": "info@devries-dental.nl",
  "clinician_name": "Dr. Jan de Vries", "professional_title": "Dentist",
  "vat_id": "NL000000000B01", "bank_iban": "NL91 ABNA 0417 1643 00", "payment_terms_days": 30
}"#;

fn session() -> Session {
    Session {
        user_id: "seed-physician-001".into(),
        name: "Dr".into(),
        email: "dr@example.org".into(),
        role: "PHYSICIAN".into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    }
}

fn pdf(p: &IssuedPdf) -> Vec<u8> {
    base64::engine::general_purpose::STANDARD.decode(&p.pdf_base64).expect("base64")
}

fn save(name: &str, bytes: &[u8]) -> String {
    let dir = std::env::var("MEDOC_PDF_SAMPLE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../target/medoc-pdf-samples"));
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join(format!("{name}.pdf")), bytes).unwrap();
    String::from_utf8_lossy(bytes).into_owned()
}

async fn setup(practice: &str, locale: &str) -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    app_kv_repo::set(&pool, "invoice.practice.v1", practice).await.unwrap();
    app_kv_repo::set(&pool, "documents.locale.v1", &format!("\"{locale}\"")).await.unwrap();
    for sql in [
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, address)
         VALUES ('p1', 'Camille Durand', '1988-03-02', 'FEMALE', '2880369123456', 'ACTIVE', '3 place Bellecour, 69002 Lyon')",
        "INSERT INTO certificate (id, patient_id, physician_id, kind, body_text, valid_from, valid_until)
         VALUES ('c1', 'p1', 'seed-physician-001', 'SICK_LEAVE', 'Pulpite aiguë 36', '2026-11-09', '2026-11-11')",
        "INSERT INTO prescription (id, patient_id, physician_id, medication, dosage, duration,
                                   dosage_form, pack_size, quantity, prescription_type, issued_at)
         VALUES ('rx1', 'p1', 'seed-physician-001', 'Amoxicilline 1 g', '1 cp matin et soir', '7 jours',
                 'Comprimés', '1 boîte de 14', 1, 'PRIVAT', '2026-11-09')",
    ] {
        sqlx::query(sql).execute(&pool).await.unwrap();
    }
    pool
}

fn invoice(locale: &str) -> Invoice {
    let line = |desc: &str, code: &str, tooth: &str, cents: i64| InvoiceLine {
        description: desc.into(),
        goz_nr: Some(code.into()),
        tooth_nr: Some(tooth.into()),
        fee_schedule: FeeSchedule::Other,
        amount_cents: cents,
        quantity: Some(1),
        treatment_date: Some("2026-11-02".into()),
        ..Default::default()
    };
    Invoice {
        locale: locale.into(),
        lines: vec![line("Consultation", "C", "", 2_300), line("Composite deux faces", "HBMD043", "36", 7_920)],
        ..Default::default()
    }
}

const RX: &str = r#"{"kind": "prescription", "documentTitle": "ORDONNANCE",
  "metaLines": [{"label": "Date", "value": "09/11/2026"}],
  "tables": [{"title": "Rp.", "columnLayout": "prescription",
    "headers": ["Médicament / dosage", "Forme", "Quantité", "Posologie", "Durée"],
    "rows": [["Amoxicilline 1 g", "Comprimés", "1 boîte de 14", "1 cp matin et soir", "7 jours"]]}]}"#;
const CERT: &str = r#"{"kind": "certificate", "documentTitle": "CERTIFICAT MÉDICAL",
  "metaLines": [{"label": "Date", "value": "09/11/2026"}],
  "labelValueRows": [{"label": "Arrêt du", "value": "09/11/2026"}, {"label": "Au", "value": "11/11/2026"},
                     {"label": "Motif", "value": "Pulpite aiguë 36", "confidential": true}]}"#;

async fn issue_all(tag: &str, practice: &str, locale: &str) -> [String; 3] {
    let pool = setup(practice, locale).await;
    let s = session();
    let inv = issue_invoice(&pool, &s, IssueInvoiceArgs { patient_id: "p1".into(), invoice: invoice(locale), preview: false })
        .await
        .unwrap_or_else(|e| panic!("{tag} invoice: {e}"));
    let rx = issue_clinical_document(&pool, &s, IssueClinicalArgs { kind: "prescription".into(), source_id: "rx1".into(), layout_json: RX.into(), preview: false, copy_variant: None })
        .await
        .unwrap_or_else(|e| panic!("{tag} rx: {e}"));
    let cert = issue_clinical_document(&pool, &s, IssueClinicalArgs { kind: "certificate".into(), source_id: "c1".into(), layout_json: CERT.into(), preview: false, copy_variant: Some("patient".into()) })
        .await
        .unwrap_or_else(|e| panic!("{tag} cert: {e}"));
    [
        save(&format!("{tag}-01-invoice"), &pdf(&inv)),
        save(&format!("{tag}-02-prescription"), &pdf(&rx)),
        save(&format!("{tag}-03-certificate"), &pdf(&cert)),
    ]
}

#[tokio::test]
async fn french_and_eu_practices_issue_their_documents() {
    let [inv, rx, cert] = issue_all("fr", PRACTICE_FR, "fr").await;
    for (name, t) in [("invoice", &inv), ("prescription", &rx), ("certificate", &cert)] {
        for german in ["BGB", "ZANR", "BSNR", "Notdienst", "Kontoinhaber"] {
            assert!(!t.contains(german), "fr {name}: German {german:?}");
        }
        assert!(t.contains("RPPS 10101234567"), "fr {name}: RPPS");
    }
    assert!(inv.contains("SIRET 12345678900012"), "fr invoice: SIRET");
    assert!(inv.contains("T\\351l. 04 78"), "fr invoice: French phone label");
    assert!(inv.contains("261-4-1"), "fr invoice: VAT exemption (CGI art. 261-4-1)");
    assert!(inv.contains("22/11/2026") || inv.contains("/2026"), "fr invoice: French date format");
    assert!(!inv.contains(".11.2026"), "fr invoice: no German date format");
    assert!(rx.contains("Sexe : F"), "fr prescription: patient sex (R.5132-3 CSP)");
    assert!(!rx.contains("2880369123456"), "fr prescription: no social-security number");

    // Country number prefixes (French series), clinical documents without tax ids or bank details.
    assert!(inv.contains("FA-2026-000001"), "fr invoice: French prefix");
    assert!(rx.contains("OR-2026-000001") && cert.contains("CM-2026-000001"), "fr: French prefixes");
    for (name, t) in [("prescription", &rx), ("certificate", &cert)] {
        assert!(!t.contains("SIRET") && !t.contains("FR76"), "fr {name}: no SIRET / IBAN");
    }
    // Sick leave in France: the free-form certificate says it is not the CPAM notice.
    assert!(cert.contains("amelipro"), "fr sick-leave certificate: CPAM channels named");

    let [inv, _, _] = issue_all("eu", PRACTICE_EU, "en").await;
    assert!(inv.contains("INV-2026-000001"), "eu invoice: English prefix");
    assert!(!inv.contains("BGB"), "eu invoice: no German law");
    assert!(inv.contains("2006/112"), "eu invoice: VAT exemption (Directive 2006/112/EC)");
    assert!(inv.contains("NL000000000B01"), "eu invoice: VAT id");
}
