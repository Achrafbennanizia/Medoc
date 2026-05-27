//! Property-based tests for `pairing::mint_activation_token` and
//! `pairing::verify_activation_token`.
//!
//! Invariants exercised:
//!
//! 1. **Round-trip**: every well-formed `(SigningKey, ActivationTokenPayload)`
//!    pair round-trips through mint → verify and returns a payload
//!    equal-by-fields to the original (post-JSON normalisation).
//!
//! 2. **Wrong-key rejection**: tokens minted by `key_a` MUST fail
//!    verification against `key_b`'s verifying key.
//!
//! 3. **Tampered-body rejection**: flipping any byte of the encoded body
//!    portion MUST cause `verify_activation_token` to return an error.
//!
//! 4. **Tampered-signature rejection**: flipping any byte of the signature
//!    portion MUST cause verification to error out.
//!
//! 5. **Version-mismatch rejection**: a structurally-valid token whose
//!    payload claims `version != 2` MUST be rejected (the production code
//!    validates this *after* signature verify).

use ed25519_dalek::SigningKey;
use medoc_sync::pairing::{mint_activation_token, verify_activation_token, ActivationTokenPayload};
use proptest::prelude::*;

const ACTIVATION_PREFIX: &str = "mt2.";

fn make_signing_key(seed: [u8; 32]) -> SigningKey {
    SigningKey::from_bytes(&seed)
}

#[derive(Debug, Clone)]
struct PayloadParts {
    version: u32,
    device_id: String,
    slave_label: String,
    master_device_id: String,
    allowed_actions: Vec<String>,
    issued_at: String,
    nonce: String,
}

fn payload_parts_strat() -> impl Strategy<Value = PayloadParts> {
    (
        Just(2_u32), // valid version; mismatched cases use a separate strategy
        "[a-zA-Z0-9_\\-]{1,40}",
        "[a-zA-Z0-9 _\\-]{0,40}",
        "[a-zA-Z0-9_\\-]{1,40}",
        prop::collection::vec(
            prop::sample::select(vec![
                "sync.push",
                "sync.pull",
                "sync.status",
                "pairing.peers",
            ])
            .prop_map(|s| s.to_string()),
            0..=4,
        ),
        "[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z",
        "[a-f0-9]{8,32}",
    )
        .prop_map(
            |(
                version,
                device_id,
                slave_label,
                master_device_id,
                allowed_actions,
                issued_at,
                nonce,
            )| {
                PayloadParts {
                    version,
                    device_id,
                    slave_label,
                    master_device_id,
                    allowed_actions,
                    issued_at,
                    nonce,
                }
            },
        )
}

fn build_payload(p: &PayloadParts) -> ActivationTokenPayload {
    ActivationTokenPayload {
        version: p.version,
        device_id: p.device_id.clone(),
        slave_label: p.slave_label.clone(),
        master_device_id: p.master_device_id.clone(),
        allowed_actions: p.allowed_actions.clone(),
        issued_at: p.issued_at.clone(),
        nonce: p.nonce.clone(),
    }
}

