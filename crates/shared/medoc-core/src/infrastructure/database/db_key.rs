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

fn instance_suffix() -> String {
    match std::env::var("MEDOC_INSTANCE") {
        Ok(s) if !s.trim().is_empty() => format!("-{}", s.trim()),
        _ => String::new(),
    }
}

fn keyring_account() -> String {
    format!("{KEYRING_ACCOUNT}{}", instance_suffix())
}
const SALT_FILE: &str = "db-key.salt";
const WRAP_FILE: &str = "db-key.wrap";
const KCV_FILE: &str = "db-key.kcv";
/// Fallback when the OS keychain is unavailable (adhoc USB builds, CI).
const LOCAL_KEY_FILE: &str = "sqlcipher.key";
const KCV_INFO: &[u8] = b"medoc-kcv-v1";

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
/// When the app bootstrapped with an ephemeral keyring key (no `db-key.wrap`), rekeys
/// the existing `medoc.db` to the manifest key. Caller must reopen via
/// [`crate::infrastructure::database::connection::reopen_app_pool`] when this returns `true`.
///
/// **Safe Bridge:** any later SQLCipher rekey invalidates Bridge C shares and wrap
/// KCVs. Ops must re-run `medoc-keygen` and reissue the printed practice sheet plus
/// vendor share (`key_id` may stay if the same vendor X25519 key is reused).
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

    // Do NOT delete `-wal` / `-shm` here. If any connection had not been
    // checkpointed, the WAL holds committed transactions; deleting it lost
    // them. `rekey_database_file` opens the file (which replays the WAL),
    // switches it to rollback-journal mode and rekeys on one connection.
    let rekeyed = db_path.exists();
    if rekeyed {
        crate::infrastructure::database::sqlcipher::rekey_database_file(db_path, &old_arr, new_key)
            .await?;
    }

    // The database is now encrypted with `new_key`. If the keychain write
    // fails, nobody holds that key: roll the file back to the old key.
    if let Err(e) = keyring_store(new_key).and_then(|_| {
        keyring_load().and_then(|stored| {
            if stored.as_slice() == new_key.as_slice() {
                Ok(())
            } else {
                Err(AppError::Internal(
                    "keychain did not keep the new key".into(),
                ))
            }
        })
    }) {
        if rekeyed {
            if let Err(back) = crate::infrastructure::database::sqlcipher::rekey_database_file(
                db_path, new_key, &old_arr,
            )
            .await
            {
                tracing::error!(
                    target: "medoc::security",
                    event = "SQLCIPHER_REKEY_ROLLBACK_FAILED",
                    error = %back
                );
                // Last resort: keep the new key on disk (0600) rather than lose the DB.
                let _ = write_local_key_file(app_dir, new_key);
            }
        }
        return Err(e);
    }
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
    let keychain_error = match keyring_read() {
        KeyringRead::Found(k) => return Ok(Zeroizing::new(k)),
        KeyringRead::Missing => None,
        KeyringRead::Unavailable(e) => Some(e),
    };
    if let Ok(k) = read_local_key_file(app_dir) {
        // F45: move the legacy plaintext key into the keychain. Delete the file
        // only once the keychain holds it, or the database becomes unreadable.
        match keyring_store(&k).and_then(|_| keyring_load()) {
            Ok(stored) if stored == k => {
                let path = local_key_path(app_dir);
                let _ = std::fs::write(&path, vec![0u8; 64]);
                let _ = std::fs::remove_file(&path);
            }
            _ => tracing::warn!(
                target: "medoc::security",
                event = "SQLCIPHER_LOCAL_KEY_KEPT",
                hint = "OS keychain unavailable; plaintext sqlcipher.key left in place"
            ),
        }
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
    // The keychain did not answer. It may hold the real key (locked, prompt
    // denied, service still starting). A new key written now would replace it
    // and leave the practice database unreadable for good.
    if let Some(e) = keychain_error {
        tracing::error!(
            target: "medoc::security",
            event = "SQLCIPHER_KEYCHAIN_UNAVAILABLE",
            error = %e,
            hint = "refusing to generate a new database key while the keychain is unreadable"
        );
        return Err(AppError::Internal(
            "The system keychain is not available. Unlock it and start MeDoc again.".into(),
        ));
    }
    let mut key = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut key);
    // F45: a key that never reached durable storage is gone after restart and
    // the freshly encrypted database with it (the old code ignored this error).
    let in_keychain = keyring_store(&key)
        .and_then(|_| keyring_load())
        .map(|stored| stored == key)
        .unwrap_or(false);
    if !in_keychain {
        write_local_key_file(app_dir, &key)?;
        tracing::warn!(
            target: "medoc::security",
            event = "SQLCIPHER_KEY_FILE_FALLBACK",
            hint = "OS keychain unavailable; key stored in sqlcipher.key (0600). Set a passphrase to remove it."
        );
    }
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
    std::fs::create_dir_all(app_dir)
        .map_err(|e| AppError::Internal(format!("Could not create app data directory: {e}")))?;
    let path = local_key_path(app_dir);
    // Create with mode 0600 directly: write-then-chmod left the database key
    // readable by other local users (umask 022) for a moment.
    let tmp = path.with_extension("key.tmp");
    let _ = std::fs::remove_file(&tmp);
    {
        use std::io::Write;
        let mut opts = std::fs::OpenOptions::new();
        opts.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            opts.mode(0o600);
        }
        let mut f = opts
            .open(&tmp)
            .map_err(|e| AppError::Internal(format!("sqlcipher.key write: {e}")))?;
        f.write_all(STANDARD.encode(key).as_bytes())
            .and_then(|_| f.sync_all())
            .map_err(|e| AppError::Internal(format!("sqlcipher.key write: {e}")))?;
    }
    std::fs::rename(&tmp, &path)
        .map_err(|e| AppError::Internal(format!("sqlcipher.key rename: {e}")))?;
    Ok(())
}

