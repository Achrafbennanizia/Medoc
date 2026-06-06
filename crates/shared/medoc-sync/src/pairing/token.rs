//! Activation token minting and verification (Ed25519 over canonical JSON).

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use medoc_core::error::AppError;

use crate::master_keys;

use super::types::{ActivationTokenPayload, ACTIVATION_TOKEN_PREFIX};

/// Build & sign an activation token from a payload. Public so vendor/test
/// utilities can mint tokens without going through the database.
pub fn mint_activation_token(
    signing_key: &ed25519_dalek::SigningKey,
    payload: &ActivationTokenPayload,
) -> Result<String, AppError> {
    let body = serde_json::to_vec(payload)
        .map_err(|e| AppError::Internal(format!("token serialise: {e}")))?;
    let body_b64 = STANDARD_NO_PAD.encode(&body);
    let sig = master_keys::sign(signing_key, body_b64.as_bytes());
    Ok(format!("{ACTIVATION_TOKEN_PREFIX}{body_b64}.{sig}"))
}

/// Parse + verify an activation token presented by a replica.
pub fn verify_activation_token(
    token: &str,
    master_pubkey: &ed25519_dalek::VerifyingKey,
) -> Result<ActivationTokenPayload, AppError> {
    let rest = token.strip_prefix(ACTIVATION_TOKEN_PREFIX).ok_or_else(|| {
        AppError::Validation(format!(
            "Aktivierungstoken: erwartet Präfix `{ACTIVATION_TOKEN_PREFIX}`"
        ))
    })?;
    let (body_b64, sig_b64) = rest
        .split_once('.')
        .ok_or_else(|| AppError::Validation("Aktivierungstoken: Trennzeichen fehlt".into()))?;
    master_keys::verify(master_pubkey, body_b64.as_bytes(), sig_b64)?;
    let body_bytes = STANDARD_NO_PAD
        .decode(body_b64)
        .map_err(|e| AppError::Validation(format!("Aktivierungstoken decode: {e}")))?;
    let payload: ActivationTokenPayload = serde_json::from_slice(&body_bytes)
        .map_err(|e| AppError::Validation(format!("Aktivierungstoken JSON: {e}")))?;
    if payload.version != 2 {
        return Err(AppError::Validation(format!(
            "Aktivierungstoken Version {} (erwartet 2)",
            payload.version
        )));
    }
    Ok(payload)
}
