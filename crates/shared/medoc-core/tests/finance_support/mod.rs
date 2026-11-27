//! Sessions, days, setup and payment helpers of the finance workflow tests (split from `finance_workflow_tests.rs`).

use super::*;

pub(super) fn session(role: &str) -> Session {
    serde_json::from_value(serde_json::json!({
        "user_id": "seed-physician-001", "name": "Dr. Test", "email": "t@example.org",
        "role": role, "permission_overrides": [], "device_session_id": null, "token_version": 0
    }))
    .expect("session")
}

pub(super) fn day(offset: i64) -> String {
    (chrono::Local::now().date_naive() + chrono::Duration::days(offset))
        .format("%Y-%m-%d")
        .to_string()
}

/// UTC timestamp at local noon of `day(offset)`, as SQLite stores it.
pub(super) fn noon_utc(offset: i64) -> String {
    let d = chrono::Local::now().date_naive() + chrono::Duration::days(offset);
    d.and_hms_opt(12, 0, 0)
        .unwrap()
        .and_local_timezone(chrono::Local)
        .unwrap()
        .with_timezone(&chrono::Utc)
        .format("%Y-%m-%d %H:%M:%S")
        .to_string()
}

pub(super) async fn setup() -> sqlx::SqlitePool {
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

pub(super) async fn pay(
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

pub(super) fn counted(cents: i64, note: Option<&str>, d: &str) -> CloseDayArgs {
    CloseDayArgs {
        as_of_date: d.into(),
        counted_cents: Some(cents),
        note: note.map(String::from),
        ..Default::default()
    }
}
