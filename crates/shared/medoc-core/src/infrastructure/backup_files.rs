//! Attachments in backups, the backup folder setting, and the background worker.
//!
//! Attachments (X-rays, scans, PDFs under `chart_attachments/`) never change after they are
//! added, and can be large. So each backup folder keeps ONE encrypted copy of every file in
//! `files/<sha256>.bin` (AES-256-GCM, backup key), and each backup has a signed list of the
//! files it covers: `<backup>.files.json` (+ `.sig`). A new backup only encrypts files that are
//! new since the last one; rotation then deletes copies no remaining backup lists. The list
//! holds storage paths and hashes only (ids, no names).
//!
//! Folder: Settings → Backups can point backups to another folder, e.g. a USB stick or an
//! external drive, so a disk failure does not take the backups with it. If that folder is
//! missing when a backup runs (stick not plugged in), the backup goes to this computer's
//! default folder and the page says so.
//!
//! Worker: compressing, encrypting and copying run on a dedicated thread with background
//! priority (macOS QoS "utility", Linux nice 10), so the practice keeps working at full speed.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::AppError;
use crate::log_system;

/// app_kv: chosen backup folder (`{"path": "..."}`; absent = default folder).
pub const DIR_KV_KEY: &str = "backup.dir.v1";
/// Folder of the shared encrypted attachment copies inside a backup folder.
pub const FILES_DIR: &str = "files";
const FILE_MAGIC: &[u8; 8] = b"MEDOCBF1";

static DIR_OVERRIDE: RwLock<Option<PathBuf>> = RwLock::new(None);

/// The built-in folder on this computer (`MEDOC_BACKUP_DIR` in tests and dev).
pub fn default_backup_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("MEDOC_BACKUP_DIR") {
        return PathBuf::from(dir);
    }
    dirs::home_dir()
        .map(|h| h.join("medoc-data").join("backups"))
        .unwrap_or_else(|| PathBuf::from("./medoc-data/backups"))
}

/// The folder chosen in Settings, if any.
pub fn chosen_backup_dir() -> Option<PathBuf> {
    DIR_OVERRIDE.read().ok().and_then(|g| g.clone())
}

pub fn set_chosen_backup_dir(dir: Option<PathBuf>) {
    if let Ok(mut g) = DIR_OVERRIDE.write() {
        *g = dir;
    }
}

/// Where backups go now: the chosen folder while it exists (a plugged-in drive), otherwise the
/// default folder. `true` in the second value = the chosen folder is missing (fallback).
pub fn active_backup_dir() -> (PathBuf, bool) {
    match chosen_backup_dir() {
        Some(dir) if dir.is_dir() => (dir, false),
        Some(_) => (default_backup_dir(), true),
        None => (default_backup_dir(), false),
    }
}

/// A folder on a removable or external volume (USB stick, external disk, network share).
pub fn is_external_location(dir: &Path) -> bool {
    let s = dir.to_string_lossy();
    if cfg!(target_os = "macos") {
        return s.starts_with("/Volumes/");
    }
    if cfg!(target_os = "windows") {
        let sys = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".into());
        return !s
            .to_ascii_uppercase()
            .starts_with(&sys.to_ascii_uppercase());
    }
    s.starts_with("/media/") || s.starts_with("/run/media/") || s.starts_with("/mnt/")
}

/// Checks a folder chosen as backup target: creates it, and proves it is writable.
pub fn validate_target_dir(dir: &Path) -> Result<(), AppError> {
    if !dir.is_absolute() {
        return Err(AppError::validation_code("error.backup.folder_invalid"));
    }
    std::fs::create_dir_all(dir).map_err(|e| {
        log_system!(warn, event = "BACKUP_DIR_REFUSED", path = %dir.display(), detail = %e);
        AppError::validation_code("error.backup.folder_not_writable")
    })?;
    let probe = dir.join(".medoc-write-test");
    std::fs::write(&probe, b"ok")
        .and_then(|_| std::fs::remove_file(&probe))
        .map_err(|e| {
            log_system!(warn, event = "BACKUP_DIR_REFUSED", path = %dir.display(), detail = %e);
            AppError::validation_code("error.backup.folder_not_writable")
        })
}

/// Reads the saved folder setting (app start, after a restore).
pub async fn load_dir_setting(pool: &sqlx::SqlitePool) {
    let value = crate::infrastructure::database::repos::admin::app_kv::get(pool, DIR_KV_KEY)
        .await
        .ok()
        .flatten()
        .and_then(|v| serde_json::from_str::<serde_json::Value>(&v).ok())
        .and_then(|v| v.get("path").and_then(|p| p.as_str()).map(PathBuf::from))
        .filter(|p| !p.as_os_str().is_empty());
    set_chosen_backup_dir(value);
}