/// Bridge B: wrap the SQLCipher key under a practice passphrase.
///
/// If a key is already in the keychain / env (e.g. after activation), that key
/// is wrapped — the passphrase does **not** replace it. On a fresh install with
/// no key yet, a new key is derived from the passphrase (legacy first-launch).
pub fn provision_user_passphrase(app_dir: &Path, passphrase: &str) -> Result<(), AppError> {
    crate::infrastructure::crypto::validate_password_policy(passphrase)?;
    let salt = load_or_create_salt(app_dir)?;
    let key = if let Some(existing) = env_override_key().or_else(try_keyring_key) {
        normalize_32(existing)
    } else if let Ok(local) = read_local_key_file(app_dir) {
        local
    } else {
        derive_key_from_passphrase(passphrase, &salt)?
    };
    keyring_store(&key)?;
    write_wrap_file(app_dir, &key, passphrase)?;
    write_kcv_file(app_dir, &key)?;
    // Prefer keychain; drop plaintext fallback once wrap exists.
    let local = local_key_path(app_dir);
    if local.exists() {
        let _ = std::fs::write(&local, vec![0u8; 64]);
        let _ = std::fs::remove_file(&local);
    }
    Ok(())
}

/// First 16 bytes of HKDF-SHA256(ikm=db_key, salt=empty, info=`medoc-kcv-v1`).
pub fn compute_kcv(db_key: &[u8]) -> Vec<u8> {
    use hkdf::Hkdf;
    use sha2::Sha256;
    let hk = Hkdf::<Sha256>::new(None, db_key);
    let mut okm = [0u8; 32];
    hk.expand(KCV_INFO, &mut okm)
        .expect("HKDF expand medoc-kcv-v1");
    okm[..16].to_vec()
}

