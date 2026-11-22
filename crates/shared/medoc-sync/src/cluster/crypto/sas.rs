//! Short Authentication String — 4 digits derived from handshake transcript.

use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

use medoc_core::error::AppError;

type HmacSha256 = Hmac<Sha256>;

/// Six digits: one guess in 1,000,000 (was four: 1 in 10,000). Both devices derive it from the
/// handshake, so main and replica must run the same version to pair.
pub const SAS_LEN: usize = 6;
const SAS_MODULUS: u32 = 1_000_000;

/// Decode a stored handshake. Writers do not share one alphabet, so the four
/// standard engines are tried in order. An empty string is `None`. A decode
/// that yields no bytes is kept only when every alphabet that accepts the
/// input is empty.
pub fn decode_handshake_transcript(raw: &str) -> Option<Vec<u8>> {
    use base64::engine::general_purpose::{STANDARD, STANDARD_NO_PAD, URL_SAFE, URL_SAFE_NO_PAD};
    use base64::Engine;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let mut blank = None;
    for engine in [&STANDARD, &STANDARD_NO_PAD, &URL_SAFE, &URL_SAFE_NO_PAD] {
        if let Ok(bytes) = engine.decode(trimmed) {
            if !bytes.is_empty() {
                return Some(bytes);
            }
            blank.get_or_insert(bytes);
        }
    }
    blank
}

/// Derive a 4-digit SAS from the Noise handshake transcript hash (channel-bound).
pub fn derive_sas_from_transcript(transcript: &[u8]) -> String {
    let digest = Sha256::digest(transcript);
    let n = u32::from_be_bytes([digest[0], digest[1], digest[2], digest[3]]) % SAS_MODULUS;
    format!("{n:0width$}", width = SAS_LEN)
}

/// First 8 bytes of SHA-256 as hex (logs only — never the raw handshake).
pub fn transcript_sha_prefix(transcript: &[u8]) -> String {
    let digest = Sha256::digest(transcript);
    digest.iter().take(8).map(|b| format!("{b:02x}")).collect()
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
    if computed.len() != expected_hash.len() {
        return false;
    }
    computed.ct_eq(expected_hash).into()
}

pub fn normalise_sas_input(raw: &str) -> Option<String> {
    let digits: String = raw.chars().filter_map(ascii_digit).collect();
    if digits.len() != SAS_LEN {
        return None;
    }
    Some(digits)
}

fn ascii_digit(c: char) -> Option<char> {
    match c {
        '0'..='9' => Some(c),
        '\u{0660}'..='\u{0669}' => Some(char::from(b'0' + (u32::from(c) - 0x0660) as u8)),
        '\u{06F0}'..='\u{06F9}' => Some(char::from(b'0' + (u32::from(c) - 0x06F0) as u8)),
        _ => None,
    }
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
        assert_eq!(a.len(), SAS_LEN);
        assert!(a.chars().all(|c| c.is_ascii_digit()));
    }

    #[test]
    fn transcript_sha_prefix_is_stable_hex() {
        let p = transcript_sha_prefix(b"noise-xx");
        assert_eq!(p.len(), 16);
        assert!(p.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(p, transcript_sha_prefix(b"noise-xx"));
    }

    #[test]
    fn sas_hash_roundtrip() {
        let key = b"test-hmac-key-32-bytes-long!!!!!";
        let hash = hash_sas("sess-1", "482913", key);
        assert!(verify_sas("sess-1", "482913", &hash, key));
        assert!(!verify_sas("sess-1", "000000", &hash, key));
    }

    #[test]
    fn sas_is_six_digits_and_rejects_the_old_length() {
        let sas = derive_sas_from_transcript(b"noise-xx");
        assert_eq!(sas.len(), 6);
        assert!(sas.chars().all(|c| c.is_ascii_digit()));
        assert_eq!(normalise_sas_input("4829"), None);
    }

    #[test]
    fn sas_input_accepts_eastern_arabic_digits() {
        assert_eq!(normalise_sas_input("٤٨٢٩١٣").as_deref(), Some("482913"));
        assert_eq!(normalise_sas_input("۴۸۲۹۱۳").as_deref(), Some("482913"));
    }
}
