//! Session mint audit — `authenticate` is the sole login session issuer.

use medoc_lib::application::auth_service::{authenticate, LoginRequest};
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};

#[tokio::test]
async fn authenticate_succeeds_for_enrolled_physician_with_totp() {
    const {
        assert!(
            !medoc_lib::application::mvp_security::TOTP_2FA_ENABLED,
            "TOTP stays off until the deferred security checklist"
        );
    }

    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");

    let hash = medoc_lib::infrastructure::crypto::hash_password("SecurePass42").unwrap();
    let updated = sqlx::query(
        "UPDATE staff SET email = 'physician@practice.de', password_hash = ?1, name = 'Dr. Test'
         WHERE id = 'seed-physician-001'",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .expect("update seed physician");
    assert_eq!(updated.rows_affected(), 1, "expected seeded physician row");

    let session = authenticate(
        &pool,
        &LoginRequest {
            email: "physician@practice.de".into(),
            password: "SecurePass42".into(),
            totp_code: Some("1234".into()),
        },
    )
    .await
    .expect("login with TOTP");

    assert_eq!(session.email, "physician@practice.de");
    assert_eq!(session.role, "PHYSICIAN");
    assert!(!session.user_id.is_empty());
}
