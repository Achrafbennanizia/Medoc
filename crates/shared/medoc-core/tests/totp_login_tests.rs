//! Password login while two-factor is off. Enrollment gates live in `totp_tests.rs`
//! and stay ignored until `TOTP_2FA_ENABLED` is turned back on.

use medoc_core::application::auth_service::{authenticate, LoginRequest};
use medoc_core::infrastructure::crypto;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_core::infrastructure::database::{device_session_repo, staff_repo};
use medoc_core::infrastructure::totp;

async fn pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .expect("quota");
    pool
}

#[tokio::test]
async fn enrolled_physician_signs_in_without_a_code() {
    let pool = pool().await;
    let hash = crypto::hash_password("TestPass42").expect("hash");
    let (secret, _) = totp::generate_enrollment("physician@practice.test").expect("enroll");
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, totp_secret, totp_enrolled_at)
         VALUES ('doc-1', 'Dr', 'physician@practice.test', ?1, 'PHYSICIAN', ?2, datetime('now'))",
    )
    .bind(&hash)
    .bind(&secret)
    .execute(&pool)
    .await
    .expect("insert");

    let session = authenticate(
        &pool,
        &LoginRequest {
            email: "physician@practice.test".into(),
            password: "TestPass42".into(),
            totp_code: None,
        },
    )
    .await
    .expect("password login while 2FA is off");
    assert_eq!(session.role, "PHYSICIAN");
}

#[tokio::test]
async fn enrolled_physician_with_current_code_signs_in() {
    let pool = pool().await;
    let hash = crypto::hash_password("TestPass42").expect("hash");
    let (secret, _) = totp::generate_enrollment("physician@practice.test").expect("enroll");
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role, totp_secret, totp_enrolled_at)
         VALUES ('doc-1', 'Dr', 'physician@practice.test', ?1, 'PHYSICIAN', ?2, datetime('now'))",
    )
    .bind(&hash)
    .bind(&secret)
    .execute(&pool)
    .await
    .expect("insert");
    let code = totp::current_code(&secret).expect("code");
    let session = authenticate(
        &pool,
        &LoginRequest {
            email: "physician@practice.test".into(),
            password: "TestPass42".into(),
            totp_code: Some(code),
        },
    )
    .await
    .expect("login");
    assert_eq!(session.role, "PHYSICIAN");
}

#[tokio::test]
async fn unenrolled_physician_signs_in() {
    let pool = pool().await;
    let hash = crypto::hash_password("TestPass42").expect("hash");
    sqlx::query("DELETE FROM staff WHERE id = 'seed-physician-001'")
        .execute(&pool)
        .await
        .ok();
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES ('doc-unenrolled', 'Dr', 'newdoc@practice.test', ?1, 'PHYSICIAN')",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .expect("insert");

    let session = authenticate(
        &pool,
        &LoginRequest {
            email: "newdoc@practice.test".into(),
            password: "TestPass42".into(),
            totp_code: None,
        },
    )
    .await
    .expect("password login while 2FA is off");
    assert_eq!(session.email, "newdoc@practice.test");
}

#[tokio::test]
async fn password_change_bumps_the_token_and_ends_other_sessions() {
    let pool = pool().await;
    let hash = crypto::hash_password("TestPass42").expect("hash");
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES ('doc-1', 'Dr', 'physician@practice.test', ?1, 'PHYSICIAN')",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .expect("insert");
    device_session_repo::insert(&pool, "keep", "doc-1", "This desk", None, None)
        .await
        .expect("keep");
    device_session_repo::insert(&pool, "other", "doc-1", "Other desk", None, None)
        .await
        .expect("other");

    let next = crypto::hash_password("BetterPass42").expect("hash");
    staff_repo::replace_password(&pool, "doc-1", &next)
        .await
        .expect("password");
    device_session_repo::end_other_than(&pool, "doc-1", "keep")
        .await
        .expect("end");

    assert_eq!(
        staff_repo::token_version(&pool, "doc-1").await.expect("version"),
        1
    );
    let ended: Option<String> =
        sqlx::query_scalar("SELECT ended_at FROM device_session WHERE id = 'other'")
            .fetch_one(&pool)
            .await
            .expect("other row");
    let kept: Option<String> =
        sqlx::query_scalar("SELECT ended_at FROM device_session WHERE id = 'keep'")
            .fetch_one(&pool)
            .await
            .expect("keep row");
    assert!(ended.is_some());
    assert!(kept.is_none());
}
