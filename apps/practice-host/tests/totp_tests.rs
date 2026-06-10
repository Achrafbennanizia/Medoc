//! TOTP enrollment and login gate tests.

use medoc_lib::application::auth_service::{authenticate, LoginRequest};
use medoc_lib::infrastructure::database::connection::{run_migrations, test_memory_pool};
use medoc_lib::infrastructure::database::personal_repo;
use medoc_lib::infrastructure::totp;

async fn migrated_pool() -> sqlx::SqlitePool {
    let pool = test_memory_pool().await.expect("pool");
    run_migrations(&pool).await.expect("migrations");
    pool
}

#[tokio::test]
async fn arzt_without_totp_requires_enrollment() {
    let pool = migrated_pool().await;
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
    let pool = migrated_pool().await;
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
    let pool = migrated_pool().await;
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
    let pool = migrated_pool().await;
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
    let pool = migrated_pool().await;
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

#[tokio::test]
async fn deactivate_totp_clears_enrolled_secret_with_valid_code() {
    let pool = migrated_pool().await;
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

    let outcome = medoc_lib::application::totp_service::deactivate_totp(&pool, "a1", Some(&code))
        .await
        .expect("deactivate");
    assert_eq!(
        outcome,
        medoc_lib::application::totp_service::TotpDeactivateResult::Deactivated
    );

    let user = personal_repo::find_by_id(&pool, "a1")
        .await
        .unwrap()
        .unwrap();
    assert!(!personal_repo::is_totp_enrolled(&user));
    assert!(user.totp_secret.is_none());

    let err = medoc_lib::application::auth_service::authenticate(
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
async fn deactivate_totp_cancels_pending_without_code() {
    let pool = migrated_pool().await;
    let hash = medoc_lib::infrastructure::crypto::hash_password("TestPass42").unwrap();
    let (secret, _) = totp::generate_enrollment("rez@praxis.de").unwrap();
    sqlx::query(
        "INSERT INTO personal (id, name, email, passwort_hash, rolle)
         VALUES ('r1', 'Empfang', 'rez@praxis.de', ?1, 'REZEPTION')",
    )
    .bind(&hash)
    .execute(&pool)
    .await
    .unwrap();
    personal_repo::set_totp_pending_secret(&pool, "r1", &secret)
        .await
        .unwrap();

    let outcome = medoc_lib::application::totp_service::deactivate_totp(&pool, "r1", None)
        .await
        .unwrap();
    assert_eq!(
        outcome,
        medoc_lib::application::totp_service::TotpDeactivateResult::CancelledPending
    );

    let user = personal_repo::find_by_id(&pool, "r1")
        .await
        .unwrap()
        .unwrap();
    assert!(user.totp_secret.is_none());
}
