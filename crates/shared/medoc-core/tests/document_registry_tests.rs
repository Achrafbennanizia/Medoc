//! Issuing official documents: numbering, registry, reprints, cancellation,
//! RBAC and GoBD immutability against a real (in-memory SQLCipher) database.

use medoc_core::application::auth_service::Session;
use medoc_core::application::documents::issue::{
    cancel_invoice, issue_clinical_document, issue_invoice, IssueClinicalArgs, IssueInvoiceArgs,
};
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::{app_kv_repo, issued_document_repo};
use medoc_core::infrastructure::pdf::{unit_fee_cents, FeeSchedule, Invoice, InvoiceLine};

fn session(role: &str) -> Session {
    Session {
        user_id: "seed-physician-001".into(),
        name: "Dr. Test".into(),
        email: "t@example.org".into(),
        role: role.into(),
        permission_overrides: vec![],
        device_session_id: None,
        token_version: 0,
    }
}

async fn setup() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    app_kv_repo::set(
        &pool,
        "invoice.practice.v1",
        r#"{"name":"Zahnarztpraxis Dr. Test","addr":"Hauptstraße 1\n10115 Berlin",
            "clinician_name":"Dr. Test","tax_number":"12/345/67890","bsnr":"123456789",
            "zanr":"987654321","bank_iban":"DE89 3704 0044 0532 0130 00"}"#,
    )
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status)
         VALUES ('p1', 'Lena Muster', '1990-01-15', 'FEMALE', 'A123456789', 'ACTIVE')",
    )
    .execute(&pool)
    .await
    .unwrap();
    for (id, status) in [("pay-paid", "PAID"), ("pay-open", "OUTSTANDING")] {
        sqlx::query(
            "INSERT INTO payment (id, patient_id, amount, payment_method, status)
             VALUES (?1, 'p1', 45.0, 'CASH', ?2)",
        )
        .bind(id)
        .bind(status)
        .execute(&pool)
        .await
        .unwrap();
    }
    pool
}

fn receipt_layout() -> String {
    r#"{"kind":"receipt","practiceLines":["Gefälschte Praxis"],"documentTitle":"QUITTUNG",
        "addressLines":["Lena Muster"],"totals":[{"label":"Betrag","value":"45,00 EUR","total":true}]}"#
        .into()
}

fn year() -> String {
    chrono::Local::now().format("%Y").to_string()
}

#[tokio::test]
async fn receipt_is_numbered_once_and_reprinted_as_copy() {
    let pool = setup().await;
    let s = session("PHYSICIAN");
    let args = |preview| IssueClinicalArgs {
        kind: "receipt".into(),
        source_id: "pay-paid".into(),
        layout_json: receipt_layout(),
        preview,
        copy_variant: None,
    };

    let preview = issue_clinical_document(&pool, &s, args(true))
        .await
        .unwrap();
    assert!(
        preview.document_number.is_none(),
        "preview must not consume a number"
    );

    let first = issue_clinical_document(&pool, &s, args(false))
        .await
        .unwrap();
    assert_eq!(
        first.document_number.as_deref(),
        Some(format!("QU-{}-000001", year()).as_str())
    );
    assert!(!first.reprint);

    let again = issue_clinical_document(&pool, &s, args(false))
        .await
        .unwrap();
    assert!(again.reprint);
    assert_eq!(again.document_number, first.document_number);
    assert_ne!(
        again.sha256, first.sha256,
        "copy carries the KOPIE watermark"
    );

    // Server overwrote the practice header sent by the client.
    let doc = issued_document_repo::find_by_id(&pool, first.document_id.as_deref().unwrap())
        .await
        .unwrap()
        .unwrap();
    assert!(doc.payload_json.contains("Zahnarztpraxis Dr. Test"));
    assert!(!doc.payload_json.contains("Gefälschte Praxis"));

    // Both prints are verifiable by hash.
    assert!(issued_document_repo::find_by_sha256(&pool, &again.sha256)
        .await
        .unwrap()
        .is_some());
}

#[tokio::test]
async fn receipt_for_unpaid_payment_is_refused() {
    let pool = setup().await;
    let err = issue_clinical_document(
        &pool,
        &session("PHYSICIAN"),
        IssueClinicalArgs {
            kind: "receipt".into(),
            source_id: "pay-open".into(),
            layout_json: receipt_layout(),
            preview: false,
            copy_variant: None,
        },
    )
    .await
    .unwrap_err();
    assert!(err.to_string().contains("receipt_requires_payment"));
}

