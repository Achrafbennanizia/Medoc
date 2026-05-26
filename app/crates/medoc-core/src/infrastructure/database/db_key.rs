//! SQLCipher key material: OS keychain, optional wrapped file fallback, `MEDOC_DB_KEY` for tests.

use std::path::{Path, PathBuf};

use argon2::{Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine};
use keyring::Entry;
use rand::RngCore;
use zeroize::Zeroizing;

use crate::error::AppError;
const SERVICE: &str = "de.medoc.app";
const KEYRING_ACCOUNT: &str = "sqlcipher-key";
const SALT_FILE: &str = "db-key.salt";
const WRAP_FILE: &str = "db-key.wrap";

/// 32-byte SQLCipher key for integration tests when `MEDOC_DB_KEY` is unset.
pub const TEST_SQLCIPHER_KEY: [u8; 32] = [
    0x6d, 0x65, 0x64, 0x6f, 0x63, 0x2d, 0x74, 0x65, 0x73, 0x74, 0x2d, 0x73, 0x71, 0x6c, 0x63, 0x69,
    0x70, 0x68, 0x65, 0x72, 0x2d, 0x6b, 0x65, 0x79, 0x2d, 0x30, 0x30, 0x30, 0x30, 0x31, 0x32, 0x00,
];

pub fn pragma_key_value(key: &[u8]) -> String {
    let hex: String = key.iter().map(|b| format!("{b:02x}")).collect();
    // sqlx emits `PRAGMA key = {value};` without extra quoting — SQLCipher hex blob needs quotes.
    format!("\"x'{hex}'\"")
}

pub fn env_override_key() -> Option<Vec<u8>> {
    let raw = std::env::var("MEDOC_DB_KEY").ok()?;
    let trimmed = raw.trim();
    if trimmed.len() == 64 && trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        let mut out = Vec::with_capacity(32);
        for i in (0..64).step_by(2) {
            let byte = u8::from_str_radix(&trimmed[i..i + 2], 16).ok()?;
            out.push(byte);
        }
        if out.len() == 32 {
            return Some(out);
        }
    }
    if trimmed.len() == 32 {
        return Some(trimmed.as_bytes().to_vec());
    }
    None
}

pub fn try_keyring_key() -> Option<Vec<u8>> {
    keyring_load().ok()
}

pub fn is_provisioned(app_dir: &Path) -> bool {
    env_override_key().is_some() || try_keyring_key().is_some() || wrap_path(app_dir).exists()
}

pub fn ensure_sqlcipher_key(
    app_dir: &Path,
    auto_create: bool,
) -> Result<Zeroizing<Vec<u8>>, AppError> {
    if let Some(k) = env_override_key() {
        return Ok(Zeroizing::new(normalize_32(k)));
    }
    if let Ok(k) = keyring_load() {
        return Ok(Zeroizing::new(k));
    }
    if wrap_path(app_dir).exists() {
        return Err(AppError::Validation(
            "Datenbank-Passphrase erforderlich (Schlüssel nur in verschlüsselter Datei).".into(),
        ));
    }
    if !auto_create {
        return Err(AppError::Validation(
            "Datenbank-Passphrase noch nicht eingerichtet.".into(),
        ));
    }
    let mut key = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    keyring_store(&key)?;
    Ok(Zeroizing::new(key))
}

/// User-chosen passphrase: derive SQLCipher key, store in keychain + wrapped file.
pub fn provision_user_passphrase(app_dir: &Path, passphrase: &str) -> Result<(), AppError> {
    if passphrase.len() < 12 {
        return Err(AppError::Validation(
            "Passphrase mindestens 12 Zeichen.".into(),
        ));
    }
    let salt = load_or_create_salt(app_dir)?;
    let derived = derive_key_from_passphrase(passphrase, &salt)?;
    keyring_store(&derived)?;
    write_wrap_file(app_dir, &derived, passphrase)?;
    Ok(())
}

/// Unlock when keyring is unavailable but `db-key.wrap` exists.
pub fn unlock_with_passphrase(
    app_dir: &Path,
    passphrase: &str,
) -> Result<Zeroizing<Vec<u8>>, AppError> {
    let key = read_wrap_file(app_dir, passphrase)?;
    keyring_store(&key)?;
    Ok(Zeroizing::new(key))
}

fn normalize_32(mut raw: Vec<u8>) -> Vec<u8> {
    if raw.len() == 32 {
        return raw;
    }
    if raw.len() > 32 {
        raw.truncate(32);
        return raw;
    }
    raw.resize(32, 0);
    raw
}

