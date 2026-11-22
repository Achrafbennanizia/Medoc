//! Cash book, day close, open items, reminders and the period report
//! against a real (in-memory SQLCipher) database.

use std::collections::BTreeMap;

use chrono::Datelike;

use medoc_core::application::auth_service::Session;
use medoc_core::application::documents::cash_book::{self, CashMovementArgs, CloseDayArgs};
use medoc_core::application::documents::finance_schema;
use medoc_core::application::documents::issue::{issue_invoice, issue_report, IssueInvoiceArgs};
use medoc_core::application::documents::period_report::{self, PeriodArgs};
use medoc_core::application::documents::receivables::{self, InvoiceListFilter, ReminderArgs};
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_core::infrastructure::pdf::{Invoice, InvoiceLine, ReportPdfInput};

const PRACTICE: &str = r#"{"name":"Zahnarztpraxis Dr. Test","addr":"Hauptstraße 1\n10115 Berlin",
  "clinician_name":"Dr. Test","tax_number":"12/345/67890","bank_iban":"DE89 3704 0044 0532 0130 00",
  "payment_terms_days":14}"#;

fn session(role: &str) -> Session {
    serde_json::from_value(serde_json::json!({
        "user_id": "seed-physician-001", "name": "Dr. Test", "email": "t@example.org",
        "role": role, "permission_overrides": [], "device_session_id": null, "token_version": 0
    }))
    .expect("session")
}

fn day(offset: i64) -> String {
    (chrono::Local::now().date_naive() + chrono::Duration::days(offset))
        .format("%Y-%m-%d")
        .to_string()
}

/// UTC timestamp at local noon of `day(offset)`, as SQLite stores it.
fn noon_utc(offset: i64) -> String {
    let d = chrono::Local::now().date_naive() + chrono::Duration::days(offset);
    d.and_hms_opt(12, 0, 0)
        .unwrap()
        .and_local_timezone(chrono::Local)
        .unwrap()
        .with_timezone(&chrono::Utc)
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

async fn setup() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    app_kv_repo::set(&pool, "invoice.practice.v1", PRACTICE)
        .await
        .unwrap();
    for sql in [
        "INSERT INTO patient (id, name, date_of_birth, sex, insurance_number, status, address)
         VALUES ('p1','Lena Muster','1990-01-15','FEMALE','A1','ACTIVE','Musterweg 1, 10115 Berlin')",
        "INSERT INTO patient_chart (id, patient_id) VALUES ('c1','p1')",
        "INSERT INTO treatment (id, chart_id, kind, total_cost, released_by_physician_id, released_at)
         VALUES ('t1','c1','FILLING',120.0,'seed-physician-001','2026-01-01')",
        "INSERT INTO treatment (id, chart_id, kind, total_cost) VALUES ('t2','c1','FILLING',80.0)",
    ] {
        sqlx::query(sql).execute(&pool).await.unwrap();
    }
    finance_schema::ensure(&pool).await.unwrap();
    pool
}

async fn pay(
    pool: &sqlx::SqlitePool,
    id: &str,
    cents: i64,
    method: &str,
    offset: i64,
    treatment: Option<&str>,
) {
    sqlx::query(
        "INSERT INTO payment (id, patient_id, amount, payment_method, status, treatment_id, created_at)
         VALUES (?1, 'p1', ?2, ?3, 'PAID', ?4, ?5)",
    )
    .bind(id)
    .bind(cents as f64 / 100.0)
    .bind(method)
    .bind(treatment)
    .bind(noon_utc(offset))
    .execute(pool)
    .await
    .unwrap();
}

fn counted(cents: i64, note: Option<&str>, d: &str) -> CloseDayArgs {
    CloseDayArgs {
        as_of_date: d.into(),
        counted_cents: Some(cents),
        note: note.map(String::from),
        ..Default::default()
    }
}