// ---------------------------------------------------------------------------
// Background worker
// ---------------------------------------------------------------------------

/// Lowers the CPU and I/O priority of the current (dedicated) thread.
fn background_priority() {
    #[cfg(target_os = "macos")]
    unsafe {
        libc::pthread_set_qos_class_self_np(libc::qos_class_t::QOS_CLASS_UTILITY, 0);
    }
    #[cfg(target_os = "linux")]
    unsafe {
        libc::setpriority(libc::PRIO_PROCESS, libc::gettid() as libc::id_t, 10);
    }
}

/// Runs heavy backup work on its own low-priority thread (not the async runtime, not the UI).
pub async fn run_in_background<T, F>(f: F) -> Result<T, AppError>
where
    F: FnOnce() -> Result<T, AppError> + Send + 'static,
    T: Send + 'static,
{
    let (tx, rx) = tokio::sync::oneshot::channel();
    std::thread::Builder::new()
        .name("medoc-backup".into())
        .spawn(move || {
            background_priority();
            let _ = tx.send(f());
        })
        .map_err(|e| AppError::Internal(format!("backup worker: {e}")))?;
    rx.await
        .map_err(|_| AppError::Internal("backup worker stopped".into()))?
}

// ---------------------------------------------------------------------------
// Attachment store
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileRef {
    /// Relative to the app data folder, e.g. `chart_attachments/<chart>/<id>.jpg`.
    pub rel: String,
    pub sha256: String,
    pub size: u64,
    /// Seconds since the epoch; with `size` lets the next backup skip re-reading the file.
    pub mtime: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct FileManifest {
    pub version: u32,
    pub files: Vec<FileRef>,
}

/// `<backup>.files.json` next to a backup.
pub fn manifest_path(backup: &Path) -> PathBuf {
    PathBuf::from(format!("{}.files.json", backup.display()))
}

fn blob_path(dir: &Path, sha: &str) -> PathBuf {
    dir.join(FILES_DIR).join(format!("{sha}.bin"))
}

fn mtime_secs(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Attachment files under the app data folder (thumbnails are rebuilt on their own, skipped).
fn collect_attachments(app_data_dir: &Path) -> Vec<(String, PathBuf)> {
    fn walk(dir: &Path, root: &Path, out: &mut Vec<(String, PathBuf)>) {
        let Ok(rd) = std::fs::read_dir(dir) else {
            return;
        };
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                walk(&p, root, out);
                continue;
            }
            let name = p
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default();
            if name.ends_with(".thumb.jpg") || name.ends_with(".part") || name.starts_with('.') {
                continue;
            }
            if let Ok(rel) = p.strip_prefix(root) {
                let rel = rel.to_string_lossy().replace('\\', "/");
                out.push((rel, p));
            }
        }
    }
    let mut out = Vec::new();
    walk(
        &app_data_dir.join("chart_attachments"),
        app_data_dir,
        &mut out,
    );
    out.sort();
    out
}

fn seal_file(data: &[u8], key: &[u8]) -> Result<Vec<u8>, AppError> {
    use aes_gcm::aead::{Aead, AeadCore, OsRng, Payload};
    let nonce = aes_gcm::Aes256Gcm::generate_nonce(&mut OsRng);
    let sealed = super::backup::backup_cipher(key)
        .encrypt(
            &nonce,
            Payload {
                msg: data,
                aad: FILE_MAGIC,
            },
        )
        .map_err(|_| AppError::validation_code("error.backup.compress_failed"))?;
    let mut out = Vec::with_capacity(FILE_MAGIC.len() + nonce.len() + sealed.len());
    out.extend_from_slice(FILE_MAGIC);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&sealed);
    Ok(out)
}

fn unseal_file(file: &[u8], key: &[u8]) -> Result<Vec<u8>, AppError> {
    use aes_gcm::aead::{Aead, Payload};
    if file.len() < FILE_MAGIC.len() + 12 || &file[..FILE_MAGIC.len()] != FILE_MAGIC {
        return Err(AppError::validation_code("error.backup.not_an_archive"));
    }
    let (nonce, sealed) = file[FILE_MAGIC.len()..].split_at(12);
    super::backup::backup_cipher(key)
        .decrypt(
            aes_gcm::Nonce::from_slice(nonce),
            Payload {
                msg: sealed,
                aad: FILE_MAGIC,
            },
        )
        .map_err(|_| AppError::validation_code("error.backup.decrypt_failed"))
}

