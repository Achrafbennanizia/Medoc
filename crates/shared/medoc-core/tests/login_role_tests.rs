//! Deferred roles cannot open a session.

use medoc_core::application::auth_service::{authenticate, LoginRequest};
use medoc_core::error::AppError;
use medoc_core::infrastructure::crypto;
use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};

#[tokio::test]
async fn tax_advisor_password_does_not_open_a_session() {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrate");
    medoc_core::mvp_security::drop_staff_quota_db_triggers(&pool)
        .await
        .expect("quota");
    let hash = crypto::hash_password("TestPass42").expect("hash");
    sqlx::query(
        "INSERT INTO staff (id, name, email, password_hash, role)
         VALUES ('tax-1', 'Tax', 'tax@practice.test', ?1, 'TAX_ADVISOR')",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .expect("insert");

    let err = authenticate(
        &pool,
        &LoginRequest {
            email: "tax@practice.test".into(),
            password: "TestPass42".into(),
            totp_code: None,
        },
    )
    .await
    .expect_err("deferred role");
    assert!(matches!(err, AppError::Forbidden));
}
