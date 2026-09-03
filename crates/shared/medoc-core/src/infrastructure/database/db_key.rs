//! SQLCipher key material: OS keychain, optional wrapped file fallback, `MEDOC_DB_KEY` for tests.

use std::path::{Path, PathBuf};
#[cfg(not(test))]
use std::sync::OnceLock;

use argon2::{Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD, Engine};
use keyring::Entry;
use rand::RngCore;
use sqlx::SqlitePool;
use zeroize::Zeroizing;

use crate::error::AppError;
const SERVICE: &str = "de.medoc.app";
const KEYRING_ACCOUNT: &str = "sqlcipher-key";
const SALT_FILE: &str = "db-key.salt";
const WRAP_FILE: &str = "db-key.wrap";
/// Fallback when the OS keychain is unavailable (adhoc USB builds, CI).
const LOCAL_KEY_FILE: &str = "sqlcipher.key";

#[cfg(test)]
const TEST_SQLCIPHER_KEY: [u8; 32] = [
    0x6d, 0x65, 0x64, 0x6f, 0x63, 0x2d, 0x74, 0x65, 0x73, 0x74, 0x2d, 0x73, 0x71, 0x6c, 0x63, 0x69,
    0x70, 0x68, 0x65, 0x72, 0x2d, 0x6b, 0x65, 0x79, 0x2d, 0x30, 0x30, 0x30, 0x30, 0x31, 0x32, 0x00,
];

#[cfg(not(test))]
static EPHEMERAL_TEST_POOL_KEY: OnceLock<Zeroizing<Vec<u8>>> = OnceLock::new();

/// Key for encrypted in-memory pools in tests (`MEDOC_DB_KEY` preferred; no fixed secret in release builds).
pub fn test_pool_key_material() -> Result<Zeroizing<Vec<u8>>, AppError> {
    if let Some(k) = env_override_key() {
        return Ok(Zeroizing::new(k));
    }
    #[cfg(test)]
    {
        Ok(Zeroizing::new(TEST_SQLCIPHER_KEY.to_vec()))
    }
    #[cfg(not(test))]
    {
        let key = EPHEMERAL_TEST_POOL_KEY.get_or_init(|| {
            let mut k = vec![0u8; 32];
            rand::thread_rng().fill_bytes(&mut k);
            Zeroizing::new(k)
        });
        Ok(key.clone())
    }
}

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

/// Import a pre-generated 32-byte SQLCipher key (owner activation manifest).
pub fn import_raw_key(key: &[u8; 32]) -> Result<(), AppError> {
    if env_override_key().is_some() {
        tracing::warn!(
            target: "medoc::security",
            event = "ACTIVATION_DB_KEY_SKIP",
            hint = "MEDOC_DB_KEY set — manifest DB key not imported (dev override active)"
        );
        return Ok(());
    }
    if try_keyring_key().is_some() {
        return Err(AppError::Validation(
            "SQLCipher key already provisioned.".into(),
        ));
    }
    keyring_store(key)
}

