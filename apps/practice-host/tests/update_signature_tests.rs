//! Update manifest Ed25519 signature verification (NFA-UPD).

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use ed25519_dalek::{Signer, SigningKey};
use medoc_lib::infrastructure::license::VENDOR_PUBKEY;
use medoc_lib::infrastructure::update::{self, UpdateInfo, UpdateStatus};

/// Test-only signing key matching `MEDOC_VENDOR_PUBKEY` in CI (see `.github/workflows/ci.yml`).
const TEST_SIGNING_KEY_HEX: &str =
    "8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf";

fn test_signing_key() -> SigningKey {
    let mut bytes = [0u8; 32];
    for (i, chunk) in TEST_SIGNING_KEY_HEX.as_bytes().chunks(2).enumerate() {
        bytes[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
    }
    let sk = SigningKey::from_bytes(&bytes);
    assert_eq!(sk.verifying_key().to_bytes(), VENDOR_PUBKEY);
    sk
}

fn sign_update(info: &UpdateInfo) -> String {
    let payload = format!("{}|{}|{}", info.version, info.url, info.min_supported);
    let sig = test_signing_key().sign(payload.as_bytes());
    STANDARD_NO_PAD.encode(sig.to_bytes())
}

fn sample_info() -> UpdateInfo {
    UpdateInfo {
        version: "99.0.0".into(),
        url: "https://updates.example/medoc-99.pkg".into(),
        notes: "test".into(),
        min_supported: "0.1.0".into(),
        signature: String::new(),
    }
}

#[test]
fn valid_signature_allows_available_status() {
    let mut info = sample_info();
    info.signature = sign_update(&info);
    match update::evaluate(info) {
        UpdateStatus::Available { .. } => {}
        other => panic!("expected Available, got {other:?}"),
    }
}

#[test]
fn invalid_signature_returns_error() {
    let mut info = sample_info();
    info.signature = sign_update(&info);
    info.signature =
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=="
            .into();
    match update::evaluate(info) {
        UpdateStatus::Error { message } => assert_eq!(message, "Invalid signature"),
        other => panic!("expected Error, got {other:?}"),
    }
}

#[test]
fn missing_signature_returns_error() {
    let info = sample_info();
    match update::evaluate(info) {
        UpdateStatus::Error { message } => assert_eq!(message, "Invalid signature"),
        other => panic!("expected Error, got {other:?}"),
    }
}

#[test]
fn tampered_payload_rejects_signature() {
    let mut info = sample_info();
    info.signature = sign_update(&info);
    info.url = "https://evil.example/trojan.pkg".into();
    match update::evaluate(info) {
        UpdateStatus::Error { message } => assert_eq!(message, "Invalid signature"),
        other => panic!("expected Error, got {other:?}"),
    }
}
