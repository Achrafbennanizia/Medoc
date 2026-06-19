//! OS keychain storage for sensitive material (LAN JWT, audit HMAC).
//!
//! Order: `MEDOC_*` env override (tests) → keyring → migrate legacy plaintext file into keyring.

use std::path::Path;

use base64::{engine::general_purpose::STANDARD, Engine};
use keyring::Entry;
use rand::RngCore;

use crate::error::AppError;

const SERVICE: &str = "de.medoc.app";

pub fn load_or_create_bytes(
    account: &str,
    legacy_plaintext_path: Option<&Path>,
    byte_len: usize,
) -> Result<Vec<u8>, AppError> {
    if let Some(bytes) = env_override_bytes(account) {
        return Ok(bytes);
    }

    let entry = Entry::new(SERVICE, account)
        .map_err(|e| AppError::Internal(format!("Keyring-Eintrag {account}: {e}")))?;

    if let Ok(encoded) = entry.get_password() {
        return decode_stored_bytes(&encoded, account);
    }

    if let Some(path) = legacy_plaintext_path {
        if path.exists() {
            let raw = std::fs::read(path)
                .map_err(|e| AppError::Internal(format!("Legacy-Geheimnis {account}: {e}")))?;
            store_in_keyring(&entry, &raw, account)?;
            let _ = std::fs::remove_file(path);
            return Ok(normalize_len(raw, byte_len));
        }
    }

    let mut raw = vec![0u8; byte_len];
    rand::thread_rng().fill_bytes(&mut raw);
    store_in_keyring(&entry, &raw, account)?;
    Ok(raw)
}

/// Returns true when the keyring entry for `account` already has a value.
pub fn account_exists(account: &str) -> Result<bool, AppError> {
    let entry = Entry::new(SERVICE, account)
        .map_err(|e| AppError::Internal(format!("Keyring-Eintrag {account}: {e}")))?;
    Ok(entry.get_password().is_ok())
}

/// Store explicit key material once (fails if the account already exists).
pub fn store_bytes(account: &str, raw: &[u8]) -> Result<(), AppError> {
    if account_exists(account)? {
        return Err(AppError::Validation(format!(
            "Keyring-Konto bereits belegt: {account}"
        )));
    }
    store_bytes_replace(account, raw)
}

/// Store key material, replacing any existing entry (owner activation import).
pub fn store_bytes_replace(account: &str, raw: &[u8]) -> Result<(), AppError> {
    let entry = Entry::new(SERVICE, account)
        .map_err(|e| AppError::Internal(format!("Keyring-Eintrag {account}: {e}")))?;
    store_in_keyring(&entry, raw, account)
}

/// Load key material when present; does not create a new key.
pub fn load_bytes_if_exists(account: &str) -> Result<Option<Vec<u8>>, AppError> {
    if let Some(bytes) = env_override_bytes(account) {
        return Ok(Some(bytes));
    }
    let entry = Entry::new(SERVICE, account)
        .map_err(|e| AppError::Internal(format!("Keyring-Eintrag {account}: {e}")))?;
    match entry.get_password() {
        Ok(encoded) => decode_stored_bytes(&encoded, account).map(Some),
        Err(_) => Ok(None),
    }
}

fn env_override_bytes(account: &str) -> Option<Vec<u8>> {
    let var = match account {
        "audit-hmac-key" => std::env::var("MEDOC_AUDIT_KEY").ok(),
        "lan-jwt-secret" => std::env::var("MEDOC_LAN_JWT_SECRET").ok(),
        _ => None,
    }?;
    Some(var.into_bytes())
}

fn store_in_keyring(entry: &Entry, raw: &[u8], account: &str) -> Result<(), AppError> {
    let encoded = STANDARD.encode(raw);
    entry
        .set_password(&encoded)
        .map_err(|e| AppError::Internal(format!("Keyring speichern {account}: {e}")))
}

fn decode_stored_bytes(encoded: &str, account: &str) -> Result<Vec<u8>, AppError> {
    STANDARD
        .decode(encoded.trim())
        .map_err(|e| AppError::Internal(format!("Keyring decode {account}: {e}")))
}

fn normalize_len(mut raw: Vec<u8>, byte_len: usize) -> Vec<u8> {
    if raw.len() == byte_len {
        return raw;
    }
    if raw.len() > byte_len {
        raw.truncate(byte_len);
        return raw;
    }
    raw.resize(byte_len, 0);
    raw
}
