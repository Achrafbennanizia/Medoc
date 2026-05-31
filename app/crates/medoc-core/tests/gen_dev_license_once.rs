//! One-off helper: prints dev license tokens (CI test signing key).
use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::{TimeZone, Utc};
use ed25519_dalek::{Signer, SigningKey};
use medoc_core::infrastructure::license::{encrypt_v2_for_device, LicenseV2, VENDOR_PUBKEY};
use std::path::PathBuf;

const TEST_SIGNING_KEY_HEX: &str =
    "8762be1a9a0963f36d98d47c0de6a73a0124b77d3268c170365824a6045d2fbf";

fn signing_key() -> SigningKey {
    let mut sk_bytes = [0u8; 32];
    for (i, chunk) in TEST_SIGNING_KEY_HEX.as_bytes().chunks(2).enumerate() {
        sk_bytes[i] = u8::from_str_radix(std::str::from_utf8(chunk).unwrap(), 16).unwrap();
    }
    let sk = SigningKey::from_bytes(&sk_bytes);
    assert_eq!(sk.verifying_key().to_bytes(), VENDOR_PUBKEY);
    sk
}

fn sign_json(body: &str) -> String {
    let sig = signing_key().sign(body.as_bytes());
    format!("{}.{}", body, STANDARD_NO_PAD.encode(sig.to_bytes()))
}

fn local_device_id() -> String {
    if let Ok(id) = std::env::var("MEDOC_DEVICE_ID") {
        if !id.trim().is_empty() {
            return id.trim().to_string();
        }
    }
    let path = dirs::home_dir()
        .expect("home")
        .join("Library/Application Support/de.medoc.app/lan-instance-id.txt");
    std::fs::read_to_string(path)
        .expect("lan-instance-id.txt")
        .trim()
        .to_string()
}

/// Manual helper — prints license tokens for the local device. Not part of CI.
#[test]
#[ignore = "manual dev helper: set MEDOC_DEVICE_ID or install MeDoc locally, then run with --ignored"]
fn print_dev_licenses() {
    let device_id = local_device_id();
    let lic = LicenseV2 {
        version: 2,
        customer_id: "dev-local".into(),
        edition: "PRO".into(),
        device_id: device_id.clone(),
        activated_at: Utc.with_ymd_and_hms(2026, 5, 28, 12, 0, 0).unwrap(),
        max_users: 99,
        modules: vec!["dicom".into()],
        edition_features: vec!["statistik.advanced".into()],
    };
    let v2_body = serde_json::to_string(&lic).unwrap();
    let v2_signed = sign_json(&v2_body);
    let v2_token = encrypt_v2_for_device(&v2_signed, &device_id).expect("encrypt");

    let v1_body = serde_json::json!({
        "customer_id": "dev-local",
        "edition": "PRO",
        "issued_at": "2026-01-01T00:00:00Z",
        "expires_at": "2036-01-01T00:00:00Z",
        "max_users": 99,
        "modules": ["dicom"]
    })
    .to_string();
    let v1_token = sign_json(&v1_body);

    println!(
        "\n--- DEVICE_ID (v2 binding) ---\n{device_id}\n\n--- V2 LICENSE (preferred) ---\n{v2_token}\n\n--- V1 LICENSE (legacy, any device) ---\n{v1_token}\n"
    );
    let _app_dir: PathBuf = dirs::home_dir()
        .unwrap()
        .join("Library/Application Support/de.medoc.app");
}
