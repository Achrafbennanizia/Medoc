//! Cluster CA / master Ed25519 keypair for activation tokens, seat certificates, peer lists.
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

use std::sync::Mutex;

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use ed25519_dalek::{Signer, SigningKey, VerifyingKey};
use medoc_core::error::AppError;
use medoc_core::infrastructure::secret_store;

const SECRET_ACCOUNT: &str = "pairing-master-signing-key";

fn master_key_account() -> String {
    match std::env::var("MEDOC_INSTANCE") {
        Ok(n) if !n.is_empty() && n != "1" => format!("{SECRET_ACCOUNT}.{n}"),
        _ => SECRET_ACCOUNT.to_string(),
    }
}

static CACHED_SEED: Mutex<Option<[u8; 32]>> = Mutex::new(None);

fn signing_key_from_seed(seed: [u8; 32]) -> SigningKey {
    SigningKey::from_bytes(&seed)
}

/// Load (or create) the master signing key. Private bytes stay in this process.
pub fn load_or_create() -> Result<SigningKey, AppError> {
    if let Ok(env) = std::env::var("MEDOC_PAIRING_MASTER_SECRET") {
        return from_hex(env.trim());
    }
    if let Ok(guard) = CACHED_SEED.lock() {
        if let Some(seed) = *guard {
            return Ok(signing_key_from_seed(seed));
        }
    }
    let bytes = secret_store::load_or_create_bytes(&master_key_account(), None, 32)?;
    if bytes.len() != 32 {
        return Err(AppError::Internal(format!(
            "Master signing key must be 32 bytes (got {})",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    if let Ok(mut guard) = CACHED_SEED.lock() {
        *guard = Some(arr);
    }
    Ok(signing_key_from_seed(arr))
}

/// Cluster license seed when it is a raw 32-byte ed25519 seed and differs from `current`.
///
/// Activation tokens are signed with the key stored on the license row. A later
/// keychain miss mints a second key; HTTP sync then rejects every existing token
/// with `Invalid signature`. Callers that sign or verify tokens must prefer the
/// license seed.
pub(crate) fn prefer_license_seed(current: &SigningKey, license_seed: Option<&[u8]>) -> SigningKey {
    let Some(raw) = license_seed else {
        return signing_key_from_seed(current.to_bytes());
    };
    let Ok(seed) = <[u8; 32]>::try_from(raw) else {
        return signing_key_from_seed(current.to_bytes());
    };
    let pinned = signing_key_from_seed(seed);
    if pinned.verifying_key().to_bytes() == current.verifying_key().to_bytes() {
        signing_key_from_seed(current.to_bytes())
    } else {
        pinned
    }
}

/// Signing key for activation tokens. Uses the cluster license seed when the
/// keychain key has drifted. The license row is left as the source of truth;
/// this process remembers it so later signs match the tokens already issued.
pub async fn align_to_license(pool: &sqlx::SqlitePool) -> Result<SigningKey, AppError> {
    if std::env::var("MEDOC_PAIRING_MASTER_SECRET").is_ok() {
        return load_or_create();
    }
    let current = load_or_create()?;
    let seed = match sqlx::query_scalar::<_, Vec<u8>>("SELECT signing_key_enc FROM license LIMIT 1")
        .fetch_optional(pool)
        .await
    {
        Ok(row) => row,
        Err(sqlx::Error::Database(db)) if db.message().contains("no such table") => None,
        Err(error) => return Err(AppError::Database(error)),
    };
    let chosen = prefer_license_seed(&current, seed.as_deref());
    if chosen.verifying_key().to_bytes() == current.verifying_key().to_bytes() {
        return Ok(current);
    }
    let raw = <[u8; 32]>::try_from(seed.unwrap_or_default()).map_err(|_| {
        AppError::Internal("license signing key drifted but seed was not 32 bytes".into())
    })?;
    tracing::warn!(
        target: "medoc::sync",
        event = "MASTER_SIGNING_KEY_ALIGNED_TO_LICENSE"
    );
    if let Ok(mut guard) = CACHED_SEED.lock() {
        *guard = Some(raw);
    }
    Ok(signing_key_from_seed(raw))
}

/// One-time import from owner activation manifest (32-byte ed25519 seed).
pub fn import_seed(seed: [u8; 32]) -> Result<SigningKey, AppError> {
    secret_store::store_bytes_replace(&master_key_account(), &seed)?;
    if let Ok(mut guard) = CACHED_SEED.lock() {
        *guard = Some(seed);
    }
    Ok(signing_key_from_seed(seed))
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
        .map_err(|e| AppError::Validation(format!("Master pubkey not decodable: {e}")))?;
    if bytes.len() != 32 {
        return Err(AppError::Validation(format!(
            "Master pubkey length {} (expected 32)",
            bytes.len()
        )));
    }
    let mut arr = [0u8; 32];
    arr.copy_from_slice(&bytes);
    VerifyingKey::from_bytes(&arr)
        .map_err(|e| AppError::Validation(format!("Master pubkey invalid: {e}")))
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
        .map_err(|e| AppError::Validation(format!("Signature not decodable: {e}")))?;
    if sig_bytes.len() != 64 {
        return Err(AppError::Validation("Invalid signature length".into()));
    }
    let mut arr = [0u8; 64];
    arr.copy_from_slice(&sig_bytes);
    let sig = ed25519_dalek::Signature::from_bytes(&arr);
    // Strict verification rejects malleable / small-order signatures, so a
    // token has exactly one valid encoding (tokens are compared as strings).
    pubkey
        .verify_strict(body, &sig)
        .map_err(|_| AppError::Validation("Invalid signature".into()))
}

#[cfg(test)]
mod tests {
    use super::prefer_license_seed;
    use super::signing_key_from_seed;
    use crate::pairing::{mint_activation_token, verify_activation_token, ActivationTokenPayload};

    #[test]
    fn drifted_keychain_key_does_not_verify_a_license_signed_token() {
        let license = signing_key_from_seed([7u8; 32]);
        let drifted = signing_key_from_seed([9u8; 32]);
        let payload = ActivationTokenPayload {
            version: 2,
            device_id: "device-1".into(),
            slave_label: "Replica".into(),
            master_device_id: "master-1".into(),
            allowed_actions: vec!["sync.push".into(), "sync.pull".into()],
            issued_at: "2026-11-15T20:25:03Z".into(),
            nonce: "nonce-1".into(),
        };
        let token = mint_activation_token(&license, &payload).expect("mint");
        assert!(verify_activation_token(&token, &drifted.verifying_key()).is_err());
        let chosen = prefer_license_seed(&drifted, Some(&license.to_bytes()));
        assert!(verify_activation_token(&token, &chosen.verifying_key()).is_ok());
        assert_eq!(
            prefer_license_seed(&license, Some(&license.to_bytes()))
                .verifying_key()
                .to_bytes(),
            license.verifying_key().to_bytes()
        );
        assert_eq!(
            prefer_license_seed(&drifted, Some(&[1, 2, 3]))
                .verifying_key()
                .to_bytes(),
            drifted.verifying_key().to_bytes()
        );
    }
}
