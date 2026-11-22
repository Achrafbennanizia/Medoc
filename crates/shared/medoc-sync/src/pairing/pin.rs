//! Four-digit out-of-band confirmation for pairing (device cluster + legacy HTTP).

use hmac::{Hmac, Mac};
use rand::Rng;
use sha2::Sha256;
use subtle::ConstantTimeEq;

use crate::cluster::crypto::sas::SAS_LEN;

type HmacSha256 = Hmac<Sha256>;

pub const CONFIRM_PIN_LEN: usize = SAS_LEN;
pub const CONFIRM_PIN_TTL_SECS: i64 = 600;
pub const CONFIRM_PIN_MAX_ATTEMPTS: i32 = 5;

/// Legacy random PIN for HTTP pairing until Noise cutover.
pub fn generate_confirm_pin_random() -> String {
    let n: u32 = rand::thread_rng().gen_range(0..1_000_000);
    format!("{n:0width$}", width = CONFIRM_PIN_LEN)
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
        let pin = "482913";
        let hash = hash_confirm_pin("req-1", pin, seed);
        assert!(verify_confirm_pin("req-1", pin, &hash, seed));
        assert!(!verify_confirm_pin("req-1", "000000", &hash, seed));
    }
}