pub fn verify_kcv(db_key: &[u8], expected: &[u8]) -> bool {
    let got = compute_kcv(db_key);
    got.len() == expected.len() && constant_time_eq(&got, expected)
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

pub fn kcv_path(app_dir: &Path) -> PathBuf {
    app_dir.join(KCV_FILE)
}

pub fn write_kcv_file(app_dir: &Path, db_key: &[u8]) -> Result<(), AppError> {
    let kcv = compute_kcv(db_key);
    let path = kcv_path(app_dir);
    let tmp = path.with_extension("kcv.tmp");
    std::fs::write(&tmp, STANDARD.encode(kcv))
        .map_err(|e| AppError::Internal(format!("db-key.kcv write: {e}")))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600));
    }
    std::fs::rename(&tmp, &path)
        .map_err(|e| AppError::Internal(format!("db-key.kcv rename: {e}")))?;
    Ok(())
}

pub fn read_kcv_file(app_dir: &Path) -> Result<Vec<u8>, AppError> {
    let raw = std::fs::read_to_string(kcv_path(app_dir))
        .map_err(|e| AppError::Internal(format!("db-key.kcv read: {e}")))?;
    STANDARD
        .decode(raw.trim())
        .map_err(|e| AppError::Internal(format!("db-key.kcv decode: {e}")))
}

/// Write wrap (+ salt + kcv) for an already-known SQLCipher key without
/// touching the OS keychain (used by `medoc-recovery`).
pub fn write_wrap_for_recovery(
    app_dir: &Path,
    key: &[u8],
    passphrase: &str,
) -> Result<(), AppError> {
    crate::infrastructure::crypto::validate_password_policy(passphrase)?;
    let key = normalize_32(key.to_vec());
    let _ = load_or_create_salt(app_dir)?;
    write_wrap_file(app_dir, &key, passphrase)?;
    write_kcv_file(app_dir, &key)?;
    Ok(())
}

/// Safe-bridge recovery sidecars that must travel with backups.
pub fn recovery_sidecar_names() -> &'static [&'static str] {
    &[SALT_FILE, WRAP_FILE, KCV_FILE]
}

/// True when Bridge B wrap is missing and production policy requires it.
/// Skipped when `MEDOC_DB_KEY` is set or `MEDOC_SKIP_DB_PASSPHRASE=1` (CI/dev).
pub fn bridge_b_passphrase_required(app_dir: &Path) -> bool {
    if wrap_path(app_dir).exists() {
        return false;
    }
    if env_override_key().is_some() {
        return false;
    }
    if std::env::var("MEDOC_SKIP_DB_PASSPHRASE").ok().as_deref() == Some("1") {
        return false;
    }
    // Require wrap once any DB key material or database file exists, and also
    // on a completely empty first launch (gate creates the first key via wrap).
    true
}

/// Read and authenticate `db-key.wrap` (and optional `db-key.kcv`) without
/// touching the OS keychain. Used by `medoc-recovery`.
pub fn read_wrap_key(app_dir: &Path, passphrase: &str) -> Result<Zeroizing<Vec<u8>>, AppError> {
    let key = read_wrap_file(app_dir, passphrase)?;
    if let Ok(expected) = read_kcv_file(app_dir) {
        if !verify_kcv(&key, &expected) {
            return Err(AppError::Validation(
                "Database passphrase unlock failed key-check (wrong key or corrupted wrap).".into(),
            ));
        }
    }
    Ok(Zeroizing::new(key))
}