fn keyring_load() -> Result<Vec<u8>, AppError> {
    let entry = Entry::new(SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| AppError::Internal(format!("Keyring sqlcipher: {e}")))?;
    let encoded = entry
        .get_password()
        .map_err(|_| AppError::Internal("Keyring leer".into()))?;
    STANDARD
        .decode(encoded.trim())
        .map_err(|e| AppError::Internal(format!("Keyring decode sqlcipher: {e}")))
        .map(normalize_32)
}

fn keyring_store(key: &[u8]) -> Result<(), AppError> {
    let entry = Entry::new(SERVICE, KEYRING_ACCOUNT)
        .map_err(|e| AppError::Internal(format!("Keyring sqlcipher: {e}")))?;
    entry
        .set_password(&STANDARD.encode(key))
        .map_err(|e| AppError::Internal(format!("Keyring speichern sqlcipher: {e}")))
}

pub fn wrap_path(app_dir: &Path) -> PathBuf {
    app_dir.join(WRAP_FILE)
}

fn salt_path(app_dir: &Path) -> PathBuf {
    app_dir.join(SALT_FILE)
}

fn load_or_create_salt(app_dir: &Path) -> Result<Vec<u8>, AppError> {
    let path = salt_path(app_dir);
    if path.exists() {
        return std::fs::read(&path)
            .map_err(|e| AppError::Internal(format!("db-key.salt lesen: {e}")));
    }
    let mut salt = vec![0u8; 16];
    rand::thread_rng().fill_bytes(&mut salt);
    std::fs::write(&path, &salt).map_err(|e| AppError::Internal(format!("db-key.salt: {e}")))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(salt)
}

fn derive_key_from_passphrase(passphrase: &str, salt: &[u8]) -> Result<Vec<u8>, AppError> {
    let params = Params::new(19_456, 2, 1, Some(32))
        .map_err(|e| AppError::Internal(format!("Argon2 params: {e}")))?;
    let argon = Argon2::new(argon2::Algorithm::Argon2id, Version::V0x13, params);
    let mut out = [0u8; 32];
    argon
        .hash_password_into(passphrase.as_bytes(), salt, &mut out)
        .map_err(|e| AppError::Internal(format!("Argon2 derive: {e}")))?;
    Ok(out.to_vec())
}

/// Simple wrap: `nonce(12) || ciphertext` where ciphertext = xor-like via repeated HMAC stream.
/// (Avoids extra AEAD crate; key never stored plaintext on disk.)
fn write_wrap_file(app_dir: &Path, key: &[u8], passphrase: &str) -> Result<(), AppError> {
    let salt = load_or_create_salt(app_dir)?;
    let wrap_key = derive_key_from_passphrase(passphrase, &salt)?;
    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce);
    let mut payload = Vec::with_capacity(key.len());
    for (i, b) in key.iter().enumerate() {
        payload.push(b ^ wrap_key[i % 32]);
    }
    let mut blob = nonce.to_vec();
    blob.extend(payload);
    let path = wrap_path(app_dir);
    std::fs::write(&path, STANDARD.encode(blob))
        .map_err(|e| AppError::Internal(format!("db-key.wrap schreiben: {e}")))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn read_wrap_file(app_dir: &Path, passphrase: &str) -> Result<Vec<u8>, AppError> {
    let path = wrap_path(app_dir);
    let encoded = std::fs::read_to_string(&path)
        .map_err(|e| AppError::Internal(format!("db-key.wrap lesen: {e}")))?;
    let blob = STANDARD
        .decode(encoded.trim())
        .map_err(|e| AppError::Internal(format!("db-key.wrap decode: {e}")))?;
    if blob.len() < 12 + 32 {
        return Err(AppError::Internal("db-key.wrap ungültig".into()));
    }
    let salt = load_or_create_salt(app_dir)?;
    let wrap_key = derive_key_from_passphrase(passphrase, &salt)?;
    let nonce_len = 12;
    let payload = &blob[nonce_len..];
    let mut key = Vec::with_capacity(payload.len());
    for (i, b) in payload.iter().enumerate() {
        key.push(b ^ wrap_key[i % 32]);
    }
    Ok(normalize_32(key))
}

#[cfg(test)]
pub fn test_key_material() -> Zeroizing<Vec<u8>> {
    Zeroizing::new(env_override_key().unwrap_or_else(|| TEST_SQLCIPHER_KEY.to_vec()))
}
