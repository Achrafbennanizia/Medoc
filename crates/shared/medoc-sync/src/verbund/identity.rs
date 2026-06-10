//! Device identity completeness — migrated rows without pubkey/fingerprint must re-provision.

use super::entities::Geraet;

/// True when fingerprint and 32-byte non-zero pubkey are present (Geräteverbund credential).
pub fn is_identity_complete(fingerprint: &str, pubkey: &[u8]) -> bool {
    !fingerprint.trim().is_empty() && pubkey.len() == 32 && pubkey.iter().any(|&b| b != 0)
}

impl Geraet {
    pub fn identity_complete(&self) -> bool {
        is_identity_complete(&self.fingerprint, &self.pubkey)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_fingerprint() {
        assert!(!is_identity_complete("", &[1u8; 32]));
    }

    #[test]
    fn rejects_zero_pubkey() {
        assert!(!is_identity_complete("abc", &[0u8; 32]));
    }

    #[test]
    fn accepts_valid_identity() {
        assert!(is_identity_complete("fp1", &[1u8; 32]));
    }
}
