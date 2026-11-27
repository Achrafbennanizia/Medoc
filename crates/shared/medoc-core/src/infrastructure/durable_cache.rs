//! Encrypted cache files that survive a crash or a hard power-off.
//!
//! Small queues that must not be lost (changes made offline, changes being sent) are stored as
//! one file each under `<data dir>/cache/`. A write goes to `<name>.tmp`, is flushed to disk
//! (`fsync`) and then renamed over `<name>.mdc`, so a power cut leaves either the old or the new
//! file, never a torn one. Content is encrypted (XChaCha20-Poly1305) with a key kept in the OS
//! keychain, because the queues hold patient data and the database itself is encrypted too.
//!
//! The owner of a queue deletes its file once the receiver has confirmed every entry (HTTP 2xx).

use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

use chacha20poly1305::aead::{Aead, KeyInit};
use chacha20poly1305::{XChaCha20Poly1305, XNonce};
use serde::de::DeserializeOwned;
use serde::Serialize;
use zeroize::Zeroizing;

use crate::error::AppError;

const MAGIC: &[u8; 4] = b"MDC1";
const NONCE_LEN: usize = 24;
const KEY_ACCOUNT: &str = "durable-cache-key";
/// Tests and headless runs: 64 hex chars instead of the keychain.
const KEY_ENV: &str = "MEDOC_CACHE_KEY_HEX";
/// Overrides the folder (tests, portable installs).
const DIR_ENV: &str = "MEDOC_CACHE_DIR";

static DIR: OnceLock<PathBuf> = OnceLock::new();
static KEY: OnceLock<Zeroizing<[u8; 32]>> = OnceLock::new();
/// One writer at a time per process; queues rewrite their whole file.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

/// Set the cache folder once at start (`<data dir>/cache`). Later calls are ignored.
pub fn init(dir: PathBuf) {
    let _ = DIR.set(dir);
}

fn dir() -> Option<PathBuf> {
    std::env::var(DIR_ENV)
        .ok()
        .filter(|d| !d.trim().is_empty())
        .map(PathBuf::from)
        .or_else(|| DIR.get().cloned())
}

/// `true` once a folder is configured; without one every call is a no-op.
pub fn enabled() -> bool {
    dir().is_some()
}

fn path(name: &str) -> Result<PathBuf, AppError> {
    let ok = !name.is_empty()
        && name.len() <= 64
        && name
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    if !ok {
        return Err(AppError::Validation(format!(
            "cache name not allowed: {name}"
        )));
    }
    let dir = dir().ok_or_else(|| AppError::Internal("cache folder not set".into()))?;
    Ok(dir.join(format!("{name}.mdc")))
}

fn key() -> Result<&'static Zeroizing<[u8; 32]>, AppError> {
    if let Some(k) = KEY.get() {
        return Ok(k);
    }
    let bytes = match std::env::var(KEY_ENV) {
        Ok(hex) => decode_hex(hex.trim())?,
        Err(_) => crate::infrastructure::secret_store::load_or_create_bytes(KEY_ACCOUNT, None, 32)?,
    };
    let arr: [u8; 32] = bytes
        .as_slice()
        .try_into()
        .map_err(|_| AppError::Internal("cache key must be 32 bytes".into()))?;
    Ok(KEY.get_or_init(|| Zeroizing::new(arr)))
}

fn cipher() -> Result<XChaCha20Poly1305, AppError> {
    XChaCha20Poly1305::new_from_slice(key()?.as_slice())
        .map_err(|e| AppError::Internal(format!("cache cipher: {e}")))
}

/// Store `value` durably (replaces the previous content). The name binds the content.
pub fn write<T: Serialize>(name: &str, value: &T) -> Result<(), AppError> {
    let target = path(name)?;
    let plain =
        Zeroizing::new(serde_json::to_vec(value).map_err(|e| AppError::Internal(e.to_string()))?);
    let nonce: [u8; NONCE_LEN] = rand::random();
    let sealed = cipher()?
        .encrypt(
            XNonce::from_slice(&nonce),
            chacha20poly1305::aead::Payload {
                msg: plain.as_slice(),
                aad: name.as_bytes(),
            },
        )
        .map_err(|e| AppError::Internal(format!("cache encrypt: {e}")))?;
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| AppError::Internal("cache lock".into()))?;
    let parent = target.parent().unwrap_or(Path::new("."));
    fs::create_dir_all(parent).map_err(io_err)?;
    let tmp = target.with_extension("tmp");
    {
        let mut f = OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&tmp)
            .map_err(io_err)?;
        f.write_all(MAGIC).map_err(io_err)?;
        f.write_all(&nonce).map_err(io_err)?;
        f.write_all(&sealed).map_err(io_err)?;
        f.sync_all().map_err(io_err)?;
    }
    fs::rename(&tmp, &target).map_err(io_err)?;
    sync_dir(parent);
    Ok(())
}