/// The newest list in this folder: its hashes let unchanged files skip re-reading.
fn latest_manifest(dir: &Path) -> HashMap<String, FileRef> {
    let mut lists: Vec<PathBuf> = std::fs::read_dir(dir)
        .map(|rd| {
            rd.flatten()
                .map(|e| e.path())
                .filter(|p| p.to_string_lossy().ends_with(".files.json"))
                .collect()
        })
        .unwrap_or_default();
    lists.sort();
    lists
        .last()
        .and_then(|p| read_manifest(p).ok())
        .map(|m| m.files.into_iter().map(|f| (f.rel.clone(), f)).collect())
        .unwrap_or_default()
}

pub fn read_manifest(path: &Path) -> Result<FileManifest, AppError> {
    let raw = std::fs::read(path)
        .map_err(|_| AppError::validation_code("error.backup.file_not_found"))?;
    serde_json::from_slice(&raw)
        .map_err(|_| AppError::validation_code("error.backup.not_an_archive"))
}

fn write_manifest(path: &Path, m: &FileManifest) -> Result<(), AppError> {
    let json = serde_json::to_vec_pretty(m).map_err(|e| AppError::Internal(e.to_string()))?;
    let part = PathBuf::from(format!("{}.part", path.display()));
    std::fs::write(&part, json)
        .and_then(|_| std::fs::rename(&part, path))
        .map_err(|e| {
            log_system!(error, event = "BACKUP_FILES_LIST_FAILED", detail = %e);
            AppError::validation_code("error.backup.write_failed")
        })?;
    super::backup::sign_file(path)
}

/// Copies new attachments into the folder's shared store and writes the backup's file list.
/// Blocking: call through [`run_in_background`]. Returns (files listed, files newly stored).
pub fn back_up_attachments(
    app_data_dir: &Path,
    backup: &Path,
    key: &[u8],
) -> Result<(usize, usize), AppError> {
    let dir = backup.parent().unwrap_or(Path::new("."));
    std::fs::create_dir_all(dir.join(FILES_DIR)).map_err(|e| {
        log_system!(error, event = "BACKUP_FILES_DIR_FAILED", detail = %e);
        AppError::validation_code("error.backup.write_failed")
    })?;
    let previous = latest_manifest(dir);
    let mut manifest = FileManifest {
        version: 1,
        files: Vec::new(),
    };
    let mut stored = 0usize;
    for (rel, abs) in collect_attachments(app_data_dir) {
        let Ok(meta) = std::fs::metadata(&abs) else {
            continue;
        };
        let (size, mtime) = (meta.len(), mtime_secs(&meta));
        let reuse = previous
            .get(&rel)
            .filter(|f| f.size == size && f.mtime == mtime && blob_path(dir, &f.sha256).is_file());
        let sha = if let Some(f) = reuse {
            f.sha256.clone()
        } else {
            let data = match std::fs::read(&abs) {
                Ok(d) => d,
                Err(e) => {
                    // A file removed while the backup runs is not an error of the backup.
                    log_system!(warn, event = "BACKUP_FILE_SKIPPED", file = %rel, detail = %e);
                    continue;
                }
            };
            let sha = hex::encode(Sha256::digest(&data));
            let blob = blob_path(dir, &sha);
            if !blob.is_file() {
                let sealed = seal_file(&data, key)?;
                let part = blob.with_extension("bin.part");
                std::fs::write(&part, &sealed)
                    .and_then(|_| std::fs::rename(&part, &blob))
                    .map_err(|e| {
                        let _ = std::fs::remove_file(&part);
                        log_system!(error, event = "BACKUP_FILE_WRITE_FAILED", file = %rel, detail = %e);
                        if e.kind() == std::io::ErrorKind::StorageFull {
                            AppError::validation_code("error.backup.disk_full")
                        } else {
                            AppError::validation_code("error.backup.write_failed")
                        }
                    })?;
                stored += 1;
            }
            sha
        };
        manifest.files.push(FileRef {
            rel,
            sha256: sha,
            size,
            mtime,
        });
    }
    write_manifest(&manifest_path(backup), &manifest)?;
    log_system!(
        info,
        event = "BACKUP_FILES",
        listed = manifest.files.len(),
        stored
    );
    Ok((manifest.files.len(), stored))
}

/// The file list of a backup, read and verified before a restore changes anything (the safety
/// backup taken during the restore runs rotation, which may delete the list).
pub fn load_restore_list(backup: &Path) -> Result<Option<(PathBuf, FileManifest)>, AppError> {
    let list = manifest_path(backup);
    if !list.is_file() {
        return Ok(None); // backup made before attachments were included
    }
    if super::backup::signature_ok(&list) != Some(true) {
        return Err(AppError::validation_code("error.backup.signature_invalid"));
    }
    let dir = backup.parent().unwrap_or(Path::new(".")).to_path_buf();
    Ok(Some((dir, read_manifest(&list)?)))
}

