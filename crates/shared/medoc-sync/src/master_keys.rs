//! Master device Ed25519 keypair for signing activation tokens + peer lists.
//!
//! The **private key never leaves this device**. Replicas only ever see the
//! 32-byte public key (via `GET /api/v1/pairing/master-info` or stored in
//! `SyncDeploymentConfig::master_pubkey`).
//!
//! Storage:
//! - Private key bytes: OS keychain via `medoc-core::secret_store` with
//!   account `pairing-master-signing-key`.
//! - Optional env override for tests: `MEDOC_PAIRING_MASTER_SECRET` (hex,
//!   64 chars). Mirrors how `MEDOC_LAN_JWT_SECRET` works.
//!
//! When the keychain is unavailable (CI, sandboxed tests, …) the env
//! override is the only escape hatch — there is no plaintext file
//! fallback.

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use ed25519_dalek::{Signer, SigningKey, Verifier, VerifyingKey};
use medoc_core::error::AppError;
use medoc_core::infrastructure::secret_store;

const SECRET_ACCOUNT: &str = "pairing-master-signing-key";

/// Load (or create) the master signing key. Private bytes stay in this process.
pub fn load_or_create() -> Result<SigningKey, AppError> {
    if let Ok(env) = std::env::var("MEDOC_PAIRING_MASTER_SECRET") {
        return from_hex(env.trim());
    }
    let bytes = secret_store::load_or_create_bytes(SECRET_ACCOUNT, None, 32)?;
    if bytes.len() != 32 {
        return Err(AppError::Internal(format!(
            "Master signing key must be 32 bytes (got {})",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    Ok(SigningKey::from_bytes(&arr))
}

fn from_hex(hex: &str) -> Result<SigningKey, AppError> {
    if hex.len() != 64 {
        return Err(AppError::Validation(
            "MEDOC_PAIRING_MASTER_SECRET must be 64 hex chars (32 bytes)".into(),
        ));
    }
    let mut out = [0u8; 32];
    for (i, chunk) in hex.as_bytes().chunks(2).enumerate() {
        let pair = std::str::from_utf8(chunk)
            .map_err(|e| AppError::Validation(format!("master secret utf8: {e}")))?;
        out[i] = u8::from_str_radix(pair, 16)
            .map_err(|e| AppError::Validation(format!("master secret hex: {e}")))?;
    }
    Ok(SigningKey::from_bytes(&out))
}

/// Compact base64 (no-pad) representation of the master public key.
pub fn pubkey_b64(sk: &SigningKey) -> String {
    STANDARD_NO_PAD.encode(sk.verifying_key().to_bytes())
}

/// Parse a base64 (no-pad) 32-byte public key.
pub fn parse_pubkey_b64(b64: &str) -> Result<VerifyingKey, AppError> {
    let bytes = STANDARD_NO_PAD
        .decode(b64.trim())
        .map_err(|e| AppError::Validation(format!("Master pubkey nicht decodierbar: {e}")))?;
    if bytes.len() != 32 {
        return Err(AppError::Validation(format!(
            "Master pubkey Länge {} (erwartet 32)",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    VerifyingKey::from_bytes(&arr)
        .map_err(|e| AppError::Validation(format!("Master pubkey ungültig: {e}")))
}

/// Sign `body` (canonical JSON bytes) with the loaded master key.
pub fn sign(sk: &SigningKey, body: &[u8]) -> String {
    let sig = sk.sign(body);
    STANDARD_NO_PAD.encode(sig.to_bytes())
}

/// Verify a base64 (no-pad) signature against the master public key.
pub fn verify(pubkey: &VerifyingKey, body: &[u8], sig_b64: &str) -> Result<(), AppError> {
    let sig_bytes = STANDARD_NO_PAD
        .decode(sig_b64.trim())
        .map_err(|e| AppError::Validation(format!("Signatur nicht decodierbar: {e}")))?;
    if sig_bytes.len() != 64 {
        return Err(AppError::Validation("Signaturlänge ungültig".into()));
    }
    let mut arr = [0u8; 64];
    arr.copy_from_slice(&sig_bytes);
    let sig = ed25519_dalek::Signature::from_bytes(&arr);
    pubkey
        .verify(body, &sig)
        .map_err(|_| AppError::Validation("Signatur ungültig".into()))
}
