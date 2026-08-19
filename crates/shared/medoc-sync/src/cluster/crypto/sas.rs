//! Short Authentication String — 4 digits derived from handshake transcript.

use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use medoc_core::error::AppError;

type HmacSha256 = Hmac<Sha256>;

pub const SAS_LEN: usize = 4;

/// Derive a 4-digit SAS from the Noise handshake transcript hash (channel-bound).
pub fn derive_sas_from_transcript(transcript: &[u8]) -> String {
    let digest = Sha256::digest(transcript);
    let n = u32::from_be_bytes([digest[0], digest[1], digest[2], digest[3]]) % 10_000;
    format!("{n:04}")
}

/// Store only HMAC-SHA256 of `(session_id, sas)` — never the plain SAS.
pub fn hash_sas(session_id: &str, sas: &str, key: &[u8]) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key");
    mac.update(session_id.as_bytes());
    mac.update(b"|");
    mac.update(sas.as_bytes());
    mac.finalize().into_bytes().to_vec()
}

pub fn verify_sas(session_id: &str, sas: &str, expected_hash: &[u8], key: &[u8]) -> bool {
    let computed = hash_sas(session_id, sas, key);
    computed.ct_eq(expected_hash).into()
}

pub fn normalise_sas_input(raw: &str) -> Option<String> {
    let digits: String = raw.chars().filter(|c| c.is_ascii_digit()).collect();
    if digits.len() != SAS_LEN {
        return None;
    }
    Some(digits)
}

pub fn validate_sas_match(
    session_id: &str,
    entered: &str,
    expected_hash: &[u8],
    key: &[u8],
) -> Result<(), AppError> {
    let Some(sas) = normalise_sas_input(entered) else {
        return Err(AppError::Validation("SAS must be 4 digits".into()));
    };
    if !verify_sas(session_id, &sas, expected_hash, key) {
        return Err(AppError::Validation("SAS does not match".into()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sas_deterministic_from_transcript() {
        let t = b"noise-xx-handshake-transcript-bytes";
        let a = derive_sas_from_transcript(t);
        let b = derive_sas_from_transcript(t);
        assert_eq!(a, b);
        assert_eq!(a.len(), 4);
        assert!(a.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn sas_hash_roundtrip() {
        let key = b"test-hmac-key-32-bytes-long!!!!!";
        let hash = hash_sas("sess-1", "4829", key);
        assert!(verify_sas("sess-1", "4829", &hash, key));
        assert!(!verify_sas("sess-1", "0000", &hash, key));
    }
}
