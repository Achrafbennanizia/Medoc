//! Property-based tests for the v2 license envelope.
//!
//! Invariants exercised:
//!
//! 1. **Round-trip**: `encrypt_v2_for_device(signed, dev)` → `verify(env, dev)`
//!    is valid for every well-formed `(LicenseV2, dev)` pair signed by the
//!    test vendor key, where `dev == license.device_id`.
//!
//! 2. **Wrong-device rejection**: when `dev_decrypt ≠ dev_encrypt`, the
//!    envelope must NOT verify — AES-GCM decryption fails before signature
//!    check.
//!
//! 3. **Ciphertext tamper rejection**: flipping any single byte in the
//!    envelope (after the `v2.` prefix) must cause verification to fail.
//!
//! 4. **Inner-device mismatch rejection**: when the envelope decrypts
//!    cleanly but the inner JSON's `device_id` is different from the
//!    `local_device_id` argument, `verify` must reject.
//!
//! These complement the targeted integration tests in `license_v2_tests.rs`
//! (which cover one specific case each) by running hundreds of random
//! inputs per invariant.

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::{TimeZone, Utc};
use ed25519_dalek::{Signer, SigningKey};
use medoc_core::infrastructure::license::{
    encrypt_v2_for_device, verify, verify_v2_envelope, LicenseV2, VENDOR_PUBKEY,
};
use proptest::prelude::*;

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

/// All license body fields rolled into one randomised value so we can
/// pass it directly as a proptest input without nested strategies.
#[derive(Debug, Clone)]
struct LicenseBodyParts {
    customer_id: String,
    edition: String,
    max_users: u32,
    modules: Vec<String>,
    edition_features: Vec<String>,
}

fn body_parts_strat() -> impl Strategy<Value = LicenseBodyParts> {
    (
        "[a-zA-Z0-9_\\-]{3,32}",
        prop::sample::select(vec!["FREE", "BASIC", "PRO", "ENTERPRISE"]),
        1u32..=100,
        prop::collection::vec("[a-z]{1,16}", 0..=4),
        prop::collection::vec("[a-z.]{1,32}", 0..=4),
    )
        .prop_map(
            |(customer_id, edition, max_users, modules, edition_features)| LicenseBodyParts {
                customer_id,
                edition: edition.to_string(),
                max_users,
                modules,
                edition_features,
            },
        )
}

/// Constrained strategy for `device_id`: non-empty, ASCII, 1–64 chars
/// (matches what the production code path expects post-`trim()`).
fn device_id_strat() -> impl Strategy<Value = String> {
    "[a-zA-Z0-9_\\-]{1,64}".prop_map(|s| s)
}

fn build_license(device_id: &str, parts: &LicenseBodyParts) -> LicenseV2 {
    LicenseV2 {
        version: 2,
        customer_id: parts.customer_id.clone(),
        edition: parts.edition.clone(),
        device_id: device_id.to_string(),
        activated_at: Utc.with_ymd_and_hms(2026, 5, 27, 12, 0, 0).unwrap(),
        max_users: parts.max_users,
        modules: parts.modules.clone(),
        edition_features: parts.edition_features.clone(),
        install_plan: None,
    }
}

fn sign_for(device_id: &str, parts: &LicenseBodyParts) -> String {
    let lic = build_license(device_id, parts);
    let body = serde_json::to_string(&lic).expect("serialise license");
    sign_inner(&body)
}

