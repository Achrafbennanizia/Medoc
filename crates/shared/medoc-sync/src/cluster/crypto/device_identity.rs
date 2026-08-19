//! Per-install Ed25519 device identity (cluster layer, separate from user auth).

use ed25519_dalek::{SigningKey, VerifyingKey};
use medoc_core::error::AppError;
use medoc_core::infrastructure::secret_store;
use sha2::{Digest, Sha256};
const DEVICE_KEY_ACCOUNT: &str = "cluster-device-signing-key";

/// Loaded device identity (private key zeroized on drop).
pub struct DeviceIdentity {
    signing_key: SigningKey,
    pub fingerprint: String,
    pub pubkey_bytes: [u8; 32],
}

impl DeviceIdentity {
    pub fn load_or_create() -> Result<Self, AppError> {
        if let Ok(env) = std::env::var("MEDOC_CLUSTER_DEVICE_SECRET") {
            return Self::from_seed_hex(env.trim());
        }
        let bytes = secret_store::load_or_create_bytes(DEVICE_KEY_ACCOUNT, None, 32)?;
        Self::from_seed_bytes(&bytes)
    }

    /// Load identity when already provisioned; does not mint a throwaway key.
    pub fn try_load() -> Result<Option<Self>, AppError> {
        if let Ok(env) = std::env::var("MEDOC_CLUSTER_DEVICE_SECRET") {
            return Ok(Some(Self::from_seed_hex(env.trim())?));
        }
        match secret_store::load_bytes_if_exists(DEVICE_KEY_ACCOUNT)? {
            Some(bytes) => Ok(Some(Self::from_seed_bytes(&bytes)?)),
            None => Ok(None),
        }
    }

    /// One-time import from owner activation manifest (32-byte ed25519 seed).
    pub fn import_seed(seed: [u8; 32]) -> Result<Self, AppError> {
        secret_store::store_bytes_replace(DEVICE_KEY_ACCOUNT, &seed)?;
        Self::from_seed_bytes(&seed)
    }

    fn from_seed_hex(hex: &str) -> Result<Self, AppError> {
        if hex.len() != 64 {
            return Err(AppError::Validation(
                "MEDOC_CLUSTER_DEVICE_SECRET must be 64 hex chars".into(),
            ));
        }
        let mut out = [0u8; 32];
        for (i, chunk) in hex.as_bytes().chunks(2).enumerate() {
            let pair = std::str::from_utf8(chunk)
                .map_err(|e| AppError::Validation(format!("device secret utf8: {e}")))?;
            out[i] = u8::from_str_radix(pair, 16)
                .map_err(|e| AppError::Validation(format!("device secret hex: {e}")))?;
        }
        Self::from_seed_bytes(&out)
    }

    fn from_seed_bytes(seed: &[u8]) -> Result<Self, AppError> {
        if seed.len() != 32 {
            return Err(AppError::Internal(format!(
                "device signing key must be 32 bytes (got {})",
                seed.len()
            )));
        }
        let mut arr = [0u8; 32];
        arr.copy_from_slice(seed);
        let signing_key = SigningKey::from_bytes(&arr);
        let pubkey_bytes = signing_key.verifying_key().to_bytes();
        let fingerprint = fingerprint_from_pubkey(&pubkey_bytes);
        Ok(Self {
            signing_key,
            fingerprint,
            pubkey_bytes,
        })
    }

    pub fn signing_key(&self) -> &SigningKey {
        &self.signing_key
    }

    pub fn verifying_key(&self) -> VerifyingKey {
        self.signing_key.verifying_key()
    }
}

/// `base32(sha256(pubkey))` without padding (RFC 4648 alphabet).
pub fn fingerprint_from_pubkey(pubkey: &[u8; 32]) -> String {
    let hash = Sha256::digest(pubkey);
    base32_nopad(&hash)
}

fn base32_nopad(data: &[u8]) -> String {
    const ALPHABET: &[u8; 32] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let mut out = String::new();
    let mut buffer = 0u64;
    let mut bits = 0u32;
    for &byte in data {
        buffer = (buffer << 8) | u64::from(byte);
        bits += 8;
        while bits >= 5 {
            bits -= 5;
            let idx = ((buffer >> bits) & 0x1f) as usize;
            out.push(ALPHABET[idx] as char);
        }
    }
    if bits > 0 {
        let idx = ((buffer << (5 - bits)) & 0x1f) as usize;
        out.push(ALPHABET[idx] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fingerprint_is_deterministic() {
        let pk = [7u8; 32];
        let a = fingerprint_from_pubkey(&pk);
        let b = fingerprint_from_pubkey(&pk);
        assert_eq!(a, b);
        assert!(!a.is_empty());
    }

    #[test]
    fn device_identity_from_env() {
        std::env::set_var(
            "MEDOC_CLUSTER_DEVICE_SECRET",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        );
        let id = DeviceIdentity::load_or_create().expect("identity");
        assert_eq!(id.pubkey_bytes.len(), 32);
        std::env::remove_var("MEDOC_CLUSTER_DEVICE_SECRET");
    }
}
