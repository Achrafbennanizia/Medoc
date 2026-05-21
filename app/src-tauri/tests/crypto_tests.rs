// Integration tests for security-critical primitives.
// Run with: cargo test --manifest-path src-tauri/Cargo.toml

use medoc_lib::infrastructure::crypto::{
    audit_hmac, evaluate_password_policy, hash_password, needs_rehash, validate_password_policy,
    verify_password,
};

#[test]
fn argon2_round_trip() {
    let h = hash_password("hunter2!").unwrap();
    assert!(h.starts_with("$argon2"));
    assert!(verify_password("hunter2!", &h).unwrap());
    assert!(!verify_password("wrong", &h).unwrap());
    assert!(!needs_rehash(&h));
}

#[test]
fn bcrypt_legacy_accepted_and_marked_for_rehash() {
    // bcrypt cost 4 for fast test execution
    let legacy = bcrypt::hash("legacy-pw", 4).unwrap();
    assert!(verify_password("legacy-pw", &legacy).unwrap());
    assert!(!verify_password("nope", &legacy).unwrap());
    assert!(needs_rehash(&legacy));
}

#[test]
fn hmac_is_deterministic_and_keyed() {
    let key = b"shared-secret";
    let a = audit_hmac(key, "row-1").unwrap();
    let b = audit_hmac(key, "row-1").unwrap();
    let c = audit_hmac(b"different", "row-1").unwrap();
    assert_eq!(a, b);
    assert_ne!(a, c);
    assert_eq!(a.len(), 64); // hex-encoded SHA-256
}

#[test]
fn password_policy_enforces_length_and_classes() {
    assert!(!evaluate_password_policy("Short1a").valid);
    assert!(evaluate_password_policy("SecurePass42").valid);
    assert!(validate_password_policy("SecurePass42").is_ok());
    assert!(validate_password_policy("onlylowercase12").is_err());
}

#[tokio::test]
async fn login_rehashes_legacy_bcrypt_to_argon2() {
    use medoc_lib::application::auth_service::{authenticate, LoginRequest};
    use medoc_lib::infrastructure::database::connection::test_memory_pool;

    let pool = test_memory_pool().await.expect("pool");
    sqlx::query(
        "CREATE TABLE personal (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            passwort_hash TEXT NOT NULL,
            rolle TEXT NOT NULL,
            taetigkeitsbereich TEXT,
            fachrichtung TEXT,
            telefon TEXT,
            verfuegbar INTEGER NOT NULL DEFAULT 1,
            totp_secret TEXT,
            totp_enrolled_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(&pool)
    .await
    .unwrap();
    let legacy = bcrypt::hash("legacy-login-pw", 4).unwrap();
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('u1', 'Test', 'legacy@praxis.de', ?1, 'REZEPTION')",
    )
    .bind(&legacy)
    .execute(&pool)
    .await
    .unwrap();

    authenticate(
        &pool,
        &LoginRequest {
            email: "legacy@praxis.de".into(),
            passwort: "legacy-login-pw".into(),
            totp_code: None,
        },
    )
    .await
    .expect("login");

    let row: (String,) =
        sqlx::query_as("SELECT passwort_hash FROM personal WHERE id = 'u1'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert!(row.0.starts_with("$argon2"), "expected Argon2 upgrade");
}
