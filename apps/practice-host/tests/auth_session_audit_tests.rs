//! Session mint audit — `authenticate` is the sole login session issuer when 2FA is off.
//!
//! Mint sites (verified):
//! - `medoc_core::application::auth_service::authenticate` — only issuer of login `Session`
//! - `commands/admin/auth.rs::login` — enriches session after `authenticate` (device_session_id)
//! - LAN HTTP — calls `authenticate` (`medoc-lan/src/http/mod.rs`)
//! - Not sessions: `KopplungSession`, `WorkTimeSession`

use medoc_lib::application::auth_service::{authenticate, LoginRequest};
use medoc_lib::application::mvp_security;
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};

#[tokio::test]
async fn authenticate_succeeds_for_arzt_without_totp_when_2fa_disabled() {
    assert!(
        !mvp_security::TOTP_2FA_ENABLED,
        "test documents intentional MVP bypass via centralized authenticate chokepoint"
    );

    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");

    // Migrations seed one ARZT account; clear it so this test can insert a
    // deterministic fixture without tripping the MVP seat-cap trigger.
    sqlx::query("DELETE FROM personal WHERE rolle = 'ARZT'")
        .execute(&pool)
        .await
        .unwrap();

    let hash = medoc_lib::infrastructure::crypto::hash_password("SecurePass42").unwrap();
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('a1', 'Dr. Test', 'arzt@praxis.de', ?1, 'ARZT')",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .unwrap();

    let session = authenticate(
        &pool,
        &LoginRequest {
            email: "arzt@praxis.de".into(),
            passwort: "SecurePass42".into(),
            totp_code: None,
        },
    )
    .await
    .expect("login without TOTP when 2FA disabled");

    assert_eq!(session.email, "arzt@praxis.de");
    assert_eq!(session.rolle, "ARZT");
    assert!(!session.user_id.is_empty());
}