#[tokio::test]
async fn day_close_is_computed_locked_and_carried_forward() {
    let pool = setup().await;
    let s = session("PHYSICIAN");
    let reception = session("RECEPTION");

    // Day -3: 100 € float, 45 € cash, 30 € card.
    cash_book::record_cash_movement(
        &pool,
        &s,
        CashMovementArgs {
            kind: "OPENING_FLOAT".into(),
            amount_cents: 10000,
            reason: "Wechselgeld".into(),
            receipt_ref: None,
        },
    )
    .await
    .unwrap();
    // Movements are booked "now"; move this one to day -3 for the test.
    sqlx::query("DROP TRIGGER trg_cash_movement_no_update")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("UPDATE cash_movement SET occurred_at = ?1, local_day = ?2")
        .bind(noon_utc(-3))
        .bind(day(-3))
        .execute(&pool)
        .await
        .unwrap();
    pay(&pool, "z1", 4500, "CASH", -3, None).await;
    pay(&pool, "z2", 3000, "CARD", -3, None).await;

    let draft = cash_book::prepare(&pool, &s, &day(-3)).await.unwrap();
    assert_eq!(draft.opening_cents, 0);
    assert_eq!(draft.cash_receipts_cents, 4500);
    assert_eq!(draft.cash_movements_cents, 10000);
    assert_eq!(draft.expected_cents, 14500);
    assert_eq!(draft.card_cents, 3000);

    // Reception may not close; a count is mandatory; a difference needs a reason.
    assert!(
        cash_book::close_day(&pool, &reception, counted(14500, None, &day(-3)))
            .await
            .is_err()
    );
    let err = cash_book::close_day(
        &pool,
        &s,
        CloseDayArgs {
            as_of_date: day(-3),
            ..Default::default()
        },
    )
    .await
    .unwrap_err();
    assert!(err.to_string().contains("counted_required"), "{err}");
    let err = cash_book::close_day(&pool, &s, counted(14400, None, &day(-3)))
        .await
        .unwrap_err();
    assert!(err.to_string().contains("variance_note_required"), "{err}");

    // Count by denominations: 100 € + 2×20 € + 4×1 € = 144 €, 1 € short.
    let mut denom = BTreeMap::new();
    denom.insert("10000".to_string(), 1);
    denom.insert("2000".to_string(), 2);
    denom.insert("100".to_string(), 4);
    let closed = cash_book::close_day(
        &pool,
        &s,
        CloseDayArgs {
            as_of_date: day(-3),
            denominations: Some(denom),
            card_terminal_cents: Some(3000),
            note: Some("1 € Wechselgeld falsch herausgegeben".into()),
            ..Default::default()
        },
    )
    .await
    .unwrap();
    assert_eq!(closed.counted_cents, 14400);
    assert_eq!(closed.variance_cents, -100);
    let year = chrono::Local::now().format("%Y").to_string();
    assert_eq!(
        closed.report.document_number.as_deref(),
        Some(format!("TB-{year}-000001").as_str())
    );

    // Same day again: refused. Protocol cannot be deleted or changed.
    assert!(
        cash_book::close_day(&pool, &s, counted(14400, Some("x"), &day(-3)))
            .await
            .is_err()
    );
    assert!(sqlx::query("DELETE FROM day_close_protocol")
        .execute(&pool)
        .await
        .is_err());
    assert!(
        sqlx::query("UPDATE day_close_protocol SET counted_cents = 1")
            .execute(&pool)
            .await
            .is_err()
    );
    // Closed journal lines are locked.
    assert!(
        sqlx::query("UPDATE payment_receipt SET day_close_id = NULL")
            .execute(&pool)
            .await
            .is_err()
    );

    // A client-built daily report is no longer accepted.
    let fake = ReportPdfInput {
        doc_title: "x".into(),
        report_kind: Some("daily_report".into()),
        ..Default::default()
    };
    let err = issue_report(&pool, &s, fake, Some(day(-3)), false)
        .await
        .unwrap_err();
    assert!(err.to_string().contains("use_close_day"));

    // Day -2: opening = counted cash of day -3; a 0 € placeholder from
    // day -3 is filled today-2 → booked on day -2, not on its creation day.
    sqlx::query(
        "INSERT INTO payment (id, patient_id, amount, payment_method, status, amount_expected, created_at)
         VALUES ('z3','p1',0,'CASH','OUTSTANDING',50,?1)",
    )
    .bind(noon_utc(-4))
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("UPDATE payment SET amount = 50, status = 'PAID' WHERE id = 'z3'")
        .execute(&pool)
        .await
        .unwrap();
    // The trigger books "now"; shift the line to day -2 for the test.
    sqlx::query("DROP TRIGGER trg_payment_receipt_no_update")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(
        "UPDATE payment_receipt SET received_at = ?1, local_day = ?2 WHERE payment_id = 'z3'",
    )
    .bind(noon_utc(-2))
    .bind(day(-2))
    .execute(&pool)
    .await
    .unwrap();

    // Bank deposit of 100 €.
    let dep = cash_book::record_cash_movement(
        &pool,
        &s,
        CashMovementArgs {
            kind: "BANK_DEPOSIT".into(),
            amount_cents: 10000,
            reason: "Einzahlung Sparkasse".into(),
            receipt_ref: Some("EZ-17".into()),
        },
    )
    .await
    .unwrap();
    sqlx::query("UPDATE cash_movement SET occurred_at = ?1, local_day = ?2 WHERE id = ?3")
        .bind(noon_utc(-2))
        .bind(day(-2))
        .bind(&dep.id)
        .execute(&pool)
        .await
        .unwrap();
    // Cash expense needs a voucher.
    assert!(cash_book::record_cash_movement(
        &pool,
        &s,
        CashMovementArgs {
            kind: "EXPENSE".into(),
            amount_cents: 500,
            reason: "Porto".into(),
            receipt_ref: None
        },
    )
    .await
    .is_err());

    let d2 = cash_book::prepare(&pool, &s, &day(-2)).await.unwrap();
    assert_eq!(
        d2.opening_cents, 14400,
        "carried from the counted cash of day -3"
    );
    assert_eq!(d2.cash_receipts_cents, 5000);
    assert_eq!(d2.cash_movements_cents, -10000);
    assert_eq!(d2.expected_cents, 9400);
    let c2 = cash_book::close_day(&pool, &s, counted(9400, None, &day(-2)))
        .await
        .unwrap();
    assert_eq!(c2.variance_cents, 0);

    // Closing an earlier day after a later one is refused.
    assert!(cash_book::close_day(&pool, &s, counted(0, None, &day(-5)))
        .await
        .is_err());
    // Future dates are refused.
    assert!(cash_book::close_day(&pool, &s, counted(0, None, &day(1)))
        .await
        .is_err());

    // Correction of the latest closing; the original turns CORRECTED.
    let fixed = cash_book::correct_day_close(
        &pool,
        &s,
        &c2.protocol_id,
        counted(9300, Some("Nachgezählt: 1 Schein fehlte"), ""),
    )
    .await
    .unwrap();
    assert_eq!(fixed.variance_cents, -100);
    let status: String = sqlx::query_scalar("SELECT status FROM day_close_protocol WHERE id = ?1")
        .bind(&c2.protocol_id)
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(status, "CORRECTED");
    // The earlier closing can no longer be corrected (balance carried on).
    assert!(cash_book::correct_day_close(
        &pool,
        &s,
        &closed.protocol_id,
        counted(1, Some("x"), "")
    )
    .await
    .is_err());

    let copy = cash_book::report_copy(&pool, &s, &fixed.protocol_id)
        .await
        .unwrap();
    assert!(copy.reprint);

    // Write the Kassenbericht for a visual check.
    if let Ok(dir) = std::env::var("MEDOC_PDF_SAMPLE_DIR") {
        use base64::Engine;
        let b = base64::engine::general_purpose::STANDARD;
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            format!("{dir}/10-kassenbericht.pdf"),
            b.decode(&closed.report.pdf_base64).unwrap(),
        )
        .unwrap();
        std::fs::write(
            format!("{dir}/11-kassenbericht-korrektur.pdf"),
            b.decode(&fixed.report.pdf_base64).unwrap(),
        )
        .unwrap();
    }
}

