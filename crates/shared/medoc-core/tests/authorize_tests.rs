//! Shared authorize(): idle, availability, overrides, and a medical READ audit.

use std::time::Duration;

use medoc_core::application::auth_service::{authenticate, LoginRequest};
use medoc_core::application::authorize::{authorize, Caller, IDLE_TIMEOUT};
use medoc_core::error::AppError;
use medoc_core::infrastructure::crypto;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::repos::admin::audit as audit_repo;
use medoc_core::infrastructure::database::repos::admin::device_session as device_session_repo;

async fn pool() -> sqlx::SqlitePool {
    std::env::set_var("MEDOC_AUDIT_KEY", "k9-medoc-test-audit-key-32bytes!");
    let dir = std::env::temp_dir().join("medoc-authorize-test-audit");
    let _ = std::fs::create_dir_all(&dir);
    audit_repo::init_audit_hmac_key(&dir).expect("audit key");
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    pool
}

async fn insert_staff(pool: &sqlx::SqlitePool, id: &str, role: &str, available: i32) {
    let hash = crypto::hash_password("TestPass42").expect("hash");
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, available)
         VALUES (?1, 'Auth', ?2, ?3, ?4, ?5)",
    )
    .bind(id)
    .bind(format!("{id}@practice.test"))
    .bind(hash)
    .bind(role)
    .bind(available)
    .execute(pool)
    .await
    .expect("staff");
}

#[tokio::test]
async fn unavailable_account_does_not_sign_in() {
    let pool = pool().await;
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .expect("quota");
    insert_staff(&pool, "off-1", "PHYSICIAN", 0).await;
    let err = authenticate(
        &pool,
        &LoginRequest {
            email: "off-1@practice.test".into(),
            password: "TestPass42".into(),
            totp_code: None,
        },
    )
    .await
    .expect_err("unavailable");
    assert!(matches!(err, AppError::Forbidden));
}

#[tokio::test]
async fn idle_caller_is_unauthorized() {
    let pool = pool().await;
    let err = authorize(
        &pool,
        &Caller {
            user_id: "nobody".into(),
            idle_for: Some(IDLE_TIMEOUT + Duration::from_secs(1)),
            device_session_id: None,
        },
        "ops.system",
        None,
    )
    .await
    .expect_err("idle");
    assert!(matches!(err, AppError::Unauthorized));
}

#[tokio::test]
async fn deny_override_blocks_a_physician_and_a_read_is_audited() {
    let pool = pool().await;
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .expect("quota");
    insert_staff(&pool, "doc-1", "PHYSICIAN", 1).await;
    let caller = Caller {
        user_id: "doc-1".into(),
        idle_for: None,
        device_session_id: None,
    };
    authorize(&pool, &caller, "patient.read_medical", Some("pat-1"))
        .await
        .expect("read");
    let reads: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM audit_log WHERE user_id = 'doc-1' AND action = 'READ' AND entity_id = 'pat-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("count");
    assert_eq!(reads, 1);

    sqlx::query(
        "INSERT INTO staff_permission_override (staff_id, action, effect)
         VALUES ('doc-1', 'patient.write_medical', 'DENY')",
    )
    .execute(&pool)
    .await
    .expect("override");
    let err = authorize(&pool, &caller, "patient.write_medical", None)
        .await
        .expect_err("denied");
    assert!(matches!(err, AppError::Forbidden));
}

#[tokio::test]
async fn stale_device_session_is_unauthorized() {
    let pool = pool().await;
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .expect("quota");
    insert_staff(&pool, "doc-2", "PHYSICIAN", 1).await;
    device_session_repo::insert(&pool, "sess-old", "doc-2", "Desk", None, None)
        .await
        .expect("session");
    sqlx::query(
        "UPDATE device_session SET last_seen_at = '2000-01-01 00:00:00' WHERE id = 'sess-old'",
    )
    .execute(&pool)
    .await
    .expect("age");
    let err = authorize(
        &pool,
        &Caller {
            user_id: "doc-2".into(),
            idle_for: None,
            device_session_id: Some("sess-old".into()),
        },
        "ops.system",
        None,
    )
    .await
    .expect_err("stale");
    assert!(matches!(err, AppError::Unauthorized));
}
