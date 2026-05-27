//! Negative-path coverage for the master license gate on LAN HTTP routes.
//!
//! `master_license::require_master_license` is called from:
//! - `sync_http::sync_push` (line 48), `sync_pull` (line 86), `sync_status` (line 101)
//! - `pairing_http::submit_request` (line 106), `decide` (line 175), `revoke` (line 198)
//!
//! Envelope-level negative paths (tampered ciphertext, wrong device, inner
//! mismatch) are already covered in `medoc-core/tests/license_v2_tests.rs`.
//! This file covers the **HTTP gate** behaviour when those negatives reach
//! a master that's serving requests.

use axum::http::StatusCode;
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::{TimeZone, Utc};
use ed25519_dalek::{Signer, SigningKey};
use medoc_core::infrastructure::database::{app_kv_repo, connection};
use medoc_core::infrastructure::license::{encrypt_v2_for_device, LicenseV2, VENDOR_PUBKEY};
use medoc_core::infrastructure::license_repo;
use medoc_e2e::harness::{ensure_e2e_env, slave_pubkey_b64, slave_signing_key, LanHarness};
use std::sync::{Mutex, OnceLock};

/// All tests in this file mutate the process-wide `MEDOC_SKIP_MASTER_LICENSE`
/// env var (either setting or removing it). cargo-test runs tests in
/// parallel by default, so we serialize them under a shared mutex to avoid
/// flakes when one test removes the var while another expects it set.
fn env_guard() -> &'static Mutex<()> {
    static G: OnceLock<Mutex<()>> = OnceLock::new();
    G.get_or_init(|| Mutex::new(()))
}

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

/// Build a valid envelope for `device_id` (helper for happy-path setup).
fn valid_envelope_for(device_id: &str) -> String {
    let lic = LicenseV2 {
        version: 2,
        customer_id: "license-gate-test".into(),
        edition: "PRO".into(),
        device_id: device_id.into(),
        activated_at: Utc.with_ymd_and_hms(2026, 5, 27, 12, 0, 0).unwrap(),
        max_users: 5,
        modules: vec![],
        edition_features: vec![],
    };
    let body = serde_json::to_string(&lic).unwrap();
    let sig = vendor_signing_key().sign(body.as_bytes());
    let signed = format!("{body}.{}", STANDARD_NO_PAD.encode(sig.to_bytes()));
    encrypt_v2_for_device(&signed, device_id).expect("encrypt")
}

/// Construct an unlicensed master in MASTER role; the gate must reject sync
/// and pairing routes with 403.
async fn unlicensed_master_harness() -> LanHarness {
    ensure_e2e_env();
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let pool = connection::test_memory_pool().await.expect("pool");
    connection::run_migrations(&pool).await.expect("migrate");
    medoc_sync::repo::ensure_local_device(&pool, "Unlicensed Master")
        .await
        .expect("device");
    // Default deployment is `practice_desktop` which `acts_as_sync_master`
    // returns true for — so the gate engages without any extra app_kv setup.
    LanHarness::from_pool(pool).await
}

/// Construct a master whose stored license envelope is corrupted (last byte
/// flipped). Verify must reject; gate must 403.
async fn tampered_license_master_harness() -> LanHarness {
    ensure_e2e_env();
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let pool = connection::test_memory_pool().await.expect("pool");
    connection::run_migrations(&pool).await.expect("migrate");
    let device = medoc_sync::repo::ensure_local_device(&pool, "Tampered Master")
        .await
        .expect("device");
    let envelope = valid_envelope_for(&device);
    let mut bytes = envelope.into_bytes();
    let last = bytes.len() - 1;
    bytes[last] ^= 0x01;
    let tampered = String::from_utf8(bytes).expect("utf8");
    license_repo::store_v2(&pool, &tampered)
        .await
        .expect("store tampered");
    LanHarness::from_pool(pool).await
}