#[tokio::test]
async fn older_closing_without_a_stored_report_still_prints() {
    use base64::Engine;
    let pool = setup().await;
    let s = session("PHYSICIAN");
    sqlx::query(
        "INSERT INTO day_close_protocol
            (id, as_of_date, counted_eur, system_cash_eur, system_income_eur, variance_eur,
             cash_matches, day_payment_count, cash_verified_count, all_payments_verified, note)
         VALUES ('legacy-close', ?1, 12.345, 10.5, 20.0, 1.845, 0, 1, 1, 1, 'older entry')",
    )
    .bind(day(-40))
    .execute(&pool)
    .await
    .unwrap();

    let first = cash_book::report_copy(&pool, &s, "legacy-close")
        .await
        .expect("legacy cash report");
    assert!(
        !first.reprint,
        "the first report for an older closing is the original"
    );
    let number = first.document_number.clone().expect("number");
    assert!(number.starts_with("TB-"), "{number}");
    let pdf = base64::engine::general_purpose::STANDARD
        .decode(first.pdf_base64)
        .unwrap();
    let text = String::from_utf8_lossy(&pdf);
    assert!(
        text.contains("12.35"),
        "three digits after the point round to cents"
    );
    assert!(!text.contains("12.345"));

    let stored: Option<String> =
        sqlx::query_scalar("SELECT document_id FROM day_close_protocol WHERE id = 'legacy-close'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(stored, first.document_id);

    let second = cash_book::report_copy(&pool, &s, "legacy-close")
        .await
        .unwrap();
    assert!(second.reprint);
    assert_eq!(second.document_number.as_deref(), Some(number.as_str()));
}

#[tokio::test]
async fn empty_invoice_line_is_filled_from_the_treatment() {
    let pool = setup().await;
    let s = session("PHYSICIAN");
    let date = day(-10);
    let mut inv = invoice(&date, "treatment:t1", 0);
    inv.recipient_name.clear();
    inv.recipient_address.clear();
    inv.lines[0].description.clear();
    inv.lines[0].treatment_date = None;
    inv.lines[0].amount_cents = 0;
    inv.lines[0].fee_schedule = medoc_core::infrastructure::pdf::FeeSchedule::Goz;
    let issued = issue_invoice(
        &pool,
        &s,
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: inv,
            preview: true,
        },
    )
    .await
    .unwrap();
    assert!(!issued.pdf_base64.is_empty());
}

