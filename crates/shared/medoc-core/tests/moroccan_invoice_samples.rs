//! Moroccan invoices through the real issuing path: a practice billing in MAD gets the
//! CGI art. 145 format (ICE / IF / TP, total in words, VAT exemption), in French and Arabic.
//! PDFs land in `$MEDOC_PDF_SAMPLE_DIR` (default `target/medoc-pdf-samples`) for a visual check.

use std::path::PathBuf;

use base64::Engine;
use medoc_core::application::auth_service::Session;
use medoc_core::application::documents::issue::{
    cancel_invoice, issue_clinical_document, issue_invoice, IssueClinicalArgs, IssueInvoiceArgs,
    IssuedPdf,
};
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_core::infrastructure::pdf::{FeeSchedule, Invoice, InvoiceLine};

const PRACTICE_MA: &str = r#"{
  "name": "Cabinet dentaire Dr. Youssef El Amrani",
  "addr": "112, boulevard Zerktouni\n20250 Casablanca",
  "phone": "0522 47 12 30", "email": "contact@cabinet-elamrani.ma",
  "clinician_name": "Dr. Youssef El Amrani", "professional_title": "Chirurgien-dentiste",
  "currency": "MAD", "payment_terms_days": 15,
  "ma_ice": "001234567000089", "ma_if": "12345678", "ma_tp": "34567890", "ma_inpe": "101234567"
}"#;

fn session() -> Session {
    Session {
        user_id: "seed-physician-001".into(),
        name: "Dr. Youssef El Amrani".into(),
        email: "contact@cabinet-elamrani.ma".into(),
        role: "PHYSICIAN".into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    }
}

async fn setup(practice: &str) -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    app_kv_repo::set(&pool, "invoice.practice.v1", practice)
        .await
        .unwrap();
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, address)
         VALUES ('p1', 'Salma Bennani', '1990-06-14', 'FEMALE', 'CNOPS-77421093', 'ACTIVE',
                 '112, boulevard Zerktouni, 20250 Casablanca')",
    )
    .execute(&pool)
    .await
    .unwrap();
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
        lines: vec![
            line("Examen clinique complet", "C", "", 30_000),
            line("Composite deux faces", "D 30", "36", 60_000),
            line("Détartrage complet", "D 25", "", 40_000),
        ],
        ..Default::default()
    }
}

fn pdf(p: &IssuedPdf) -> Vec<u8> {
    base64::engine::general_purpose::STANDARD
        .decode(&p.pdf_base64)
        .expect("base64")
}

fn save(name: &str, bytes: &[u8]) -> String {
    let dir = std::env::var("MEDOC_PDF_SAMPLE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../target/medoc-pdf-samples")
        });
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join(format!("{name}.pdf")), bytes).unwrap();
    String::from_utf8_lossy(bytes).into_owned()
}

#[tokio::test]
async fn moroccan_practice_issues_french_and_arabic_invoices() {
    let pool = setup(PRACTICE_MA).await;
    let s = session();

    let fr = issue_invoice(
        &pool,
        &s,
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: invoice("fr"),
            preview: false,
        },
    )
    .await
    .expect("issue fr");
    let t = save("ma-01-facture-fr", &pdf(&fr));
    for needle in [
        "ICE 001234567000089",
        "IF 12345678",
        "TP 34567890",
        "INPE 101234567",
        "Total HT",
        "91-VI-1",
        "mille trois cents dirhams",
    ] {
        assert!(t.contains(needle), "fr invoice: missing {needle:?}");
    }
    assert!(
        !t.contains("GOZ") && !t.contains("UStG"),
        "no German law on a Moroccan invoice"
    );

    let ar = issue_invoice(
        &pool,
        &s,
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: invoice("ar"),
            preview: false,
        },
    )
    .await
    .expect("issue ar");
    let t = save("ma-02-facture-ar", &pdf(&ar));
    assert!(t.contains("/Lang (ar)"), "ar invoice: /Lang");
    assert!(t.contains("001234567000089"), "ar invoice: ICE value");

    let credit = cancel_invoice(
        &pool,
        &s,
        ar.document_id.as_deref().unwrap(),
        "Erreur de montant",
    )
    .await
    .expect("credit note");
    save("ma-03-avoir-ar", &pdf(&credit));
}

