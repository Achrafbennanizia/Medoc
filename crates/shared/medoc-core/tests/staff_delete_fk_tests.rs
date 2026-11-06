//! Removing a staff row must not hit SQLITE_CONSTRAINT_FOREIGNKEY (787).

use medoc_core::error::AppError;
use medoc_core::infrastructure::crypto;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::staff_repo;
use sqlx::SqlitePool;

async fn fresh_pool() -> SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    pool
}

async fn insert_staff(pool: &SqlitePool, id: &str, role: &str) {
    let hash = crypto::hash_password("TestPass42").unwrap();
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(id)
    .bind(format!("User {id}"))
    .bind(format!("{id}@practice.de"))
    .bind(&hash)
    .bind(role)
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn delete_reception_with_work_time_does_not_fk_fail() {
    let pool = fresh_pool().await;
    sqlx::query(
        "INSERT INTO work_time_session (id, staff_id, started_at, status)
         VALUES ('wt-1', 'seed-rez-001', datetime('now'), 'ENDED')",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query(
        "INSERT INTO work_time_pause_segment (id, session_id, started_at, ended_at)
         VALUES ('wt-pause-1', 'wt-1', datetime('now'), datetime('now'))",
    )
    .execute(&pool)
    .await
    .unwrap();

    staff_repo::delete(&pool, "seed-rez-001")
        .await
        .expect("delete reception");
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM staff WHERE id = 'seed-rez-001'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(n, 0);
}

#[tokio::test]
async fn delete_physician_reassigns_appointments_when_another_exists() {
    let pool = fresh_pool().await;
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .expect("drop quota");
    insert_staff(&pool, "doc-b", "PHYSICIAN").await;
    medoc_core::mvp_security::ensure_staff_quota_db_triggers(&pool)
        .await
        .expect("quota");

    staff_repo::delete(&pool, "seed-physician-001")
        .await
        .expect("delete physician");
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM appointment WHERE physician_id = 'seed-physician-001'",
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(n, 0);
    let left: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM appointment WHERE physician_id = 'doc-b'")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert!(left > 0);
}

#[tokio::test]
async fn delete_last_physician_with_appointments_is_blocked() {
    let pool = fresh_pool().await;
    let err = staff_repo::delete(&pool, "seed-physician-001")
        .await
        .expect_err("must block last clinician");
    assert!(matches!(err, AppError::Validation(_)));
}