fn invoice(date: &str, source: &str, cents: i64) -> Invoice {
    Invoice {
        date: date.into(),
        recipient_name: "Lena Muster".into(),
        recipient_address: vec!["Musterweg 1".into(), "10115 Berlin".into()],
        lines: vec![InvoiceLine {
            description: "Füllungstherapie".into(),
            amount_cents: cents,
            treatment_date: Some(date.into()),
            source_ref: Some(source.into()),
            ..InvoiceLine::simple("", 0)
        }],
        ..Default::default()
    }
}

#[tokio::test]
async fn open_items_double_billing_and_reminders() {
    let pool = setup().await;
    let s = session("PHYSICIAN");
    let date = day(-40);

    // Unreleased treatment cannot be invoiced.
    let err = issue_invoice(
        &pool,
        &s,
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: invoice(&date, "treatment:t2", 8000),
            preview: true,
        },
    )
    .await
    .unwrap_err();
    assert!(err.to_string().contains("not_released"), "{err}");

    let inv = issue_invoice(
        &pool,
        &s,
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: invoice(&date, "treatment:t1", 12000),
            preview: false,
        },
    )
    .await
    .unwrap();
    let id = inv.document_id.clone().unwrap();

    // Same treatment again: refused.
    let err = issue_invoice(
        &pool,
        &s,
        IssueInvoiceArgs {
            patient_id: "p1".into(),
            invoice: invoice(&date, "treatment:t1", 12000),
            preview: false,
        },
    )
    .await
    .unwrap_err();
    assert!(err.to_string().contains("already_invoiced"), "{err}");

    // 40 € paid, due 14 days after the invoice date → overdue.
    pay(&pool, "z1", 4000, "BANK_TRANSFER", -10, Some("t1")).await;
    let row = receivables::invoice_status(&pool, &s, &id).await.unwrap();
    assert_eq!(row.paid_cents, 4000);
    assert_eq!(row.open_cents, 8000);
    assert_eq!(row.payment_state, "OVERDUE");
    assert_eq!(row.due_date.as_deref(), Some(day(-26).as_str()));
    assert_eq!(row.next_reminder_level, Some(1));

    // No fee on the first reminder.
    assert!(receivables::issue_reminder(
        &pool,
        &s,
        ReminderArgs {
            invoice_document_id: id.clone(),
            fee_cents: 500,
            ..Default::default()
        }
    )
    .await
    .is_err());
    let preview = receivables::issue_reminder(
        &pool,
        &s,
        ReminderArgs {
            invoice_document_id: id.clone(),
            preview: true,
            ..Default::default()
        },
    )
    .await
    .unwrap();
    assert!(preview.document_number.is_none());
    let r1 = receivables::issue_reminder(
        &pool,
        &s,
        ReminderArgs {
            invoice_document_id: id.clone(),
            ..Default::default()
        },
    )
    .await
    .unwrap();
    let year = chrono::Local::now().format("%Y").to_string();
    assert_eq!(
        r1.document_number.as_deref(),
        Some(format!("MA-{year}-000001").as_str())
    );
    // Next level only after the new deadline passed.
    assert!(receivables::issue_reminder(
        &pool,
        &s,
        ReminderArgs {
            invoice_document_id: id.clone(),
            ..Default::default()
        }
    )
    .await
    .is_err());
    assert!(sqlx::query("DELETE FROM payment_reminder")
        .execute(&pool)
        .await
        .is_err());

    // Rest paid → PAID, no reminder possible.
    pay(&pool, "z2", 8000, "CASH", 0, Some("t1")).await;
    let open = receivables::list_invoices(
        &pool,
        &s,
        InvoiceListFilter {
            open_only: true,
            ..Default::default()
        },
    )
    .await
    .unwrap();
    assert!(open.is_empty());
    let row = receivables::invoice_status(&pool, &s, &id).await.unwrap();
    assert_eq!(row.payment_state, "PAID");
    assert_eq!(row.reminder_level, 1);

    if let Ok(dir) = std::env::var("MEDOC_PDF_SAMPLE_DIR") {
        use base64::Engine;
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            format!("{dir}/12-zahlungserinnerung.pdf"),
            base64::engine::general_purpose::STANDARD
                .decode(&r1.pdf_base64)
                .unwrap(),
        )
        .unwrap();
    }
}