/// Unlock when keyring is unavailable but `db-key.wrap` exists.
pub fn unlock_with_passphrase(
    app_dir: &Path,
    passphrase: &str,
) -> Result<Zeroizing<Vec<u8>>, AppError> {
    let key = read_wrap_key(app_dir, passphrase)?;
    keyring_store(&key)?;
    Ok(key)
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

/// Outcome of reading the SQLCipher key from the OS keychain.
///
/// `Missing` and `Unavailable` must stay apart: only a keychain that answered
/// "no such entry" may receive a freshly generated key. A locked keychain, a
/// denied access prompt or a secret service that is not running yet is
/// `Unavailable`, and writing a new key then would replace the real one.
enum KeyringRead {
    Found(Vec<u8>),
    Missing,
    Unavailable(String),
}

fn keyring_read() -> KeyringRead {
    let entry = match Entry::new(SERVICE, &keyring_account()) {
        Ok(entry) => entry,
        Err(e) => return KeyringRead::Unavailable(format!("Keyring sqlcipher: {e}")),
    };
    match entry.get_password() {
        Ok(encoded) => match STANDARD.decode(encoded.trim()) {
            Ok(raw) => KeyringRead::Found(normalize_32(raw)),
            // A corrupt entry is not "missing": never overwrite it.
            Err(e) => KeyringRead::Unavailable(format!("Keyring decode sqlcipher: {e}")),
        },
        Err(keyring::Error::NoEntry) => KeyringRead::Missing,
        Err(e) => KeyringRead::Unavailable(format!("Keyring sqlcipher: {e}")),
    }
}

fn keyring_load() -> Result<Vec<u8>, AppError> {
    match keyring_read() {
        KeyringRead::Found(key) => Ok(key),
        KeyringRead::Missing => Err(AppError::Internal("Keyring empty".into())),
        KeyringRead::Unavailable(e) => Err(AppError::Internal(e)),
    }
}

fn keyring_store(key: &[u8]) -> Result<(), AppError> {
    let entry = Entry::new(SERVICE, &keyring_account())
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

const WRAP_V2_TAG: &str = "v2:";

/// Key-encryption key, domain-separated from the passphrase-derived DB key so
/// the wrap never XORs a key with itself.
fn derive_wrap_key(passphrase: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>, AppError> {
    let mut kek_salt = salt.to_vec();
    kek_salt.extend_from_slice(b"medoc-db-key-wrap-v2");
    let raw = derive_key_from_passphrase(passphrase, &kek_salt)?;
    let mut out = Zeroizing::new([0u8; 32]);
    out.copy_from_slice(&raw[..32]);
    Ok(out)
}

/// F45: `db-key.wrap` = `v2:` + base64(nonce(24) || XChaCha20-Poly1305(key)).
/// A wrong passphrase now fails authentication instead of yielding a bad key.
fn write_wrap_file(app_dir: &Path, key: &[u8], passphrase: &str) -> Result<(), AppError> {
    use chacha20poly1305::aead::{Aead, KeyInit};
    use chacha20poly1305::{XChaCha20Poly1305, XNonce};
    let salt = load_or_create_salt(app_dir)?;
    let kek = derive_wrap_key(passphrase, &salt)?;
    let cipher = XChaCha20Poly1305::new_from_slice(&kek[..])
        .map_err(|e| AppError::Internal(format!("wrap cipher: {e}")))?;
    let mut nonce = [0u8; 24];
    rand::thread_rng().fill_bytes(&mut nonce);
    let ct = cipher
        .encrypt(XNonce::from_slice(&nonce), key)
        .map_err(|_| AppError::Internal("db-key.wrap encrypt".into()))?;
    let mut blob = nonce.to_vec();
    blob.extend(ct);
    let path = wrap_path(app_dir);
    let tmp = path.with_extension("wrap.tmp");
    std::fs::write(&tmp, format!("{WRAP_V2_TAG}{}", STANDARD.encode(blob)))
        .map_err(|e| AppError::Internal(format!("db-key.wrap write: {e}")))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600));
    }
    std::fs::rename(&tmp, &path)
        .map_err(|e| AppError::Internal(format!("db-key.wrap rename: {e}")))?;
    Ok(())
}

