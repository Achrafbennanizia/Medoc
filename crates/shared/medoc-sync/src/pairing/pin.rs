//! Four-digit out-of-band confirmation for pairing (Geräteverbund + legacy HTTP).

use hmac::{Hmac, Mac};
use rand::Rng;
use sha2::Sha256;
use subtle::ConstantTimeEq;

use crate::verbund::crypto::sas::{derive_sas_from_transcript, SAS_LEN};

type HmacSha256 = Hmac<Sha256>;

pub const CONFIRM_PIN_LEN: usize = SAS_LEN;
pub const CONFIRM_PIN_TTL_SECS: i64 = 600;
pub const CONFIRM_PIN_MAX_ATTEMPTS: i32 = 5;

/// Derive SAS from Noise handshake transcript (preferred for Geräteverbund).
#[allow(dead_code)] // wired when Noise join path uses transcript-derived SAS (Geräteverbund phase 5)
pub fn generate_confirm_pin_from_transcript(transcript: &[u8]) -> String {
    derive_sas_from_transcript(transcript)
}

/// Legacy random PIN for HTTP pairing until Noise cutover.
pub fn generate_confirm_pin_random() -> String {
    let n: u16 = rand::thread_rng().gen_range(0..10_000);
    format!("{n:04}")
}

/// Generate a 4-digit confirmation code. Uses transcript when provided (Geräteverbund).
pub fn generate_confirm_pin() -> String {
    generate_confirm_pin_random()
}

/// Geräteverbund path: always derive from handshake transcript.
#[allow(dead_code)] // wired when Noise join path uses transcript-derived SAS (Geräteverbund phase 5)
pub fn generate_confirm_pin_for_verbund(transcript: &[u8]) -> String {
    generate_confirm_pin_from_transcript(transcript)
}

pub fn normalise_pin_input(raw: &str) -> Option<String> {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != CONFIRM_PIN_LEN {
        return None;
    }
    Some(digits)
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// HMAC-SHA256 hex digest of `(request_id, pin)` keyed by master Ed25519 seed bytes.
pub fn hash_confirm_pin(request_id: &str, pin: &str, master_signing_seed: &[u8]) -> String {
    let mut mac = HmacSha256::new_from_slice(master_signing_seed).expect("HMAC key length");
    mac.update(request_id.as_bytes());
    mac.update(b"|");
    mac.update(pin.as_bytes());
    hex_encode(&mac.finalize().into_bytes())
}

pub fn verify_confirm_pin(
    request_id: &str,
    pin: &str,
    expected_hex: &str,
    master_signing_seed: &[u8],
) -> bool {
    let computed = hash_confirm_pin(request_id, pin, master_signing_seed);
    computed.as_bytes().ct_eq(expected_hex.as_bytes()).into()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pin_normalisation_and_verify() {
        let seed = b"test-seed-32-bytes-long-enough!!";
        let pin = "4829";
        let hash = hash_confirm_pin("req-1", pin, seed);
        assert!(verify_confirm_pin("req-1", pin, &hash, seed));
        assert!(!verify_confirm_pin("req-1", "0000", &hash, seed));
    }
}