#[tokio::test]
async fn period_report_uses_money_received_and_real_expenses() {
    let pool = setup().await;
    let s = session("PHYSICIAN");
    let today = chrono::Local::now().date_naive();
    let first_this_month = today.with_day0(0).unwrap();
    let last_month_end = first_this_month - chrono::Duration::days(1);
    let last_month_start = last_month_end.with_day(1).unwrap();
    let mid = (last_month_start + chrono::Duration::days(10)) - today;

    pay(&pool, "z1", 10000, "CASH", mid.num_days(), None).await;
    pay(&pool, "z2", 5000, "CARD", mid.num_days(), None).await;
    // Partial payment raised later: only the money received counts.
    sqlx::query(
        "INSERT INTO payment (id, patient_id, amount, payment_method, status, amount_expected, created_at)
         VALUES ('z3','p1',20,'CASH','PARTIALLY_PAID',100,?1)",
    )
    .bind(noon_utc(mid.num_days()))
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO contract (id, designation, partner, amount, interval, unlimited, period_from, created_at)
         VALUES ('k1','Praxissoftware','Anbieter GmbH',120,'YEAR',1,'2020-01-01','2020-01-01')",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO purchase_order (id, supplier, item, status, delivered_on, total_amount)
         VALUES ('o1','Dental-Depot','Komposit','DELIVERED',?1,250.5)",
    )
    .bind(last_month_start.format("%Y-%m-%d").to_string())
    .execute(&pool)
    .await
    .unwrap();

    let from = last_month_start.format("%Y-%m-%d").to_string();
    let to = last_month_end.format("%Y-%m-%d").to_string();
    let r = period_report::compute(&pool, &from, &to, "MONTH")
        .await
        .unwrap();
    assert_eq!(r.income_cents, 17000);
    let days = (last_month_end - last_month_start).num_days() + 1;
    let contract =
        medoc_core::domain::services::pricing::euros_to_cents((120.0 / 365.0) * days as f64);
    assert_eq!(r.expenses_cents, 25050 + contract);
    assert_eq!(r.result_cents, 17000 - 25050 - contract);
    assert_eq!(
        r.unclosed_days.len(),
        1,
        "cash day without closing is flagged"
    );

    // Current (unfinished) period cannot be saved; the finished one can.
    assert!(period_report::create(
        &pool,
        &s,
        PeriodArgs {
            from: day(-1),
            to: day(0),
            kind: "CUSTOM".into(),
            ..Default::default()
        }
    )
    .await
    .is_err());
    let saved = period_report::create(
        &pool,
        &s,
        PeriodArgs {
            from,
            to,
            kind: "MONTH".into(),
            ..Default::default()
        },
    )
    .await
    .unwrap();
    let year = chrono::Local::now().format("%Y").to_string();
    assert_eq!(
        saved.pdf.document_number.as_deref(),
        Some(format!("BE-{year}-000001").as_str())
    );
    let copy = period_report::reprint_snapshot(&pool, &s, saved.snapshot_id.as_deref().unwrap())
        .await
        .unwrap();
    assert!(copy.reprint);
    assert_eq!(copy.document_number, saved.pdf.document_number);
    assert!(sqlx::query("DELETE FROM balance_sheet_snapshot")
        .execute(&pool)
        .await
        .is_err());

    // Dashboard overview: outstanding = what is still open, not what was paid.
    let b = period_report::balance_overview(&pool).await.unwrap();
    assert!((b.outstanding - 80.0).abs() < 0.001, "{}", b.outstanding);
    assert!((b.income - 170.0).abs() < 0.001);

    if let Ok(dir) = std::env::var("MEDOC_PDF_SAMPLE_DIR") {
        use base64::Engine;
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            format!("{dir}/13-periodenbericht.pdf"),
            base64::engine::general_purpose::STANDARD
                .decode(&saved.pdf.pdf_base64)
                .unwrap(),
        )
        .unwrap();
    }
}