#[tokio::test]
async fn reception_cannot_issue_certificates() {
    let pool = setup().await;
    sqlx::query(
        "INSERT INTO certificate (id, patient_id, physician_id, kind, body_text, valid_from, valid_until)
         VALUES ('c1', 'p1', 'seed-physician-001', 'SICK_LEAVE', 'x', '2026-06-01', '2026-06-03')",
    )
    .execute(&pool)
    .await
    .unwrap();
    let err = issue_clinical_document(
        &pool,
        &session("RECEPTION"),
        IssueClinicalArgs {
            kind: "certificate".into(),
            source_id: "c1".into(),
            layout_json: r#"{"kind":"certificate","documentTitle":"AU"}"#.into(),
            preview: false,
            copy_variant: Some("employer".into()),
        },
    )
    .await
    .unwrap_err();
    assert!(matches!(err, medoc_core::error::AppError::Forbidden));
}

fn invoice() -> Invoice {
    Invoice {
        recipient_name: "Lena Muster".into(),
        recipient_address: vec!["Musterweg 1".into(), "10115 Berlin".into()],
        lines: vec![InvoiceLine {
            description: "Eingehende Untersuchung".into(),
            goz_nr: Some("0010".into()),
            points: Some(100),
            factor: Some(2.3),
            amount_cents: unit_fee_cents(FeeSchedule::Goz, 100, 2.3),
            treatment_date: Some("2026-05-20".into()),
            ..Default::default()
        }],
        ..Default::default()
    }
}

#[tokio::test]
async fn invoice_cancellation_creates_storno_and_locks_original() {
    let pool = setup().await;
    let s = session("PHYSICIAN");
    let issued = issue_invoice(
        &pool,
        &s,
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: invoice(),
            preview: false,
        },
    )
    .await
    .unwrap();
    assert_eq!(
        issued.document_number.as_deref(),
        Some(format!("RE-{}-000001", year()).as_str())
    );

    let storno = cancel_invoice(
        &pool,
        &s,
        issued.document_id.as_deref().unwrap(),
        "Doppelt erfasst",
    )
    .await
    .unwrap();
    assert_eq!(
        storno.document_number.as_deref(),
        Some(format!("ST-{}-000001", year()).as_str())
    );

    let original = issued_document_repo::find_by_id(&pool, issued.document_id.as_deref().unwrap())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(original.status, "CANCELLED");
    // A second cancellation is refused.
    assert!(cancel_invoice(&pool, &s, &original.id, "nochmal")
        .await
        .is_err());

    // GoBD: content of an issued document cannot be changed or deleted.
    let upd = sqlx::query("UPDATE issued_document SET payload_json = '{}' WHERE id = ?1")
        .bind(&original.id)
        .execute(&pool)
        .await;
    assert!(upd.is_err());
    let del = sqlx::query("DELETE FROM issued_document WHERE id = ?1")
        .bind(&original.id)
        .execute(&pool)
        .await;
    assert!(del.is_err());
}

#[tokio::test]
async fn invalid_invoice_does_not_consume_a_number() {
    let pool = setup().await;
    let s = session("PHYSICIAN");
    let mut bad = invoice();
    bad.lines[0].factor = Some(3.0); // > 2.3 without justification, amount mismatch
    assert!(issue_invoice(
        &pool,
        &s,
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: bad,
            preview: false
        }
    )
    .await
    .is_err());
    let ok = issue_invoice(
        &pool,
        &s,
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: invoice(),
            preview: false,
        },
    )
    .await
    .unwrap();
    assert_eq!(
        ok.document_number.as_deref(),
        Some(format!("RE-{}-000001", year()).as_str())
    );
}

#[tokio::test]
async fn gdpr_export_contains_full_rows_and_erasure_respects_retention() {
    let pool = setup().await;
    let export = medoc_core::infrastructure::gdpr::export_patient(&pool, "p1")
        .await
        .unwrap();
    let payments = export["related"]["payments"].as_array().unwrap();
    assert_eq!(payments.len(), 2);
    assert_eq!(payments[0]["amount"], 45.0, "full row, not just an id");
    assert!(export.get("access_log").is_some());

    let until = medoc_core::infrastructure::gdpr::retention_until(&pool, "p1")
        .await
        .unwrap();
    assert!(
        until.is_some(),
        "recent payment blocks erasure (§ 147 AO / § 630f BGB)"
    );
    let err = medoc_core::infrastructure::gdpr::erase_patient(
        &pool,
        "p1",
        std::path::Path::new("/nonexistent"),
    )
    .await
    .unwrap_err();
    assert!(err.to_string().contains("retention_active"));
}
