//! Per-install Ed25519 device identity (cluster layer, separate from user auth).

use std::sync::Mutex;

use ed25519_dalek::{Signature, Signer, SigningKey, VerifyingKey};
use medoc_core::error::AppError;
use medoc_core::infrastructure::secret_store;
use sha2::{Digest, Sha256};
const DEVICE_KEY_ACCOUNT: &str = "cluster-device-signing-key";

/// Keychain reads on macOS can miss an entry that this process just wrote and
/// then `load_or_create` mints a second key. Join and SAS must be the same key,
/// so the first successful load is kept for the life of the process.
fn seed_cache() -> &'static Mutex<Vec<(String, [u8; 32])>> {
    static CACHE: Mutex<Vec<(String, [u8; 32])>> = Mutex::new(Vec::new());
    &CACHE
}

fn cached_seed(account: &str) -> Option<[u8; 32]> {
    let guard = seed_cache().lock().ok()?;
    guard
        .iter()
        .find(|(name, _)| name == account)
        .map(|(_, seed)| *seed)
}

fn remember_seed(account: &str, seed: &[u8]) {
    let Ok(seed) = <[u8; 32]>::try_from(seed) else {
        return;
    };
    let Ok(mut guard) = seed_cache().lock() else {
        return;
    };
    if let Some(slot) = guard.iter_mut().find(|(name, _)| name == account) {
        slot.1 = seed;
    } else {
        guard.push((account.to_string(), seed));
    }
}

/// Drop the in-process key. Called when the device keychain entry is wiped.
pub fn forget_cached_device_identity() {
    if let Ok(mut guard) = seed_cache().lock() {
        guard.clear();
    }
}

fn cluster_device_key_account() -> String {
    match std::env::var("MEDOC_INSTANCE") {
        Ok(n) if !n.is_empty() && n != "1" => format!("{DEVICE_KEY_ACCOUNT}.{n}"),
        _ => DEVICE_KEY_ACCOUNT.to_string(),
    }
}

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
        let account = cluster_device_key_account();
        if let Some(seed) = cached_seed(&account) {
            return Self::from_seed_bytes(&seed);
        }
        let bytes = secret_store::load_or_create_bytes(&account, None, 32)?;
        remember_seed(&account, &bytes);
        Self::from_seed_bytes(&bytes)
    }

    /// Load identity when already provisioned; does not mint a throwaway key.
    pub fn try_load() -> Result<Option<Self>, AppError> {
        if let Ok(env) = std::env::var("MEDOC_CLUSTER_DEVICE_SECRET") {
            return Ok(Some(Self::from_seed_hex(env.trim())?));
        }
        let account = cluster_device_key_account();
        if let Some(seed) = cached_seed(&account) {
            return Ok(Some(Self::from_seed_bytes(&seed)?));
        }
        match secret_store::load_bytes_if_exists(&account)? {
            Some(bytes) => {
                remember_seed(&account, &bytes);
                Ok(Some(Self::from_seed_bytes(&bytes)?))
            }
            None => Ok(None),
        }
    }

    /// One-time import from owner activation manifest (32-byte ed25519 seed).
    pub fn import_seed(seed: [u8; 32]) -> Result<Self, AppError> {
        let account = cluster_device_key_account();
        secret_store::store_bytes_replace(&account, &seed)?;
        remember_seed(&account, &seed);
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

    /// Sign the current Noise session for `purpose` (proof of key possession).
    ///
    /// The Noise layer uses throw-away static keys and the device public key
    /// and fingerprint are public, so without this signature anyone on the LAN
    /// could claim any device identity. Binding the signature to the
    /// handshake transcript also stops a relay: a MITM has two different
    /// transcripts, so the signature never verifies on the other leg.
    pub fn sign_channel(&self, purpose: ChannelPurpose, transcript: &[u8]) -> Vec<u8> {
        self.signing_key
            .sign(&channel_binding_message(purpose, transcript))
            .to_bytes()
            .to_vec()
    }
}

/// What a channel signature authorises. Part of the signed message, so a
/// signature for one request cannot be replayed as another.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChannelPurpose {
    Join,
    SasConfirm,
    StaffDirectory,
    ReplicaAuth,
}

impl ChannelPurpose {
    fn label(self) -> &'static [u8] {
        match self {
            Self::Join => b"join",
            Self::SasConfirm => b"sas-confirm",
            Self::StaffDirectory => b"staff-directory",
            Self::ReplicaAuth => b"replica-auth",
        }
    }
}

const CHANNEL_SIG_DOMAIN: &[u8] = b"medoc-cluster-channel-v1";

fn channel_binding_message(purpose: ChannelPurpose, transcript: &[u8]) -> Vec<u8> {
    let mut msg = Vec::with_capacity(CHANNEL_SIG_DOMAIN.len() + 48);
    msg.extend_from_slice(CHANNEL_SIG_DOMAIN);
    msg.push(0);
    msg.extend_from_slice(purpose.label());
    msg.push(0);
    msg.extend_from_slice(&Sha256::digest(transcript));
    msg
}

/// Verify a [`DeviceIdentity::sign_channel`] signature. `false` for any
/// malformed key/signature or an empty transcript.
pub fn verify_channel_signature(
    pubkey: &[u8],
    purpose: ChannelPurpose,
    transcript: &[u8],
    signature: &[u8],
) -> bool {
    if transcript.is_empty() {
        return false;
    }
    let Ok(pk) = <[u8; 32]>::try_from(pubkey) else {
        return false;
    };
    let Ok(vk) = VerifyingKey::from_bytes(&pk) else {
        return false;
    };
    let Ok(sig) = Signature::from_slice(signature) else {
        return false;
    };
    vk.verify_strict(&channel_binding_message(purpose, transcript), &sig)
        .is_ok()
}

/// True when `fingerprint` is the identity of this 32-byte device key.
pub fn fingerprint_matches_pubkey(pubkey: &[u8], fingerprint: &str) -> bool {
    let Ok(bytes) = <[u8; 32]>::try_from(pubkey) else {
        return false;
    };
    fingerprint_from_pubkey(&bytes) == fingerprint.trim()
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
    fn channel_signature_binds_key_purpose_and_transcript() {
        let id = DeviceIdentity::from_seed_bytes(&[9u8; 32]).expect("id");
        let other = DeviceIdentity::from_seed_bytes(&[8u8; 32]).expect("other");
        let sig = id.sign_channel(ChannelPurpose::Join, b"transcript-a");
        assert!(verify_channel_signature(
            &id.pubkey_bytes,
            ChannelPurpose::Join,
            b"transcript-a",
            &sig
        ));
        assert!(!verify_channel_signature(
            &id.pubkey_bytes,
            ChannelPurpose::Join,
            b"transcript-b",
            &sig
        ));
        assert!(!verify_channel_signature(
            &id.pubkey_bytes,
            ChannelPurpose::ReplicaAuth,
            b"transcript-a",
            &sig
        ));
        assert!(!verify_channel_signature(
            &other.pubkey_bytes,
            ChannelPurpose::Join,
            b"transcript-a",
            &sig
        ));
        assert!(!verify_channel_signature(
            &id.pubkey_bytes,
            ChannelPurpose::Join,
            b"",
            &sig
        ));
        assert!(!verify_channel_signature(
            &id.pubkey_bytes,
            ChannelPurpose::Join,
            b"transcript-a",
            &[]
        ));
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