/// Construct a master whose license is bound to a DIFFERENT device id.
async fn wrong_device_license_master_harness() -> LanHarness {
    ensure_e2e_env();
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let pool = connection::test_memory_pool().await.expect("pool");
    connection::run_migrations(&pool).await.expect("migrate");
    let _device = medoc_sync::repo::ensure_local_device(&pool, "Wrong-Device Master")
        .await
        .expect("device");
    // License bound to some OTHER device id.
    let envelope = valid_envelope_for("some-other-device-id");
    license_repo::store_v2(&pool, &envelope)
        .await
        .expect("store wrong-device");
    LanHarness::from_pool(pool).await
}

#[tokio::test]
async fn unlicensed_master_rejects_sync_status_with_403() {
    let _g = env_guard().lock().unwrap();
    let mut lan = unlicensed_master_harness().await;
    let jwt = lan.login_ops_jwt().await;
    let (status, _) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&jwt))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn unlicensed_master_rejects_pairing_decide_with_403() {
    let _g = env_guard().lock().unwrap();
    let mut lan = unlicensed_master_harness().await;
    let jwt = lan.login_ops_jwt().await;
    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/pairing/decide/00000000-0000-0000-0000-000000000000",
            Some(&serde_json::json!({ "accept": true })),
            Some(&jwt),
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn unlicensed_master_rejects_pairing_submit_with_403() {
    let _g = env_guard().lock().unwrap();
    let mut lan = unlicensed_master_harness().await;
    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": "unlicensed-test-replica",
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(77)),
                "slaveLabel": "Test",
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn tampered_license_master_rejects_sync_status() {
    let _g = env_guard().lock().unwrap();
    let mut lan = tampered_license_master_harness().await;
    let jwt = lan.login_ops_jwt().await;
    let (status, _) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&jwt))
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn wrong_device_license_master_rejects_pairing_submit() {
    let _g = env_guard().lock().unwrap();
    let mut lan = wrong_device_license_master_harness().await;
    let (status, _) = lan
        .json(
            "POST",
            "/api/v1/pairing/request",
            Some(&serde_json::json!({
                "deviceId": "wrong-device-test-replica",
                "slavePubkey": slave_pubkey_b64(&slave_signing_key(78)),
                "slaveLabel": "Test",
            })),
            None,
        )
        .await;
    assert_eq!(status, StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn skip_enforcement_env_bypasses_gate_even_without_license() {
    // The kill-switch `MEDOC_SKIP_MASTER_LICENSE=1` is documented in
    // `master_license::skip_enforcement` for ops emergencies. Make sure
    // it actually bypasses the gate so we don't accidentally remove it.
    let _g = env_guard().lock().unwrap();
    ensure_e2e_env();
    std::env::set_var("MEDOC_SKIP_MASTER_LICENSE", "1");

    let pool = connection::test_memory_pool().await.expect("pool");
    connection::run_migrations(&pool).await.expect("migrate");
    medoc_sync::repo::ensure_local_device(&pool, "Skip-Switch Master")
        .await
        .expect("device");
    let mut lan = LanHarness::from_pool(pool).await;
    let jwt = lan.login_ops_jwt().await;

    let (status, _) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&jwt))
        .await;

    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    assert_eq!(status, StatusCode::OK, "skip-switch must bypass the gate");
}

#[tokio::test]
async fn replica_role_in_serverless_peer_does_not_require_master_license() {
    let _g = env_guard().lock().unwrap();
    ensure_e2e_env();
    std::env::remove_var("MEDOC_SKIP_MASTER_LICENSE");
    let pool = connection::test_memory_pool().await.expect("pool");
    connection::run_migrations(&pool).await.expect("migrate");
    medoc_sync::repo::ensure_local_device(&pool, "Replica No-License")
        .await
        .expect("device");
    app_kv_repo::set(
        &pool,
        "sync.deployment.v1",
        r#"{"schemaVersion":1,"mode":"serverless_peer","role":"REPLICA","masterBaseUrl":"","masterCertSha256":"","masterAccessToken":"","deviceLabel":"Replica No-License"}"#,
    )
    .await
    .expect("deployment kv");

    let mut lan = LanHarness::from_pool(pool).await;
    let jwt = lan.login_ops_jwt().await;
    let (status, _) = lan
        .json("GET", "/api/v1/sync/status", None, Some(&jwt))
        .await;
    assert_eq!(
        status,
        StatusCode::OK,
        "replica role should not require a master license"
    );
}
