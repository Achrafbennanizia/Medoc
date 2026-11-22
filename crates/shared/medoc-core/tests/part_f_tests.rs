//! Part F/G billing and inventory: F73, F77, F78, F79, F81, F84, F98.

use chrono::NaiveDate;
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::enums::Sex;
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use medoc_core::infrastructure::database::repos::billing::payment as payment_repo;
use medoc_core::infrastructure::database::repos::clinical::chart as chart_repo;
use medoc_core::infrastructure::database::repos::clinical::patient as patient_repo;
use medoc_core::infrastructure::database::repos::practice::purchase_order as purchase_order_repo;
use medoc_core::infrastructure::database::repos::scheduling::practice_task as practice_task_repo;
use sqlx::SqlitePool;

async fn pool() -> SqlitePool {
    let p = test_memory_pool().await.unwrap();
    run_migrations(&p).await.unwrap();
    app_kv_repo::set(&p, "practice.timezone.v1", "Europe/Berlin")
        .await
        .unwrap();
    p
}

async fn patient(pool: &SqlitePool, name: &str) -> String {
    patient_repo::create(
        pool,
        &CreatePatient {
            name: name.into(),
            date_of_birth: NaiveDate::from_ymd_opt(1980, 1, 1).unwrap(),
            sex: Sex::Male,
            insurance_number: format!("F-{name}"),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .unwrap()
    .id
}

async fn raw_payment(
    pool: &SqlitePool,
    id: &str,
    pid: &str,
    amount: f64,
    status: &str,
    created_utc: &str,
) {
    sqlx::query(
        "INSERT INTO payment (id, patient_id, amount, payment_method, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'CASH', ?4, ?5, ?5)",
    )
    .bind(id)
    .bind(pid)
    .bind(amount)
    .bind(status)
    .bind(created_utc)
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn payment_after_local_midnight_is_in_new_day() {
    let pool = pool().await;
    let pid = patient(&pool, "midnight").await;
    // 23:30 UTC on 9 Nov = 00:30 on 10 Nov in Berlin.
    raw_payment(&pool, "pay-late", &pid, 10.0, "PAID", "2026-11-09 23:30:00").await;
    raw_payment(&pool, "pay-day", &pid, 20.0, "PAID", "2026-11-09 10:00:00").await;
    let on = |d: &'static str| payment_repo::PaymentListFilter {
        date_on: Some(d),
        ..Default::default()
    };
    let (day10, _) = payment_repo::find_paginated(&pool, 100, 0, "ASC", on("2026-11-10"))
        .await
        .unwrap();
    let (day9, _) = payment_repo::find_paginated(&pool, 100, 0, "ASC", on("2026-11-09"))
        .await
        .unwrap();
    assert_eq!(
        day10.iter().map(|p| p.id.as_str()).collect::<Vec<_>>(),
        vec!["pay-late"]
    );
    assert_eq!(
        day9.iter().map(|p| p.id.as_str()).collect::<Vec<_>>(),
        vec!["pay-day"]
    );
}

#[tokio::test]
async fn active_on_includes_payment_filled_on_a_later_day() {
    let pool = pool().await;
    let pid = patient(&pool, "fill").await;
    raw_payment(
        &pool,
        "pay-old",
        &pid,
        0.0,
        "OUTSTANDING",
        "2026-11-10 09:00:00",
    )
    .await;
    sqlx::query(
        "UPDATE payment SET amount = 40, status = 'PAID', updated_at = '2026-11-16T08:30:00Z' WHERE id = 'pay-old'",
    )
    .execute(&pool)
    .await
    .unwrap();
    let created = payment_repo::PaymentListFilter {
        date_on: Some("2026-11-16"),
        ..Default::default()
    };
    let active = payment_repo::PaymentListFilter {
        active_on: Some("2026-11-16"),
        ..Default::default()
    };
    let (by_created, _) = payment_repo::find_paginated(&pool, 20, 0, "ASC", created)
        .await
        .unwrap();
    assert!(by_created.is_empty());
    let (by_active, _) = payment_repo::find_paginated(&pool, 20, 0, "ASC", active)
        .await
        .unwrap();
    assert_eq!(
        by_active.iter().map(|p| p.id.as_str()).collect::<Vec<_>>(),
        vec!["pay-old"]
    );
}

#[tokio::test]
async fn day_close_includes_all_payments_of_a_busy_day() {
    let pool = pool().await;
    let pid = patient(&pool, "busy").await;
    for i in 0..300 {
        let ts = format!("2026-11-12 {:02}:{:02}:00", 7 + i / 60, i % 60);
        raw_payment(&pool, &format!("busy-{i}"), &pid, 1.0, "PAID", &ts).await;
    }
    let f = payment_repo::PaymentListFilter {
        date_on: Some("2026-11-12"),
        ..Default::default()
    };
    let (_, total) = payment_repo::find_paginated(&pool, 500, 0, "ASC", f)
        .await
        .unwrap();
    assert_eq!(total, 300);
}

#[tokio::test]
async fn month_buckets_use_local_month() {
    let pool = pool().await;
    let pid = patient(&pool, "month").await;
    let now = chrono::Utc::now();
    let local_month = now
        .with_timezone(&medoc_core::domain::practice_time::DEFAULT)
        .format("%Y-%m")
        .to_string();
    raw_payment(
        &pool,
        "m1",
        &pid,
        5.0,
        "PAID",
        &now.format("%Y-%m-%d %H:%M:%S").to_string(),
    )
    .await;
    let buckets = payment_repo::monthly_breakdown(&pool, 3).await.unwrap();
    let cur = buckets
        .iter()
        .find(|b| b.year_month == local_month)
        .expect("local month bucket");
    assert!((cur.income - 5.0).abs() < 1e-9);
}

#[tokio::test]
async fn entered_amount_is_kept() {
    let pool = pool().await;
    let pid = patient(&pool, "amount").await;
    sqlx::query("INSERT INTO service_item (id, name, category, price) VALUES ('svc-1', 'Cleaning', 'PROPHYLAXIS', 80.0)")
        .execute(&pool)
        .await
        .unwrap();
    let data: medoc_core::domain::entities::payment::CreatePayment =
        serde_json::from_value(serde_json::json!({
            "patient_id": pid, "amount": 65.0, "payment_method": "CASH",
            "service_item_id": "svc-1", "description": "discounted"
        }))
        .unwrap();
    let p = payment_repo::create(&pool, &data).await.unwrap();
    assert!(
        (p.amount - 65.0).abs() < 1e-9,
        "catalog price must not overwrite the entered amount"
    );
}

async fn order(pool: &SqlitePool, item: &str, qty: i32, total: Option<f64>) -> String {
    let data: medoc_core::domain::entities::purchase_order::CreatePurchaseOrder = serde_json::from_value(
        serde_json::json!({ "supplier": "Dental Supply", "item": item, "quantity": qty, "total_amount": total }),
    )
    .unwrap();
    purchase_order_repo::create(pool, &data, "seed-admin-001")
        .await
        .unwrap()
        .id
}

#[tokio::test]
async fn delivery_raises_stock_once() {
    let pool = pool().await;
    sqlx::query("INSERT INTO product (id, name, category, price, stock, min_stock) VALUES ('prod-g', 'Gloves M', 'CONSUMABLE', 9.5, 4, 2)")
        .execute(&pool)
        .await
        .unwrap();
    let id = order(&pool, "Gloves M", 10, Some(95.0)).await;
    purchase_order_repo::update_status(&pool, &id, "DELIVERED")
        .await
        .unwrap();
    let _ = purchase_order_repo::update_status(&pool, &id, "DELIVERED").await;
    let stock: i64 = sqlx::query_scalar("SELECT stock FROM product WHERE id = 'prod-g'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(stock, 14);
}

#[tokio::test]
async fn order_total_updates_on_quantity_change() {
    let pool = pool().await;
    let id = order(&pool, "Gloves L", 10, Some(95.0)).await;
    let patch: medoc_core::domain::entities::purchase_order::UpdatePurchaseOrder =
        serde_json::from_value(serde_json::json!({ "quantity": 4 })).unwrap();
    let o = purchase_order_repo::update(&pool, &id, &patch)
        .await
        .unwrap();
    assert_eq!(o.quantity, 4);
    assert!((o.total_amount.unwrap() - 38.0).abs() < 1e-9);
}

#[tokio::test]
async fn delete_line_cancels_open_booking_and_is_refused_when_paid() {
    let pool = pool().await;
    let pid = patient(&pool, "line").await;
    let chart_id: String = sqlx::query_scalar("SELECT id FROM patient_chart WHERE patient_id = ?1")
        .bind(&pid)
        .fetch_one(&pool)
        .await
        .unwrap();
    for (tid, status, amount) in [("t-open", "OUTSTANDING", 0.0), ("t-paid", "PAID", 50.0)] {
        sqlx::query("INSERT INTO treatment (id, chart_id, kind) VALUES (?1, ?2, 'FILLING')")
            .bind(tid)
            .bind(&chart_id)
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO payment (id, patient_id, amount, payment_method, status, treatment_id)
             VALUES (?1, ?2, ?3, 'INVOICE', ?4, ?5)",
        )
        .bind(format!("pay-{tid}"))
        .bind(&pid)
        .bind(amount)
        .bind(status)
        .bind(tid)
        .execute(&pool)
        .await
        .unwrap();
    }
    chart_repo::delete_treatment(&pool, "t-open").await.unwrap();
    let st: String = sqlx::query_scalar("SELECT status FROM payment WHERE id = 'pay-t-open'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(st, "CANCELLED");
    let err = chart_repo::delete_treatment(&pool, "t-paid")
        .await
        .expect_err("paid line");
    assert!(matches!(err, AppError::Conflict(_)));
    let still: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM treatment WHERE id = 't-paid'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(still, 1);
}

#[tokio::test]
async fn paying_completes_task_via_workflow() {
    let pool = pool().await;
    let pid = patient(&pool, "task").await;
    sqlx::query(
        "INSERT INTO practice_task (id, patient_id, kind, title, assignee_role, created_by, treatment_id, status)
         VALUES ('task-b', ?1, 'BILLING', 'Bill filling', 'RECEPTION', 'seed-physician-001', 't-x', 'OPEN')",
    )
    .bind(&pid)
    .execute(&pool)
    .await
    .unwrap();
    practice_task_repo::close_billing_tasks_after_payment_paid(&pool, "pay-x", Some("t-x"), None)
        .await
        .unwrap();
    let st: String = sqlx::query_scalar("SELECT status FROM practice_task WHERE id = 'task-b'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(st, "DONE_RECEPTION", "the creator still validates");
}

/// "Impossible de charger les paiements … no column found for name: updated_at":
/// the patient's payment list must load on databases with and without
/// `payment.updated_at`.
#[tokio::test]
async fn patient_payments_load_with_and_without_updated_at_column() {
    let pool = pool().await;
    let pid = patient(&pool, "cols").await;
    raw_payment(&pool, "pay-cols", &pid, 12.5, "PAID", "2026-11-08 09:00:00").await;
    let rows = payment_repo::find_by_patient_id(&pool, &pid)
        .await
        .expect("with column");
    assert_eq!(rows.len(), 1);
    assert!(rows[0].updated_at.is_some());
    // Older database shape, on a fresh pool (sqlx caches prepared column lists).
    let legacy = super_pool_without_updated_at().await;
    let pid2 = patient(&legacy, "cols-legacy").await;
    raw_payment_no_updated(&legacy, "pay-legacy", &pid2, 12.5).await;
    let rows = payment_repo::find_by_patient_id(&legacy, &pid2)
        .await
        .expect("without column");
    assert_eq!(rows.len(), 1);
    assert!((rows[0].amount - 12.5).abs() < 1e-9);
    assert!(rows[0].updated_at.is_none());
}

async fn super_pool_without_updated_at() -> SqlitePool {
    let p = pool().await;
    sqlx::query("ALTER TABLE payment DROP COLUMN updated_at")
        .execute(&p)
        .await
        .unwrap();
    p
}

async fn raw_payment_no_updated(pool: &SqlitePool, id: &str, pid: &str, amount: f64) {
    sqlx::query(
        "INSERT INTO payment (id, patient_id, amount, payment_method, status) VALUES (?1, ?2, ?3, 'CASH', 'PAID')",
    )
    .bind(id)
    .bind(pid)
    .bind(amount)
    .execute(pool)
    .await
    .unwrap();
}
