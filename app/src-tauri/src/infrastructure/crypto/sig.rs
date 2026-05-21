//! Ed25519 signature verification shared by license and update flows.

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};

use crate::error::AppError;

/// Verify a base64-encoded Ed25519 signature (64 raw bytes) over `msg`.
pub fn verify_ed25519(pubkey: &[u8; 32], msg: &[u8], sig_b64: &str) -> Result<(), AppError> {
    if sig_b64.trim().is_empty() {
        return Err(AppError::Validation("Signatur fehlt".into()));
    }

    let sig_bytes = STANDARD_NO_PAD
        .decode(sig_b64.trim())
        .map_err(|e| AppError::Validation(format!("Signatur nicht decodierbar: {e}")))?;
    if sig_bytes.len() != 64 {
        return Err(AppError::Validation("Signaturlänge ungültig".into()));
    }
    let mut sig_arr = [0u8; 64];
    sig_arr.copy_from_slice(&sig_bytes);
    let signature = Signature::from_bytes(&sig_arr);

    let key = VerifyingKey::from_bytes(pubkey)
        .map_err(|e| AppError::Internal(format!("Vendor-Key Fehler: {e}")))?;

    key.verify(msg, &signature)
        .map_err(|_| AppError::Validation("Signatur ungültig".into()))
}
