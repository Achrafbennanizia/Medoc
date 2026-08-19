//! Integration tests for the v2 device-bound encrypted license envelope.
//!
//! Reuses the well-known test signing key that matches the
//! `MEDOC_VENDOR_PUBKEY=79c1662a…` value used in CI (`.github/workflows/ci.yml`
//! and existing `update_signature_tests.rs`).

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::{TimeZone, Utc};
use ed25519_dalek::{Signer, SigningKey};
use medoc_core::infrastructure::license::{
    self, encrypt_v2_for_device, verify, verify_v2_envelope, LicenseV2, VENDOR_PUBKEY,
};

const TEST_SIGNING_KEY_HEX: &str =
    "8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf";

fn signing_key() -> SigningKey {
    let mut bytes = [0u8; 32];
    for (i, chunk) in TEST_SIGNING_KEY_HEX.as_bytes().chunks(2).enumerate() {
        bytes[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
    }
    let sk = SigningKey::from_bytes(&bytes);
    assert_eq!(
        sk.verifying_key().to_bytes(),
        VENDOR_PUBKEY,
        "test signing key must match build-time VENDOR_PUBKEY"
    );
    sk
}

fn sign_inner(body_json: &str) -> String {
    let sig = signing_key().sign(body_json.as_bytes());
    let sig_b64 = STANDARD_NO_PAD.encode(sig.to_bytes());
    format!("{body_json}.{sig_b64}")
}

fn build_v2_body(device_id: &str) -> String {
    let lic = LicenseV2 {
        version: 2,
        customer_id: "practice-test-001".into(),
        edition: "PRO".into(),
        device_id: device_id.into(),
        activated_at: Utc.with_ymd_and_hms(2026, 5, 26, 10, 0, 0).unwrap(),
        max_users: 5,
        modules: vec!["dicom".into()],
        edition_features: vec!["statistics.advanced".into()],
    };
    serde_json::to_string(&lic).unwrap()
}

#[test]
fn v2_full_roundtrip_matches_device() {
    let device_id = "test-device-1";
    let body = build_v2_body(device_id);
    let signed = sign_inner(&body);
    let envelope = encrypt_v2_for_device(&signed, device_id).expect("encrypt ok");
    assert!(envelope.starts_with("v2."));

    let status = verify(&envelope, device_id);
    assert!(status.valid, "expected valid, got: {:?}", status.reason);
    let v2 = status.license_v2.expect("v2 payload present");
    assert_eq!(v2.device_id, device_id);
    assert_eq!(v2.customer_id, "practice-test-001");
    assert_eq!(v2.edition, "PRO");
    assert_eq!(status.format.as_deref(), Some("v2"));
}

#[test]
fn v2_rejects_wrong_device() {
    let body = build_v2_body("device-a");
    let signed = sign_inner(&body);
    let envelope = encrypt_v2_for_device(&signed, "device-a").expect("encrypt ok");

    // Wrong device cannot derive the decrypt key → must reject.
    let status = verify(&envelope, "device-b");
    assert!(!status.valid);
    assert!(status.license_v2.is_none());
}

#[test]
fn v2_rejects_tampered_ciphertext() {
    let device_id = "tamper-device";
    let body = build_v2_body(device_id);
    let signed = sign_inner(&body);
    let envelope = encrypt_v2_for_device(&signed, device_id).unwrap();
    let mut bytes = envelope.into_bytes();
    let last = bytes.len() - 1;
    bytes[last] ^= 0x01;
    let tampered = String::from_utf8(bytes).unwrap();
    let status = verify(&tampered, device_id);
    assert!(!status.valid);
}

#[test]
fn v2_rejects_when_inner_device_mismatch() {
    // Sign body claiming device-x but envelope encrypted to/decrypted with device-y.
    // We encrypt with device-y so decryption succeeds, but inner JSON device_id is device-x.
    let inner_body = build_v2_body("device-x");
    let signed = sign_inner(&inner_body);
    let envelope = encrypt_v2_for_device(&signed, "device-y").unwrap();
    let status = verify_v2_envelope(envelope.trim_start_matches("v2."), "device-y");
    assert!(!status.valid);
    assert!(status.reason.unwrap().contains("another device"));
}

#[test]
fn v1_legacy_still_verifies_through_dispatcher() {
    let body = serde_json::json!({
        "customer_id": "legacy",
        "edition": "BASIC",
        "issued_at": "2026-01-01T00:00:00Z",
        "expires_at": "2030-01-01T00:00:00Z",
        "max_users": 1,
        "modules": []
    })
    .to_string();
    let signed = sign_inner(&body);
    // The `verify` dispatcher should pick v1 since the token has no `v2.` prefix.
    let status = verify(&signed, "irrelevant-for-v1");
    assert!(
        status.valid,
        "v1 should remain valid, got: {:?}",
        status.reason
    );
    assert_eq!(status.format.as_deref(), Some("v1"));
    assert!(status.license.is_some());
    assert!(status.license_v2.is_none());
}

#[test]
fn v1_expired_is_rejected() {
    let body = serde_json::json!({
        "customer_id": "expired",
        "edition": "BASIC",
        "issued_at": "2020-01-01T00:00:00Z",
        "expires_at": "2021-01-01T00:00:00Z",
        "max_users": 1,
        "modules": []
    })
    .to_string();
    let signed = sign_inner(&body);
    let status = license::verify_v1(&signed);
    assert!(!status.valid);
    assert!(status.reason.as_deref().unwrap().contains("abgelaufen"));
}