proptest! {
    #![proptest_config(ProptestConfig {
        // 256 cases per invariant keeps each proptest under a few seconds
        // while still giving ~1k random combinations across the four.
        cases: 256,
        max_shrink_iters: 64,
        .. ProptestConfig::default()
    })]

    /// Invariant 1: every (random license body, random device_id) round-trips
    /// through `encrypt_v2_for_device` → `verify` and returns valid.
    #[test]
    fn v2_encrypt_decrypt_roundtrip_is_always_valid(
        dev in device_id_strat(),
        parts in body_parts_strat(),
    ) {
        let signed = sign_for(&dev, &parts);
        let envelope = encrypt_v2_for_device(&signed, &dev).expect("encrypt");
        prop_assert!(envelope.starts_with("v2."));

        let status = verify(&envelope, &dev);
        prop_assert!(
            status.valid,
            "expected valid, got: {:?} for dev={dev}", status.reason
        );
        let v2 = status.license_v2.expect("v2 payload present");
        prop_assert_eq!(v2.device_id.as_str(), dev.as_str());
        prop_assert_eq!(&v2.customer_id, &parts.customer_id);
        prop_assert_eq!(v2.max_users, parts.max_users);
    }

    /// Invariant 2: a different `local_device_id` MUST cause `verify` to
    /// reject — AES-GCM cannot decrypt with a key derived from another id.
    #[test]
    fn v2_rejects_when_decrypt_device_differs_from_encrypt_device(
        dev_a in device_id_strat(),
        dev_b in device_id_strat(),
        parts in body_parts_strat(),
    ) {
        // The strategies can occasionally collide; skip those cases. We
        // also normalise via `trim` to match the production check.
        prop_assume!(dev_a.trim() != dev_b.trim());

        let signed = sign_for(&dev_a, &parts);
        let envelope = encrypt_v2_for_device(&signed, &dev_a).expect("encrypt");

        let status = verify(&envelope, &dev_b);
        prop_assert!(
            !status.valid,
            "verify must reject when decrypt device differs (dev_a={dev_a} dev_b={dev_b}); got: {:?}",
            status.reason
        );
        prop_assert!(status.license_v2.is_none());
    }

    /// Invariant 3: flipping a single byte of the envelope (post `v2.`)
    /// MUST cause verification to fail. AES-GCM authenticates the entire
    /// ciphertext (and tags any tampering); base64 boundaries also reject.
    #[test]
    fn v2_rejects_any_single_byte_flip_in_envelope(
        dev in device_id_strat(),
        parts in body_parts_strat(),
        flip_idx in 0usize..256,
        flip_xor in 1u8..=255,
    ) {
        let signed = sign_for(&dev, &parts);
        let envelope = encrypt_v2_for_device(&signed, &dev).expect("encrypt");

        let bytes = envelope.as_bytes();
        let body_start = 3; // skip `v2.` marker
        prop_assume!(bytes.len() > body_start);
        let actual_idx = body_start + (flip_idx % (bytes.len() - body_start));

        let mut tampered_bytes = bytes.to_vec();
        tampered_bytes[actual_idx] ^= flip_xor;
        let Ok(tampered) = String::from_utf8(tampered_bytes) else {
            // Flip produced non-UTF8; verify() takes &str so we can't even
            // call it. Skip this case (we're testing verify(), not the
            // input type).
            return Ok(());
        };
        prop_assume!(tampered != envelope);

        let status = verify(&tampered, &dev);
        prop_assert!(
            !status.valid,
            "tamper at byte {actual_idx} xor {flip_xor} unexpectedly verified; envelope={envelope}"
        );
    }

    /// Invariant 4: envelope decrypts cleanly (encrypted to dev_outer) but
    /// the inner JSON's `device_id` is dev_inner (mismatched). The handler
    /// must reject — AES-GCM + signature both succeed but the inner-device
    /// check fails.
    #[test]
    fn v2_rejects_inner_device_id_mismatch(
        dev_inner in device_id_strat(),
        dev_outer in device_id_strat(),
        parts in body_parts_strat(),
    ) {
        prop_assume!(dev_inner.trim() != dev_outer.trim());

        let signed = sign_for(&dev_inner, &parts);
        let envelope = encrypt_v2_for_device(&signed, &dev_outer).expect("encrypt");

        let status = verify_v2_envelope(envelope.trim_start_matches("v2."), &dev_outer);
        prop_assert!(!status.valid);
        let reason = status.reason.unwrap_or_default();
        prop_assert!(
            reason.contains("another device") || reason.contains("Could not decrypt license"),
            "expected wrong-device reason, got: {reason}"
        );
    }
}