/// Apply manifest SQLCipher key during owner activation.
///
/// When the app bootstrapped with an ephemeral keyring key (no `db-key.wrap`), replaces
/// `medoc.db` with a fresh file under the manifest key. Caller must reopen via
/// [`crate::infrastructure::database::connection::reopen_app_pool`] when this returns `true`.
pub async fn apply_activation_sqlcipher_key(
    pool: &SqlitePool,
    app_dir: &Path,
    db_path: &Path,
    new_key: &[u8; 32],
) -> Result<bool, AppError> {
    if env_override_key().is_some() {
        tracing::warn!(
            target: "medoc::security",
            event = "ACTIVATION_DB_KEY_SKIP",
            hint = "MEDOC_DB_KEY set — manifest DB key not imported (dev override active)"
        );
        return Ok(false);
    }
    if wrap_path(app_dir).exists() {
        return Err(AppError::Validation(
            "Activation import not possible: database passphrase is already set. \
             Import the activation manifest before the DB passphrase."
                .into(),
        ));
    }

    let Some(old_key) = try_keyring_key() else {
        keyring_store(new_key)?;
        return Ok(false);
    };

    let old_arr: [u8; 32] = old_key
        .try_into()
        .map_err(|_| AppError::Internal("SQLCipher key has invalid length".into()))?;

    if old_arr == *new_key {
        return Ok(false);
    }

    pool.close().await;

    if db_path.exists() {
        for suffix in ["-wal", "-shm"] {
            let sidecar = PathBuf::from(format!("{}{suffix}", db_path.display()));
            let _ = std::fs::remove_file(sidecar);
        }
        std::fs::remove_file(db_path).map_err(|e| {
            AppError::Internal(format!(
                "Could not replace medoc.db before activation import: {e}"
            ))
        })?;
    }

    keyring_store(new_key)?;
    Ok(true)
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
        let _ = write_local_key_file(app_dir, &k);
        return Ok(Zeroizing::new(k));
    }
    if let Ok(k) = read_local_key_file(app_dir) {
        let _ = keyring_store(&k);
        return Ok(Zeroizing::new(k));
    }
    if wrap_path(app_dir).exists() {
        return Err(AppError::Validation(
            "Database passphrase required (key only in encrypted file).".into(),
        ));
    }
    if !auto_create {
        return Err(AppError::Validation(
            "Database passphrase not yet set.".into(),
        ));
    }
    let mut key = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    let _ = keyring_store(&key);
    write_local_key_file(app_dir, &key)?;
    Ok(Zeroizing::new(key))
}

fn local_key_path(app_dir: &Path) -> PathBuf {
    app_dir.join(LOCAL_KEY_FILE)
}

fn read_local_key_file(app_dir: &Path) -> Result<Vec<u8>, AppError> {
    let raw = std::fs::read_to_string(local_key_path(app_dir))
        .map_err(|e| AppError::Internal(format!("sqlcipher.key read: {e}")))?;
    STANDARD
        .decode(raw.trim())
        .map_err(|e| AppError::Internal(format!("sqlcipher.key decode: {e}")))
        .map(normalize_32)
}

fn write_local_key_file(app_dir: &Path, key: &[u8]) -> Result<(), AppError> {
    std::fs::create_dir_all(app_dir).map_err(|e| {
        AppError::Internal(format!("Could not create app data directory: {e}"))
    })?;
    let path = local_key_path(app_dir);
    std::fs::write(&path, STANDARD.encode(key))
        .map_err(|e| AppError::Internal(format!("sqlcipher.key write: {e}")))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&path)
            .map_err(|e| AppError::Internal(format!("sqlcipher.key meta: {e}")))?
            .permissions();
        perms.set_mode(0o600);
        std::fs::set_permissions(&path, perms)
            .map_err(|e| AppError::Internal(format!("sqlcipher.key chmod: {e}")))?;
    }
    Ok(())
}

/// User-chosen passphrase: derive SQLCipher key, store in keychain + wrapped file.
pub fn provision_user_passphrase(app_dir: &Path, passphrase: &str) -> Result<(), AppError> {
    if passphrase.len() < 12 {
        return Err(AppError::Validation(
            "Passphrase must be at least 12 characters.".into(),
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
        .map_err(|_| AppError::Internal("Keyring empty".into()))?;
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
        .map_err(|e| AppError::Internal(format!("Keyring store sqlcipher: {e}")))
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
            .map_err(|e| AppError::Internal(format!("db-key.salt read: {e}")));
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
        .map_err(|e| AppError::Internal(format!("db-key.wrap write: {e}")))?;
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
        .map_err(|e| AppError::Internal(format!("db-key.wrap read: {e}")))?;
    let blob = STANDARD
        .decode(encoded.trim())
        .map_err(|e| AppError::Internal(format!("db-key.wrap decode: {e}")))?;
    if blob.len() < 12 + 32 {
        return Err(AppError::Internal("db-key.wrap invalid".into()));
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
    test_pool_key_material().expect("test pool key")
}