/// Puts back attachments the restored backup lists and that are missing (or changed) here.
/// Files that are not in the list stay where they are (nothing is deleted). Blocking.
pub fn restore_attachments(
    app_data_dir: &Path,
    dir: &Path,
    list: &FileManifest,
    key: &[u8],
) -> Result<usize, AppError> {
    let mut restored = 0usize;
    for f in &list.files {
        if f.rel.contains("..")
            || Path::new(&f.rel).is_absolute()
            || !f.rel.starts_with("chart_attachments/")
        {
            continue; // never write outside the attachment folder
        }
        let target = app_data_dir.join(&f.rel);
        if std::fs::metadata(&target)
            .map(|m| m.len() == f.size)
            .unwrap_or(false)
        {
            continue;
        }
        let sealed = std::fs::read(blob_path(dir, &f.sha256)).map_err(|e| {
            log_system!(error, event = "BACKUP_FILE_MISSING", file = %f.rel, detail = %e);
            AppError::validation_code("error.backup.read_failed")
        })?;
        let data = unseal_file(&sealed, key)?;
        if let Some(parent) = target.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let part = PathBuf::from(format!("{}.part", target.display()));
        std::fs::write(&part, &data)
            .and_then(|_| std::fs::rename(&part, &target))
            .map_err(|e| {
                log_system!(error, event = "BACKUP_FILE_RESTORE_FAILED", file = %f.rel, detail = %e);
                AppError::validation_code("error.backup.restore_failed")
            })?;
        restored += 1;
    }
    log_system!(warn, event = "BACKUP_FILES_RESTORED", restored);
    Ok(restored)
}

/// Deletes stored copies that no backup list in this folder still mentions.
pub fn collect_garbage(dir: &Path) -> usize {
    let store = dir.join(FILES_DIR);
    if !store.is_dir() {
        return 0;
    }
    let mut keep: HashSet<String> = HashSet::new();
    if let Ok(rd) = std::fs::read_dir(dir) {
        for p in rd.flatten().map(|e| e.path()) {
            if p.to_string_lossy().ends_with(".files.json") {
                match read_manifest(&p) {
                    Ok(m) => keep.extend(m.files.into_iter().map(|f| f.sha256)),
                    // An unreadable list: keep everything rather than lose a file.
                    Err(_) => return 0,
                }
            }
        }
    }
    let mut removed = 0;
    if let Ok(rd) = std::fs::read_dir(&store) {
        for p in rd.flatten().map(|e| e.path()) {
            let stem = p
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            if p.extension().and_then(|e| e.to_str()) == Some("bin")
                && !keep.contains(&stem)
                && std::fs::remove_file(&p).is_ok()
            {
                removed += 1;
            }
        }
    }
    if removed > 0 {
        log_system!(info, event = "BACKUP_FILES_PRUNED", removed);
    }
    removed
}

/// GDPR erasure: drops a patient's attachments from every backup list, then their copies.
pub fn forget_charts(dir: &Path, chart_ids: &[String]) -> Result<usize, AppError> {
    if chart_ids.is_empty() || !dir.is_dir() {
        return Ok(0);
    }
    let prefixes: Vec<String> = chart_ids
        .iter()
        .map(|c| format!("chart_attachments/{c}/"))
        .collect();
    let mut changed = 0;
    for p in std::fs::read_dir(dir)
        .map_err(|_| AppError::validation_code("error.backup.folder_unavailable"))?
        .flatten()
        .map(|e| e.path())
    {
        if !p.to_string_lossy().ends_with(".files.json") {
            continue;
        }
        let mut m = read_manifest(&p)?;
        let before = m.files.len();
        m.files
            .retain(|f| !prefixes.iter().any(|pre| f.rel.starts_with(pre)));
        if m.files.len() != before {
            write_manifest(&p, &m)?;
            changed += 1;
        }
    }
    collect_garbage(dir);
    Ok(changed)
}

/// Total stored attachment copies in a folder (count, bytes) for Settings → Backups.
pub fn store_usage(dir: &Path) -> (u64, u64) {
    let Ok(rd) = std::fs::read_dir(dir.join(FILES_DIR)) else {
        return (0, 0);
    };
    rd.flatten()
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .fold((0, 0), |(n, b), m| (n + 1, b + m.len()))
}
