//! TOTP enrollment and login gate tests.

use medoc_lib::application::auth_service::{authenticate, LoginRequest};
use medoc_lib::infrastructure::database::connection::test_memory_pool;
use medoc_lib::infrastructure::database::personal_repo;
use medoc_lib::infrastructure::totp;

async fn personal_table(pool: &sqlx::SqlitePool) {
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
    .execute(pool)
    .await
    .unwrap();
}

#[tokio::test]
async fn arzt_without_totp_requires_enrollment() {
    let pool = test_memory_pool().await.expect("pool");
    personal_table(&pool).await;
    let hash = medoc_lib::infrastructure::crypto::hash_password("TestPass42").unwrap();
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('a1', 'Dr', 'arzt@praxis.de', ?1, 'ARZT')",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .unwrap();

    let err = authenticate(
        &pool,
        &LoginRequest {
            email: "arzt@praxis.de".into(),
            passwort: "TestPass42".into(),
            totp_code: None,
        },
    )
    .await
    .unwrap_err();
    assert!(matches!(
        err,
        medoc_lib::error::AppError::TotpEnrollmentRequired
    ));
}

#[tokio::test]
async fn enrolled_arzt_requires_totp_code() {
    let pool = test_memory_pool().await.expect("pool");
    personal_table(&pool).await;
    let hash = medoc_lib::infrastructure::crypto::hash_password("TestPass42").unwrap();
    let (secret, _) = totp::generate_enrollment("arzt@praxis.de").unwrap();
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle, totp_secret, totp_enrolled_at)
         VALUES ('a1', 'Dr', 'arzt@praxis.de', ?1, 'ARZT', ?2, datetime('now'))",
    )
    .bind(&hash)
    .bind(&secret)
    .execute(&pool)
    .await
    .unwrap();

    let err = authenticate(
        &pool,
        &LoginRequest {
            email: "arzt@praxis.de".into(),
            passwort: "TestPass42".into(),
            totp_code: None,
        },
    )
    .await
    .unwrap_err();
    assert!(matches!(err, medoc_lib::error::AppError::TotpRequired));
}

#[tokio::test]
async fn enrolled_arzt_logs_in_with_valid_totp() {
    let pool = test_memory_pool().await.expect("pool");
    personal_table(&pool).await;
    let hash = medoc_lib::infrastructure::crypto::hash_password("TestPass42").unwrap();
    let (secret, _) = totp::generate_enrollment("arzt@praxis.de").unwrap();
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle, totp_secret, totp_enrolled_at)
         VALUES ('a1', 'Dr', 'arzt@praxis.de', ?1, 'ARZT', ?2, datetime('now'))",
    )
    .bind(&hash)
    .bind(&secret)
    .execute(&pool)
    .await
    .unwrap();

    let totp_inst = {
        use totp_rs::{Algorithm, Secret, TOTP};
        let bytes = Secret::Encoded(secret.clone()).to_bytes().unwrap();
        TOTP::new(Algorithm::SHA1, 6, 1, 30, bytes, None, String::new()).unwrap()
    };
    let code = totp_inst.generate_current().unwrap();

    let session = authenticate(
        &pool,
        &LoginRequest {
            email: "arzt@praxis.de".into(),
            passwort: "TestPass42".into(),
            totp_code: Some(code),
        },
    )
    .await
    .expect("login");
    assert_eq!(session.rolle, "ARZT");
}

#[tokio::test]
async fn rezeption_without_totp_can_login() {
    let pool = test_memory_pool().await.expect("pool");
    personal_table(&pool).await;
    let hash = medoc_lib::infrastructure::crypto::hash_password("TestPass42").unwrap();
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('r1', 'Empfang', 'rez@praxis.de', ?1, 'REZEPTION')",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .unwrap();

    authenticate(
        &pool,
        &LoginRequest {
            email: "rez@praxis.de".into(),
            passwort: "TestPass42".into(),
            totp_code: None,
        },
    )
    .await
    .expect("login");
}

#[tokio::test]
async fn confirm_enrollment_persists() {
    let pool = test_memory_pool().await.expect("pool");
    personal_table(&pool).await;
    let hash = medoc_lib::infrastructure::crypto::hash_password("TestPass42").unwrap();
    let (secret, _) = totp::generate_enrollment("arzt@praxis.de").unwrap();
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('a1', 'Dr', 'arzt@praxis.de', ?1, 'ARZT')",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .unwrap();
    personal_repo::set_totp_pending_secret(&pool, "a1", &secret)
        .await
        .unwrap();
    let totp_inst = {
        use totp_rs::{Algorithm, Secret, TOTP};
        let bytes = Secret::Encoded(secret.clone()).to_bytes().unwrap();
        TOTP::new(Algorithm::SHA1, 6, 1, 30, bytes, None, String::new()).unwrap()
    };
    let code = totp_inst.generate_current().unwrap();
    assert!(totp::verify_code(&secret, &code).unwrap());
    personal_repo::confirm_totp_enrollment(&pool, "a1")
        .await
        .unwrap();
    let user = personal_repo::find_by_id(&pool, "a1")
        .await
        .unwrap()
        .unwrap();
    assert!(personal_repo::is_totp_enrolled(&user));
}
