//! Session mint audit — `authenticate` is the sole login session issuer when 2FA is off.
//!
//! Mint sites (verified):
//! - `medoc_core::application::auth_service::authenticate` — only issuer of login `Session`
//! - `commands/admin/auth.rs::login` — enriches session after `authenticate` (device_session_id)
//! - LAN HTTP — calls `authenticate` (`medoc-lan/src/http/mod.rs`)
//! - Not sessions: `PairingSession`, `WorkTimeSession`

use medoc_lib::application::auth_service::{authenticate, LoginRequest};
use medoc_lib::application::mvp_security;
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};

#[tokio::test]
async fn authenticate_succeeds_for_physician_without_totp_when_2_fa_disabled() {
    assert!(
        !mvp_security::TOTP_2FA_ENABLED,
        "test documents intentional MVP bypass via centralized authenticate chokepoint"
    );

    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");

    // Migrations seed the single MVP PHYSICIAN slot — update that row instead of inserting another.
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
            totp_code: None,
        },
    )
    .await
    .expect("login without TOTP when 2FA disabled");

    assert_eq!(session.email, "physician@practice.de");
    assert_eq!(session.role, "PHYSICIAN");
    assert!(!session.user_id.is_empty());
}