/// The stored value, `None` when there is none. An unreadable file is set aside as
/// `<name>.corrupt` (kept for support) and treated as empty.
pub fn read<T: DeserializeOwned>(name: &str) -> Result<Option<T>, AppError> {
    let target = path(name)?;
    let Ok(bytes) = fs::read(&target) else {
        return Ok(None);
    };
    match open(name, &bytes) {
        Some(v) => Ok(Some(v)),
        None => {
            tracing::error!(target: "medoc::system", event = "DURABLE_CACHE_UNREADABLE", name);
            let _ = fs::rename(&target, target.with_extension("corrupt"));
            Ok(None)
        }
    }
}

fn open<T: DeserializeOwned>(name: &str, bytes: &[u8]) -> Option<T> {
    if bytes.len() < MAGIC.len() + NONCE_LEN || &bytes[..4] != MAGIC {
        return None;
    }
    let (nonce, ct) = bytes[4..].split_at(NONCE_LEN);
    let plain = cipher()
        .ok()?
        .decrypt(
            XNonce::from_slice(nonce),
            chacha20poly1305::aead::Payload {
                msg: ct,
                aad: name.as_bytes(),
            },
        )
        .ok()?;
    let plain = Zeroizing::new(plain);
    serde_json::from_slice(&plain).ok()
}

/// Delete the file: call once every entry was confirmed by the receiver.
pub fn clear(name: &str) -> Result<(), AppError> {
    let target = path(name)?;
    let _guard = WRITE_LOCK
        .lock()
        .map_err(|_| AppError::Internal("cache lock".into()))?;
    match fs::remove_file(&target) {
        Ok(()) => {
            sync_dir(target.parent().unwrap_or(Path::new(".")));
            Ok(())
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(io_err(e)),
    }
}

/// The rename itself must reach the disk (POSIX); Windows commits it with the file.
fn sync_dir(dir: &Path) {
    #[cfg(unix)]
    if let Ok(d) = File::open(dir) {
        let _ = d.sync_all();
    }
    #[cfg(not(unix))]
    let _ = dir;
}

fn io_err(e: std::io::Error) -> AppError {
    AppError::Internal(format!("cache file: {e}"))
}

fn decode_hex(hex: &str) -> Result<Vec<u8>, AppError> {
    if !hex.len().is_multiple_of(2) {
        return Err(AppError::Validation(format!("{KEY_ENV} must be hex")));
    }
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16))
        .collect::<Result<_, _>>()
        .map_err(|_| AppError::Validation(format!("{KEY_ENV} must be hex")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("medoc-cache-{}", uuid::Uuid::new_v4()));
        std::env::set_var(DIR_ENV, &dir);
        std::env::set_var(KEY_ENV, "11".repeat(32));
        dir
    }

    #[test]
    fn round_trip_overwrite_clear_and_corrupt_file() {
        let dir = setup();
        assert_eq!(read::<Vec<String>>("queue-a").unwrap(), None);
        write("queue-a", &vec!["one".to_string()]).unwrap();
        write("queue-a", &vec!["one".to_string(), "two".to_string()]).unwrap();
        assert_eq!(read::<Vec<String>>("queue-a").unwrap().unwrap().len(), 2);
        // Encrypted on disk: the plain text is not in the file.
        let raw = fs::read(dir.join("queue-a.mdc")).unwrap();
        assert!(!raw.windows(3).any(|w| w == b"two"));
        // Content is bound to its name: a file copied under another name does not open.
        fs::copy(dir.join("queue-a.mdc"), dir.join("queue-b.mdc")).unwrap();
        assert_eq!(read::<Vec<String>>("queue-b").unwrap(), None);
        assert!(dir.join("queue-b.corrupt").exists());
        clear("queue-a").unwrap();
        assert_eq!(read::<Vec<String>>("queue-a").unwrap(), None);
        assert!(path("../escape").is_err());
        let _ = fs::remove_dir_all(dir);
    }
}