fn key_seed_strat() -> impl Strategy<Value = [u8; 32]> {
    prop::array::uniform32(any::<u8>())
}

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 256,
        max_shrink_iters: 64,
        .. ProptestConfig::default()
    })]

    /// Invariant 1: mint → verify round-trip preserves the payload.
    #[test]
    fn mint_then_verify_preserves_payload(
        seed in key_seed_strat(),
        parts in payload_parts_strat(),
    ) {
        let sk = make_signing_key(seed);
        let payload = build_payload(&parts);

        let token = mint_activation_token(&sk, &payload).expect("mint");
        prop_assert!(token.starts_with(ACTIVATION_PREFIX));

        let decoded = verify_activation_token(&token, &sk.verifying_key())
            .expect("verify must succeed for matching key");

        prop_assert_eq!(decoded.version, payload.version);
        prop_assert_eq!(&decoded.device_id, &payload.device_id);
        prop_assert_eq!(&decoded.slave_label, &payload.slave_label);
        prop_assert_eq!(&decoded.master_device_id, &payload.master_device_id);
        prop_assert_eq!(&decoded.allowed_actions, &payload.allowed_actions);
        prop_assert_eq!(&decoded.issued_at, &payload.issued_at);
        prop_assert_eq!(&decoded.nonce, &payload.nonce);
    }

    /// Invariant 2: a token minted by key_a must NOT verify under key_b.
    #[test]
    fn token_minted_by_one_key_fails_under_another(
        seed_a in key_seed_strat(),
        seed_b in key_seed_strat(),
        parts in payload_parts_strat(),
    ) {
        prop_assume!(seed_a != seed_b);

        let sk_a = make_signing_key(seed_a);
        let sk_b = make_signing_key(seed_b);
        let payload = build_payload(&parts);

        let token = mint_activation_token(&sk_a, &payload).expect("mint");
        let result = verify_activation_token(&token, &sk_b.verifying_key());
        prop_assert!(
            result.is_err(),
            "verify with wrong key unexpectedly succeeded; seed_a={:?} seed_b={:?}", seed_a, seed_b
        );
    }

    /// Invariant 3: flipping a byte in the body half of the token
    /// (between `mt2.` and the final `.<sig>`) must cause verify to fail.
    #[test]
    fn body_byte_flip_breaks_verify(
        seed in key_seed_strat(),
        parts in payload_parts_strat(),
        flip_xor in 1u8..=255,
        flip_pick in 0usize..256,
    ) {
        let sk = make_signing_key(seed);
        let payload = build_payload(&parts);
        let token = mint_activation_token(&sk, &payload).expect("mint");

        // Split token into prefix + body + sig.
        let rest = token.strip_prefix(ACTIVATION_PREFIX).unwrap();
        let (body, sig) = rest.rsplit_once('.').unwrap();
        prop_assume!(!body.is_empty());

        let body_bytes = body.as_bytes();
        let idx = flip_pick % body_bytes.len();
        let mut tampered_body = body_bytes.to_vec();
        tampered_body[idx] ^= flip_xor;
        let Ok(tampered_body_str) = String::from_utf8(tampered_body) else {
            return Ok(());
        };
        prop_assume!(tampered_body_str != body);

        let tampered = format!("{ACTIVATION_PREFIX}{tampered_body_str}.{sig}");
        let result = verify_activation_token(&tampered, &sk.verifying_key());
        prop_assert!(
            result.is_err(),
            "tampered body verified; idx={idx} xor={flip_xor} body_len={}", body_bytes.len()
        );
    }

    /// Invariant 4: flipping a byte in the signature must cause verify to fail.
    #[test]
    fn signature_byte_flip_breaks_verify(
        seed in key_seed_strat(),
        parts in payload_parts_strat(),
        flip_xor in 1u8..=255,
        flip_pick in 0usize..256,
    ) {
        let sk = make_signing_key(seed);
        let payload = build_payload(&parts);
        let token = mint_activation_token(&sk, &payload).expect("mint");

        let rest = token.strip_prefix(ACTIVATION_PREFIX).unwrap();
        let (body, sig) = rest.rsplit_once('.').unwrap();
        prop_assume!(!sig.is_empty());

        let sig_bytes = sig.as_bytes();
        let idx = flip_pick % sig_bytes.len();
        let mut tampered_sig = sig_bytes.to_vec();
        tampered_sig[idx] ^= flip_xor;
        let Ok(tampered_sig_str) = String::from_utf8(tampered_sig) else {
            return Ok(());
        };
        prop_assume!(tampered_sig_str != sig);

        let tampered = format!("{ACTIVATION_PREFIX}{body}.{tampered_sig_str}");
        let result = verify_activation_token(&tampered, &sk.verifying_key());
        prop_assert!(
            result.is_err(),
            "tampered signature verified; idx={idx} xor={flip_xor} sig_len={}", sig_bytes.len()
        );
    }

    /// Invariant 5: a token whose payload claims `version != 2` is rejected
    /// AFTER the signature succeeds — `verify_activation_token` is strict
    /// about the version field.
    #[test]
    fn payload_with_wrong_version_is_rejected_after_signature(
        seed in key_seed_strat(),
        parts in payload_parts_strat(),
        bad_version in prop::sample::select(vec![0u32, 1, 3, 4, 100, u32::MAX]),
    ) {
        let sk = make_signing_key(seed);
        let mut payload = build_payload(&parts);
        payload.version = bad_version;

        let token = mint_activation_token(&sk, &payload).expect("mint");
        let result = verify_activation_token(&token, &sk.verifying_key());
        prop_assert!(
            result.is_err(),
            "token with version={bad_version} unexpectedly verified"
        );
    }
}