#[tokio::test]
async fn moroccan_invoice_without_ice_is_refused() {
    let practice = PRACTICE_MA.replace(r#""ma_ice": "001234567000089", "#, "");
    let pool = setup(&practice).await;
    let err = issue_invoice(
        &pool,
        &session(),
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: invoice("fr"),
            preview: true,
        },
    )
    .await
    .expect_err("ICE is mandatory");
    assert!(
        err.to_string().contains("error.invoice.ma_ice_missing"),
        "{err}"
    );
}

/// French and Arabic prescription + certificate from a Moroccan practice (website gallery samples).
#[tokio::test]
async fn moroccan_practice_issues_clinical_documents_in_french_and_arabic() {
    let pool = setup(PRACTICE_MA).await;
    let s = session();
    for sql in [
        "INSERT INTO certificate (id, patient_id, physician_id, kind, body_text, valid_from, valid_until)
         VALUES ('c1', 'p1', 'seed-physician-001', 'SICK_LEAVE', 'Pulpite aiguë 36', '2026-11-09', '2026-11-11')",
        "INSERT INTO prescription (id, patient_id, physician_id, medication, dosage, duration,
                                   dosage_form, pack_size, quantity, prescription_type, issued_at)
         VALUES ('rx1', 'p1', 'seed-physician-001', 'Amoxicilline 1 g', '1 comprimé matin et soir',
                 '7 jours', 'Comprimés', '1 boîte de 14', 1, 'PRIVAT', '2026-11-09')",
        // Re-issuing the same source gives a marked copy, so each language gets its own record.
        "INSERT INTO certificate (id, patient_id, physician_id, kind, body_text, valid_from, valid_until)
         SELECT 'c2', patient_id, physician_id, kind, body_text, valid_from, valid_until FROM certificate WHERE id = 'c1'",
        "INSERT INTO prescription (id, patient_id, physician_id, medication, dosage, duration,
                                   dosage_form, pack_size, quantity, prescription_type, issued_at)
         SELECT 'rx2', patient_id, physician_id, medication, dosage, duration, dosage_form, pack_size,
                quantity, prescription_type, issued_at FROM prescription WHERE id = 'rx1'",
    ] {
        sqlx::query(sql).execute(&pool).await.unwrap();
    }

    let docs: [(&str, &str, &str, &str); 4] = [
        (
            "fr",
            "prescription",
            "ma-04-ordonnance-fr",
            r#"{
          "kind": "prescription", "documentTitle": "ORDONNANCE",
          "metaLines": [{"label": "Date", "value": "09/11/2026"}],
          "twoColumn": {"leftTitle": "Patient(e)", "leftLines": ["Salma Bennani", "Née le 14/06/1990"],
                        "rightTitle": "Adresse", "rightLines": ["112, boulevard Zerktouni, Casablanca"]},
          "tables": [{"title": "Rp.", "columnLayout": "prescription",
            "headers": ["Médicament / dosage", "Forme", "Quantité", "Posologie", "Durée"],
            "rows": [["Amoxicilline 1 g", "Comprimés", "1 boîte de 14", "1 comprimé matin et soir", "7 jours"],
                     ["Paracétamol 1 g", "Comprimés", "1 boîte de 8", "1 comprimé si douleur, max. 3/jour", "3 jours"]]}],
          "closingParagraphs": ["Allergies notées au dossier : aucune."]
        }"#,
        ),
        (
            "ar",
            "prescription",
            "ma-05-ordonnance-ar",
            r#"{
          "kind": "prescription", "documentTitle": "وصفة طبية",
          "metaLines": [{"label": "التاريخ", "value": "09/11/2026"}],
          "twoColumn": {"leftTitle": "المريض(ة)", "leftLines": ["سلمى بناني", "تاريخ الازدياد 14/06/1990"],
                        "rightTitle": "العنوان", "rightLines": ["112، شارع الزرقطوني، الدار البيضاء"]},
          "tables": [{"title": "Rp.", "columnLayout": "prescription",
            "headers": ["الدواء / الجرعة", "الشكل", "الكمية", "طريقة الاستعمال", "المدة"],
            "rows": [["Amoxicilline 1 g", "أقراص", "علبة واحدة من 14", "قرص صباحًا ومساءً", "7 أيام"]]}],
          "closingParagraphs": ["الحساسية المسجلة في الملف: لا شيء."]
        }"#,
        ),
        (
            "fr",
            "certificate",
            "ma-06-certificat-fr",
            r#"{
          "kind": "certificate", "documentTitle": "CERTIFICAT MÉDICAL D'ARRÊT DE TRAVAIL",
          "metaLines": [{"label": "Établi le", "value": "09/11/2026"}],
          "introParagraphs": ["Je soussigné, Dr. Youssef El Amrani, chirurgien-dentiste, certifie avoir examiné ce jour la personne ci-dessous."],
          "twoColumn": {"leftTitle": "Patient(e)", "leftLines": ["Salma Bennani", "Née le 14/06/1990"],
                        "rightTitle": "Adresse", "rightLines": ["112, boulevard Zerktouni, Casablanca"]},
          "labelValueRows": [
            {"label": "Arrêt de travail du", "value": "09/11/2026"},
            {"label": "Jusqu'au (inclus)", "value": "11/11/2026"},
            {"label": "Motif", "value": "Pulpite aiguë 36", "confidential": true}
          ],
          "closingParagraphs": ["Certificat établi à la demande de l'intéressée et remis en main propre."]
        }"#,
        ),
        (
            "ar",
            "certificate",
            "ma-07-certificat-ar",
            r#"{
          "kind": "certificate", "documentTitle": "شهادة طبية للتوقف عن العمل",
          "metaLines": [{"label": "حررت بتاريخ", "value": "09/11/2026"}],
          "introParagraphs": ["أشهد أنا الموقع أسفله، الدكتور يوسف العمراني، جراح أسنان، أنني فحصت اليوم الشخص المذكور أدناه."],
          "twoColumn": {"leftTitle": "المريض(ة)", "leftLines": ["سلمى بناني", "تاريخ الازدياد 14/06/1990"],
                        "rightTitle": "العنوان", "rightLines": ["112، شارع الزرقطوني، الدار البيضاء"]},
          "labelValueRows": [
            {"label": "توقف عن العمل من", "value": "09/11/2026"},
            {"label": "إلى غاية", "value": "11/11/2026"},
            {"label": "السبب", "value": "التهاب حاد في لب السن 36", "confidential": true}
          ],
          "closingParagraphs": ["سلمت هذه الشهادة بطلب من المعنية بالأمر."]
        }"#,
        ),
    ];
    for (locale, kind, name, layout) in docs {
        app_kv_repo::set(&pool, "documents.locale.v1", &format!("\"{locale}\""))
            .await
            .unwrap();
        let issued = issue_clinical_document(
            &pool,
            &s,
            IssueClinicalArgs {
                kind: kind.into(),
                source_id: match (kind, locale) {
                    ("prescription", "fr") => "rx1".into(),
                    ("prescription", _) => "rx2".into(),
                    (_, "fr") => "c1".into(),
                    _ => "c2".into(),
                },
                layout_json: layout.into(),
                preview: false,
                copy_variant: if kind == "certificate" {
                    Some("patient".into())
                } else {
                    None
                },
            },
        )
        .await
        .unwrap_or_else(|e| panic!("{name}: {e}"));
        let t = save(name, &pdf(&issued));
        assert!(t.contains(&format!("/Lang ({locale}")), "{name}: /Lang");
        assert!(
            !t.contains("ZANR") && !t.contains("AMVV") && !t.contains("BGB"),
            "{name}: no German law on a Moroccan document"
        );
        // Prescriptions and certificates: INPE identifies the dentist; tax ids stay on invoices.
        assert!(t.contains("101234567"), "{name}: INPE");
        assert!(
            !t.contains("001234567000089") && !t.contains("34567890"),
            "{name}: no ICE / TP on a clinical document"
        );
    }
}

/// A Moroccan practice that still has German numbers saved (from a demo or an earlier set-up):
/// the letterhead shows the Moroccan ids once and no BSNR / ZANR.
#[tokio::test]
async fn moroccan_letterhead_drops_german_ids() {
    let practice = PRACTICE_MA.replace(
        r#""currency": "MAD","#,
        r#""currency": "MAD", "country": "MA", "bsnr": "987654321", "zanr": "123456789","#,
    );
    let pool = setup(&practice).await;
    let fr = issue_invoice(
        &pool,
        &session(),
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: invoice("fr"),
            preview: true,
        },
    )
    .await
    .expect("issue fr");
    let t = String::from_utf8_lossy(&pdf(&fr)).into_owned();
    assert!(
        !t.contains("BSNR") && !t.contains("ZANR"),
        "German ids on a Moroccan invoice"
    );
    // Once in the letterhead, once in the identity footer; never twice in the header.
    assert_eq!(
        t.matches("001234567000089").count(),
        2,
        "ICE in header and footer only"
    );
}