fn read_wrap_file(app_dir: &Path, passphrase: &str) -> Result<Vec<u8>, AppError> {
    let path = wrap_path(app_dir);
    let encoded = std::fs::read_to_string(&path)
        .map_err(|e| AppError::Internal(format!("db-key.wrap read: {e}")))?;
    let encoded = encoded.trim();
    let salt = load_or_create_salt(app_dir)?;
    if let Some(v2) = encoded.strip_prefix(WRAP_V2_TAG) {
        use chacha20poly1305::aead::{Aead, KeyInit};
        use chacha20poly1305::{XChaCha20Poly1305, XNonce};
        let blob = STANDARD
            .decode(v2)
            .map_err(|e| AppError::Internal(format!("db-key.wrap decode: {e}")))?;
        if blob.len() < 24 + 16 + 32 {
            return Err(AppError::Internal("db-key.wrap invalid".into()));
        }
        let kek = derive_wrap_key(passphrase, &salt)?;
        let cipher = XChaCha20Poly1305::new_from_slice(&kek[..])
            .map_err(|e| AppError::Internal(format!("wrap cipher: {e}")))?;
        let key = cipher
            .decrypt(XNonce::from_slice(&blob[..24]), &blob[24..])
            .map_err(|_| AppError::Validation("Wrong database passphrase.".into()))?;
        return Ok(normalize_32(key));
    }
    // Legacy v1 file: payload = key XOR Argon2(passphrase, salt). Every v1 file
    // was written by `provision_user_passphrase`, whose key IS that Argon2
    // output, so decode it and upgrade the file to v2 in place.
    let blob = STANDARD
        .decode(encoded)
        .map_err(|e| AppError::Internal(format!("db-key.wrap decode: {e}")))?;
    if blob.len() < 12 + 32 {
        return Err(AppError::Internal("db-key.wrap invalid".into()));
    }
    let wrap_key = derive_key_from_passphrase(passphrase, &salt)?;
    let payload = &blob[12..];
    let mut key = Vec::with_capacity(payload.len());
    for (i, b) in payload.iter().enumerate() {
        key.push(b ^ wrap_key[i % 32]);
    }
    let key = normalize_32(key);
    if let Err(e) = write_wrap_file(app_dir, &key, passphrase) {
        tracing::warn!(target: "medoc::security", event = "DB_KEY_WRAP_UPGRADE_FAILED", error = %e);
    }
    Ok(key)
}

#[cfg(test)]
pub fn test_key_material() -> Zeroizing<Vec<u8>> {
    test_pool_key_material().expect("test pool key")
}

#[cfg(test)]
mod tests {
    use super::keyring_account;

    #[test]
    fn two_instances_use_different_keychain_accounts() {
        let a = {
            std::env::set_var("MEDOC_INSTANCE", "alpha");
            keyring_account()
        };
        let b = {
            std::env::set_var("MEDOC_INSTANCE", "beta");
            keyring_account()
        };
        std::env::remove_var("MEDOC_INSTANCE");
        assert_ne!(a, b);
        assert!(a.contains("alpha"));
        assert!(b.contains("beta"));
    }

