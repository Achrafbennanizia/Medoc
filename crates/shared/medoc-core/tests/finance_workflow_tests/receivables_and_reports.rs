//! Open items, reminders and period report workflows.

use super::*;

pub(super) fn invoice(date: &str, source: &str, cents: i64) -> Invoice {
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
pub(super) async fn open_items_double_billing_and_reminders() {
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
    // Minimal layout: the practice is named and the bank account stays so the patient can pay,
    // but the tax number is not printed.
    {
        use base64::Engine as _;
        let raw = base64::engine::general_purpose::STANDARD
            .decode(&preview.pdf_base64)
            .unwrap();
        let raw = String::from_utf8_lossy(&raw);
        assert!(
            raw.contains("Zahnarztpraxis Dr. Test"),
            "reminder: practice name"
        );
        assert!(
            raw.contains("DE89 3704 0044 0532 0130 00"),
            "reminder: bank account to pay to"
        );
        assert!(!raw.contains("12/345/67890"), "reminder: no tax number");
    }
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
pub(super) async fn period_report_uses_money_received_and_real_expenses() {
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
