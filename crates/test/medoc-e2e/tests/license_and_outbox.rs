//! License v2 + persistence + outbox hook smoke covered in one cross-cutting e2e file.

use axum::http::StatusCode;
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::{NaiveDate, TimeZone, Utc};
use ed25519_dalek::{Signer, SigningKey};
use medoc_core::domain::entities::patient::CreatePatient;
use medoc_core::domain::enums::Sex;
use medoc_core::infrastructure::database::{app_kv_repo, connection, patient_repo};
use medoc_core::infrastructure::license::{
    encrypt_v2_for_device, verify, LicenseV2, VENDOR_PUBKEY,
};
use medoc_core::infrastructure::license_repo;
use medoc_e2e::harness::{ensure_e2e_env, LanHarness};

const TEST_SIGNING_KEY_HEX: &str =
    "8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf";

fn vendor_signing_key() -> SigningKey {
    let mut bytes = [0u8; 32];
    for (i, chunk) in TEST_SIGNING_KEY_HEX.as_bytes().chunks(2).enumerate() {
        bytes[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
    }
    let sk = SigningKey::from_bytes(&bytes);
    assert_eq!(sk.verifying_key().to_bytes(), VENDOR_PUBKEY);
    sk
}

#[tokio::test]
async fn license_v2_persisted_in_app_kv_and_verifies() {
    ensure_e2e_env();
    let pool = connection::test_memory_pool().await.expect("pool");
    connection::run_migrations(&pool).await.expect("migrate");

    let device_id = "e2e-license-device";
    let lic = LicenseV2 {
        version: 2,
        customer_id: "e2e-customer".into(),
        edition: "PRO".into(),
        device_id: device_id.into(),
        activated_at: Utc.with_ymd_and_hms(2026, 5, 26, 12, 0, 0).unwrap(),
        max_users: 5,
        modules: vec![],
        edition_features: vec![],
    };
    let body = serde_json::to_string(&lic).unwrap();
    let sig = vendor_signing_key().sign(body.as_bytes());
    let signed = format!("{body}.{}", STANDARD_NO_PAD.encode(sig.to_bytes()));
    let envelope = encrypt_v2_for_device(&signed, device_id).expect("encrypt");

    license_repo::store_v2(&pool, &envelope)
        .await
        .expect("save");
    let loaded = license_repo::load_v2(&pool)
        .await
        .expect("load")
        .expect("present");
    assert_eq!(loaded, envelope);

    let status = verify(&loaded, device_id);
    assert!(status.valid, "license should verify: {:?}", status.reason);
}

#[tokio::test]
async fn outbox_hook_emits_on_patient_create_when_serverless_peer() {
    ensure_e2e_env();
    let pool = connection::test_memory_pool().await.expect("pool");
    connection::run_migrations(&pool).await.expect("migrate");
    app_kv_repo::set(
        &pool,
        "sync.deployment.v1",
        r#"{"schemaVersion":1,"mode":"serverless_peer","role":"REPLICA","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"E2E"}"#,
    )
    .await
    .expect("deployment");

    let _patient = patient_repo::create(
        &pool,
        &CreatePatient {
            name: "E2E Patient".into(),
            date_of_birth: NaiveDate::from_ymd_opt(1985, 6, 15).unwrap(),
            sex: Sex::Male,
            insurance_number: "V-E2E-001".into(),
            phone: None,
            email: None,
            address: None,
        },
    )
    .await
    .expect("create patient");

    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM sync_outbox WHERE entity_table = 'patient'")
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(count, 1);
}

#[tokio::test]
async fn lan_practice_data_readable_with_jwt_not_activation_token() {
    let mut lan = LanHarness::new().await;
    let jwt = lan.login_ops_jwt().await;

    let (status, patients) = lan.json("GET", "/api/v1/patients", None, Some(&jwt)).await;
    assert_eq!(status, StatusCode::OK);
    assert!(patients.is_array());
}