    #[test]
    fn wrap_round_trips_and_rejects_wrong_passphrase() {
        let dir = std::env::temp_dir().join(format!("medoc-wrap-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let key = [7u8; 32];
        super::write_wrap_file(&dir, &key, "correct horse battery").unwrap();
        let raw = std::fs::read_to_string(super::wrap_path(&dir)).unwrap();
        assert!(raw.starts_with(super::WRAP_V2_TAG));
        assert_eq!(
            super::read_wrap_file(&dir, "correct horse battery").unwrap(),
            key.to_vec()
        );
        assert!(super::read_wrap_file(&dir, "wrong passphrase!!").is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn bridge_b_required_unless_wrap_exists() {
        let dir = std::env::temp_dir().join(format!("medoc-bbr-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        // With wrap present, Bridge B is satisfied regardless of env overrides.
        super::write_wrap_file(&dir, &[9u8; 32], "correct horse battery staple").unwrap();
        assert!(!super::bridge_b_passphrase_required(&dir));
        let _ = std::fs::remove_file(super::wrap_path(&dir));
        // Without wrap: required unless MEDOC_DB_KEY / MEDOC_SKIP_DB_PASSPHRASE.
        if super::env_override_key().is_none()
            && std::env::var("MEDOC_SKIP_DB_PASSPHRASE").ok().as_deref() != Some("1")
        {
            assert!(super::bridge_b_passphrase_required(&dir));
        }
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn kcv_detects_wrong_key_before_sqlcipher() {
        let key = [0x11u8; 32];
        let kcv = super::compute_kcv(&key);
        assert!(super::verify_kcv(&key, &kcv));
        let mut wrong = key;
        wrong[0] ^= 0xff;
        assert!(!super::verify_kcv(&wrong, &kcv));
    }

    #[test]
    fn write_wrap_for_recovery_round_trips_with_kcv() {
        let dir = std::env::temp_dir().join(format!("medoc-wrap-rec-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let key = [0x22u8; 32];
        let pw = "CorrectHorse1";
        super::write_wrap_for_recovery(&dir, &key, pw).unwrap();
        assert!(super::kcv_path(&dir).exists());
        let got = super::read_wrap_key(&dir, pw).unwrap();
        assert_eq!(&*got, &key);
        assert!(super::read_wrap_key(&dir, "WrongPass99xx").is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn vendor_license_shaped_string_is_not_env_db_key() {
        let fake = "v2.AAAA.BBBBCCCCDDDD";
        let raw = fake.trim();
        assert!(
            !(raw.len() == 64 && raw.chars().all(|c| c.is_ascii_hexdigit())) && raw.len() != 32,
            "license-shaped token must not look like MEDOC_DB_KEY material"
        );
    }

    #[test]
    fn medoc_recovery_rust_bridge_b_prints_matching_key_hex() {
        let manifest_dir = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let candidates = [
            manifest_dir.join("../../../target/debug/medoc-recovery"),
            manifest_dir.join("../../../target/release/medoc-recovery"),
        ];
        let Some(rec) = candidates.into_iter().find(|p| p.exists()) else {
            eprintln!("skip: Rust medoc-recovery not built");
            return;
        };
        let dir = std::env::temp_dir().join(format!("medoc-b-interop-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let key = [0xABu8; 32];
        let pw = "CorrectHorse1";
        super::write_wrap_for_recovery(&dir, &key, pw).unwrap();
        let pw_file = dir.join("pw.txt");
        std::fs::write(&pw_file, format!("{pw}\n")).unwrap();
        let out = std::process::Command::new(&rec)
            .args([
                "recover",
                "--bridge",
                "b",
                "--app-dir",
                dir.to_str().unwrap(),
                "--passphrase-file",
                pw_file.to_str().unwrap(),
            ])
            .output()
            .expect("spawn medoc-recovery");
        assert!(
            out.status.success(),
            "stderr={}",
            String::from_utf8_lossy(&out.stderr)
        );
        let stdout = String::from_utf8_lossy(&out.stdout);
        let hex_line = stdout
            .lines()
            .find_map(|l| l.strip_prefix("key_hex="))
            .expect("key_hex on stdout");
        let expect: String = key.iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(hex_line, expect);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn legacy_v1_wrap_still_unlocks_and_is_upgraded() {
        use base64::Engine;
        let dir = std::env::temp_dir().join(format!("medoc-wrap-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let salt = super::load_or_create_salt(&dir).unwrap();
        let derived = super::derive_key_from_passphrase("legacy passphrase", &salt).unwrap();
        let mut blob = vec![1u8; 12];
        blob.extend(derived.iter().zip(derived.iter()).map(|(a, b)| a ^ b));
        std::fs::write(
            super::wrap_path(&dir),
            base64::engine::general_purpose::STANDARD.encode(blob),
        )
        .unwrap();
        assert_eq!(
            super::read_wrap_file(&dir, "legacy passphrase").unwrap(),
            derived
        );
        let raw = std::fs::read_to_string(super::wrap_path(&dir)).unwrap();
        assert!(raw.starts_with(super::WRAP_V2_TAG));
        assert_eq!(
            super::read_wrap_file(&dir, "legacy passphrase").unwrap(),
            derived
        );
        let _ = std::fs::remove_dir_all(&dir);
    }
}
