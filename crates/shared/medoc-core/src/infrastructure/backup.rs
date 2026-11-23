// Backup & restore (NFA-SEC-08, supports DSGVO + system continuity).
//
// Format (`.mdbk`, current): a consistent in-memory image of the database
// (`sqlcipher_export` into an attached `:memory:` database, then `sqlite3_serialize`),
// gzip-compressed, then sealed with AES-256-GCM under a key derived from the database
// key. Patient data never touches the disk unencrypted, and the file is far smaller than
// the encrypted database (encrypted pages do not compress; the plain image does).
// Legacy `.db` files (`VACUUM INTO`, still used for the pre-restore safety snapshot)
// stay readable and restorable.
//
// Retention (tiers): the newest backup of each of the last 3 days, the last backup of the
// previous ISO week, and the last backup of the previous half-year (Jan–Jun / Jul–Dec).
// While the practice is too new to have those, the oldest backup stands in for them.
// Everything else is deleted after each new backup, so the disk does not fill up.
// Each file gets an HMAC sidecar `*.sig` using the audit-chain key.

use chrono::{DateTime, Datelike, Duration, NaiveDateTime, Utc};
use serde::Serialize;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::{db_key, sqlcipher};
use crate::log_system;

/// Days with a kept daily backup.
pub const DAILY_KEEP: usize = 3;
/// Extension of the compressed, encrypted backup format.
pub const COMPRESSED_EXT: &str = "mdbk";
const MDBK_MAGIC: &[u8; 8] = b"MEDOCBK2";
/// app_kv: automatic backup schedule (`{"enabled": bool, "changedBy", "changedAt", "reason"}`).
pub const SCHEDULE_KV_KEY: &str = "backup.schedule.v1";

// ---------------------------------------------------------------------------
// Errors and the one-operation-at-a-time lock
// ---------------------------------------------------------------------------
//
// Every way a backup action can fail has its own `error.backup.*` key, so the user sees what
// went wrong (and support gets an `MD-BAK-…` code from the catalog). The technical detail is
// never shown: it goes to the app log (`medoc::system`) under a short reference that the
// message quotes, so support can find the exact line.

/// One backup operation at a time: the automatic run, a manual backup, a restore or a delete.
static OPERATION: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

/// Claims the backup folder for one operation, or `error.backup.busy` while another one runs.
pub fn begin_operation() -> Result<tokio::sync::MutexGuard<'static, ()>, AppError> {
    OPERATION.try_lock().map_err(|_| {
        log_system!(warn, event = "BACKUP_BUSY");
        AppError::validation_code("error.backup.busy")
    })
}

/// Coded failure: logged with its detail and a reference, returned as `key|ref=…`.
fn fail(key: &str, event: &'static str, detail: impl std::fmt::Display) -> AppError {
    let r = crate::error::correlation_ref();
    log_system!(error, event, code = key, error_ref = %r, detail = %detail);
    AppError::validation_code_params(key, &[("ref", r)])
}

/// File-system failure: a full disk and missing permissions get their own message.
fn io_fail(key: &str, event: &'static str, e: std::io::Error) -> AppError {
    match e.kind() {
        std::io::ErrorKind::StorageFull => fail("error.backup.disk_full", event, e),
        std::io::ErrorKind::PermissionDenied => fail("error.backup.no_permission", event, e),
        _ => fail(key, event, e),
    }
}

/// The practice key is needed to seal and open backups.
fn backup_key(app_data_dir: &Path) -> Result<zeroize::Zeroizing<Vec<u8>>, AppError> {
    db_key::ensure_sqlcipher_key(app_data_dir, false)
        .map_err(|e| fail("error.backup.key_unavailable", "BACKUP_KEY_UNAVAILABLE", e))
}

/// Why a kept backup is kept (shown in Settings → Backups).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum BackupTier {
    Daily,
    Weekly,
    HalfYear,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub path: PathBuf,
    pub size_bytes: u64,
    /// `None` = no `.sig` sidecar (legacy backup); `Some` = verification result.
    pub signature_ok: Option<bool>,
    /// From the file name; `None` for files that do not follow the naming scheme.
    pub created_at: Option<DateTime<Utc>>,
    /// `.mdbk` (compressed) or legacy `.db`.
    pub compressed: bool,
    /// Tiers this backup is kept for (empty: will go at the next rotation).
    pub tiers: Vec<BackupTier>,
}

#[derive(Debug, Serialize)]
pub struct BackupRetentionReport {
    pub scanned: usize,
    pub kept: usize,
    pub deleted: Vec<String>,
    pub errors: Vec<String>,
}

pub fn backup_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("MEDOC_BACKUP_DIR") {
        return PathBuf::from(dir);
    }
    dirs::home_dir()
        .map(|h| h.join("medoc-data").join("backups"))
        .unwrap_or_else(|| PathBuf::from("./medoc-data/backups"))
}

fn sig_path(db_path: &Path) -> PathBuf {
    PathBuf::from(format!("{}.sig", db_path.display()))
}

/// Parse `medoc-YYYYMMDDTHHMMSSZ.db` timestamp from a backup path (for tests / ops tooling).
pub fn parse_backup_timestamp(path: &Path) -> Option<DateTime<Utc>> {
    let stem = path.file_stem()?.to_str()?;
    let ts = stem.strip_prefix("medoc-")?;
    // Same-second snapshots get a `-N` suffix (see `create_with_app_dir`).
    let ts = ts.split_once('-').map_or(ts, |(head, _)| head);
    let naive = NaiveDateTime::parse_from_str(ts, "%Y%m%dT%H%M%SZ").ok()?;
    Some(DateTime::from_naive_utc_and_offset(naive, Utc))
}

/// Sign a backup file (integration tests + manual repair).
pub fn sign_file(db_path: &Path) -> Result<(), AppError> {
    write_signature(db_path)
}

fn write_signature(db_path: &Path) -> Result<(), AppError> {
    let hmac = audit_repo::hmac_file(db_path)
        .map_err(|e| fail("error.backup.write_failed", "BACKUP_SIGNATURE_FAILED", e))?;
    let sig = sig_path(db_path);
    std::fs::write(&sig, format!("{hmac}\n")).map_err(|e| {
        io_fail(
            "error.backup.write_failed",
            "BACKUP_SIGNATURE_WRITE_FAILED",
            e,
        )
    })?;
    Ok(())
}

fn verify_signature(db_path: &Path) -> Option<bool> {
    let sig = sig_path(db_path);
    let expected = std::fs::read_to_string(&sig).ok()?;
    audit_repo::verify_file_hmac(db_path, &expected).ok()
}

/// Create a timestamped backup of the live database.
pub async fn create(pool: &SqlitePool) -> Result<PathBuf, AppError> {
    create_with_app_dir(pool, None).await
}

/// Create a backup and, when `app_data_dir` is set, copy Bridge B recovery
/// sidecars (`db-key.wrap`, `db-key.salt`, `db-key.kcv`) beside the snapshot.
pub async fn create_with_app_dir(
    pool: &SqlitePool,
    app_data_dir: Option<&Path>,
) -> Result<PathBuf, AppError> {
    let dir = backup_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|e| io_fail("error.backup.folder_unavailable", "BACKUP_DIR_FAILED", e))?;

    let ts = Utc::now().format("%Y%m%dT%H%M%SZ");
    // Two snapshots in the same second (e.g. a manual backup followed by the pre-restore safety
    // snapshot) must not collide: `VACUUM INTO` refuses to overwrite an existing file.
    let mut target = dir.join(format!("medoc-{ts}.db"));
    let mut n = 1u32;
    while target.exists() {
        target = dir.join(format!("medoc-{ts}-{n}.db"));
        n += 1;
    }

    log_system!(info, event = "BACKUP_START", target = %target.display());

    let path_lit = target
        .to_string_lossy()
        .replace('\\', "/")
        .replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{path_lit}'"))
        .execute(pool)
        .await
        .map_err(|e| fail("error.backup.snapshot_failed", "BACKUP_FAILED", e))?;

    write_signature(&target)?;
    if let Some(app_dir) = app_data_dir {
        copy_recovery_sidecars(app_dir, &target);
    }
    enforce_retention(&dir)?;

    let size = std::fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
    log_system!(info, event = "BACKUP_COMPLETE", target = %target.display(), bytes = size);

    Ok(target)
}

/// Copy wrap/salt/kcv next to `backup_db` as `backup_db.db-key.*` so Bridge B
/// survives restore when the keychain is empty.
fn copy_recovery_sidecars(app_data_dir: &Path, backup_db: &Path) {
    for name in db_key::recovery_sidecar_names() {
        let src = app_data_dir.join(name);
        if !src.exists() {
            continue;
        }
        let dest = PathBuf::from(format!("{}.{}", backup_db.display(), name));
        if let Err(e) = std::fs::copy(&src, &dest) {
            log_system!(
                warn,
                event = "BACKUP_SIDECAR_COPY_FAILED",
                file = %name,
                error = %e
            );
        } else {
            log_system!(info, event = "BACKUP_SIDECAR_COPIED", file = %name);
        }
    }
}

/// List all backup files (newest first), verifying each signed file's HMAC (reads every file).
pub fn list() -> Result<Vec<BackupEntry>, AppError> {
    list_entries(true)
}

/// Same files as [`list`], but only metadata: no file is read, `signature_ok` is `None`
/// ("not checked", never "bad"). For quick status views such as Help → About.
pub fn list_metadata() -> Result<Vec<BackupEntry>, AppError> {
    list_entries(false)
}

fn list_entries(verify: bool) -> Result<Vec<BackupEntry>, AppError> {
    let dir = backup_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut entries: Vec<BackupEntry> = std::fs::read_dir(&dir)
        .map_err(|e| io_fail("error.backup.folder_unavailable", "BACKUP_LIST_FAILED", e))?
        .filter_map(|e| e.ok())
        .filter(|e| is_backup_file(&e.path()))
        .map(|e| {
            let path = e.path();
            let size_bytes = e.metadata().map(|m| m.len()).unwrap_or(0);
            let signature_ok = if verify && sig_path(&path).exists() {
                verify_signature(&path)
            } else {
                None
            };
            BackupEntry {
                created_at: parse_backup_timestamp(&path),
                compressed: is_compressed(&path),
                path,
                size_bytes,
                signature_ok,
                tiers: Vec::new(),
            }
        })
        .collect();
    let dated: Vec<(PathBuf, DateTime<Utc>)> = entries
        .iter()
        .filter_map(|e| e.created_at.map(|t| (e.path.clone(), t)))
        .collect();
    let tiers = classify(&dated, chrono::Local::now());
    for e in &mut entries {
        if let Some(t) = tiers.get(&e.path) {
            e.tiers = t.clone();
        }
    }
    entries.sort_by(|a, b| {
        b.created_at
            .cmp(&a.created_at)
            .then_with(|| b.path.cmp(&a.path))
    });
    Ok(entries)
}

/// Tiered retention (see the module comment); deletes every backup no tier keeps.
pub fn enforce_retention(dir: &Path) -> Result<BackupRetentionReport, AppError> {
    enforce_retention_at(dir, chrono::Local::now())
}

pub fn enforce_retention_at(
    dir: &Path,
    now: DateTime<chrono::Local>,
) -> Result<BackupRetentionReport, AppError> {
    let mut report = BackupRetentionReport {
        scanned: 0,
        kept: 0,
        deleted: Vec::new(),
        errors: Vec::new(),
    };
    let mut files: Vec<(PathBuf, DateTime<Utc>)> = Vec::new();
    if dir.exists() {
        let rd = std::fs::read_dir(dir).map_err(|e| {
            io_fail(
                "error.backup.folder_unavailable",
                "BACKUP_RETENTION_FAILED",
                e,
            )
        })?;
        for entry in rd.flatten() {
            let path = entry.path();
            if !is_backup_file(&path) {
                continue;
            }
            report.scanned += 1;
            match parse_backup_timestamp(&path) {
                Some(ts) => files.push((path, ts)),
                // Never delete a file whose age is unknown.
                None => report
                    .errors
                    .push(format!("Timestamp not readable: {}", path.display())),
            }
        }
    }
    let keep = classify(&files, now);
    report.kept = keep.len();
    for (path, _) in files {
        if keep.contains_key(&path) {
            continue;
        }
        for p in backup_and_sidecars(&path) {
            match std::fs::remove_file(&p) {
                Ok(()) => report.deleted.push(
                    p.file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .into_owned(),
                ),
                Err(e) => report.errors.push(format!("{}: {e}", p.display())),
            }
        }
    }
    for name in &report.deleted {
        log_system!(info, event = "BACKUP_ROTATED_OUT", file = %name);
    }
    for err in &report.errors {
        log_system!(warn, event = "BACKUP_RETENTION_ERROR", detail = %err);
    }
    log_system!(
        info,
        event = "BACKUP_RETENTION",
        scanned = report.scanned,
        kept = report.kept,
        deleted = report.deleted.len(),
        errors = report.errors.len(),
    );
    Ok(report)
}

/// Which backups each tier keeps, judged in the practice's local time.
pub fn classify(
    files: &[(PathBuf, DateTime<Utc>)],
    now: DateTime<chrono::Local>,
) -> HashMap<PathBuf, Vec<BackupTier>> {
    use chrono::{Local, NaiveDate};
    let mut sorted: Vec<(PathBuf, chrono::DateTime<Local>)> = files
        .iter()
        .map(|(p, t)| (p.clone(), t.with_timezone(&Local)))
        .collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| b.0.cmp(&a.0)));
    let mut out: HashMap<PathBuf, Vec<BackupTier>> = HashMap::new();
    let mut add = |p: &PathBuf, t: BackupTier| {
        let v = out.entry(p.clone()).or_default();
        if !v.contains(&t) {
            v.push(t);
        }
    };

    // Daily: the newest backup of each of the last DAILY_KEEP days that have one.
    let mut days: Vec<NaiveDate> = Vec::new();
    for (p, t) in &sorted {
        let d = t.date_naive();
        if days.contains(&d) {
            continue;
        }
        if days.len() == DAILY_KEEP {
            break;
        }
        days.push(d);
        add(p, BackupTier::Daily);
    }

    let today = now.date_naive();
    let oldest = sorted.last().map(|(p, _)| p.clone());
    let newest_in = |from: NaiveDate, to: NaiveDate| {
        sorted
            .iter()
            .find(|(_, t)| t.date_naive() >= from && t.date_naive() < to)
            .map(|(p, _)| p.clone())
    };

    // Weekly: the last backup of the previous ISO week.
    let monday = today - Duration::days(i64::from(today.weekday().num_days_from_monday()));
    let weekly = newest_in(monday - Duration::days(7), monday).or_else(|| oldest.clone());
    if let Some(p) = weekly {
        add(&p, BackupTier::Weekly);
    }

    // Half-year: the last backup of the previous half (Jan–Jun or Jul–Dec).
    let half_start =
        NaiveDate::from_ymd_opt(today.year(), if today.month() <= 6 { 1 } else { 7 }, 1)
            .unwrap_or(today);
    let prev_start = if half_start.month() == 1 {
        NaiveDate::from_ymd_opt(half_start.year() - 1, 7, 1)
    } else {
        NaiveDate::from_ymd_opt(half_start.year(), 1, 1)
    }
    .unwrap_or(half_start);
    let half = newest_in(prev_start, half_start).or(oldest);
    if let Some(p) = half {
        add(&p, BackupTier::HalfYear);
    }
    out
}

fn is_backup_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|s| s.to_str()),
        Some("db") | Some(COMPRESSED_EXT)
    )
}

fn is_compressed(path: &Path) -> bool {
    path.extension().and_then(|s| s.to_str()) == Some(COMPRESSED_EXT)
}

/// The backup file plus every sidecar named after it (`.sig`, recovery key files).
fn backup_and_sidecars(path: &Path) -> Vec<PathBuf> {
    let mut out = vec![path.to_path_buf()];
    let (Some(dir), Some(name)) = (path.parent(), path.file_name()) else {
        return out;
    };
    let prefix = format!("{}.", name.to_string_lossy());
    if let Ok(rd) = std::fs::read_dir(dir) {
        for e in rd.flatten() {
            if e.file_name().to_string_lossy().starts_with(&prefix) {
                out.push(e.path());
            }
        }
    }
    out
}

/// Deletes every backup and its sidecars (Settings → Backups → reset). Returns how many.
pub fn delete_all() -> Result<usize, AppError> {
    let mut n = 0;
    let mut failed = Vec::new();
    for e in list_metadata()? {
        match remove_with_sidecars(&e.path) {
            Ok(()) => n += 1,
            Err(err) => failed.push(format!("{}: {err}", e.path.display())),
        }
    }
    log_system!(
        warn,
        event = "BACKUP_RESET",
        deleted = n,
        failed = failed.len()
    );
    if !failed.is_empty() {
        return Err(fail(
            "error.backup.delete_failed",
            "BACKUP_RESET_INCOMPLETE",
            failed.join("; "),
        ));
    }
    Ok(n)
}

/// Removes the backup first (so a half-deleted backup is never listed), then its sidecars.
fn remove_with_sidecars(path: &Path) -> std::io::Result<()> {
    let files = backup_and_sidecars(path);
    std::fs::remove_file(path)?;
    for p in files.iter().skip(1) {
        let _ = std::fs::remove_file(p);
    }
    Ok(())
}

/// A backup listed in the backup folder; any other path is refused (`outside_folder`).
fn resolve_in_backup_dir(path: &Path) -> Result<PathBuf, AppError> {
    let Ok(file) = path.canonicalize() else {
        return Err(AppError::validation_code("error.backup.file_not_found"));
    };
    let dir = backup_dir().canonicalize().unwrap_or_else(|_| backup_dir());
    if file.parent() != Some(dir.as_path()) || !is_backup_file(&file) {
        log_system!(warn, event = "BACKUP_PATH_REFUSED", path = %path.display());
        return Err(AppError::validation_code("error.backup.outside_folder"));
    }
    Ok(file)
}

/// Deletes one backup and its sidecars (Settings → Backups). The last remaining backup is kept:
/// "delete all and start again" is the way to replace it. Returns the file name.
pub fn delete_one(path: &Path) -> Result<String, AppError> {
    let file = resolve_in_backup_dir(path)?;
    if list_metadata()?.len() <= 1 {
        return Err(AppError::validation_code("error.backup.keep_last"));
    }
    let name = file
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    remove_with_sidecars(&file)
        .map_err(|e| io_fail("error.backup.delete_failed", "BACKUP_DELETE_FAILED", e))?;
    log_system!(warn, event = "BACKUP_DELETED", file = %name);
    Ok(name)
}

// ---------------------------------------------------------------------------
// Compressed format (.mdbk)
// ---------------------------------------------------------------------------

fn backup_cipher(db_key: &[u8]) -> aes_gcm::Aes256Gcm {
    use aes_gcm::KeyInit;
    use hmac::Mac;
    // A separate key per purpose: the database key itself never encrypts the archive.
    let mut mac = <hmac::Hmac<sha2::Sha256> as Mac>::new_from_slice(db_key)
        .expect("HMAC accepts any key length");
    mac.update(b"medoc-backup-archive-v2");
    aes_gcm::Aes256Gcm::new_from_slice(&mac.finalize().into_bytes()).expect("32-byte key")
}

/// Plain SQLite image of the live database, in memory only. `sqlcipher_export` reads inside
/// one transaction, so the image is consistent even while the practice keeps working.
async fn plaintext_image(pool: &SqlitePool) -> Result<zeroize::Zeroizing<Vec<u8>>, AppError> {
    let mut conn = pool
        .acquire()
        .await
        .map_err(|e| fail("error.backup.snapshot_failed", "BACKUP_SNAPSHOT_FAILED", e))?;
    sqlx::query("ATTACH DATABASE ':memory:' AS medoc_snapshot KEY ''")
        .execute(&mut *conn)
        .await
        .map_err(|e| fail("error.backup.snapshot_failed", "BACKUP_SNAPSHOT_FAILED", e))?;
    let image = async {
        sqlx::query("SELECT sqlcipher_export('medoc_snapshot')")
            .execute(&mut *conn)
            .await?;
        let buf = conn.serialize(Some("medoc_snapshot")).await?;
        Ok::<_, sqlx::Error>(zeroize::Zeroizing::new(buf.to_vec()))
    }
    .await;
    let _ = sqlx::query("DETACH DATABASE medoc_snapshot")
        .execute(&mut *conn)
        .await;
    image.map_err(|e| fail("error.backup.snapshot_failed", "BACKUP_SNAPSHOT_FAILED", e))
}

fn seal(image: &[u8], db_key: &[u8]) -> Result<Vec<u8>, AppError> {
    use aes_gcm::aead::{Aead, AeadCore, OsRng, Payload};
    use std::io::Write;
    let mut gz = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::best());
    gz.write_all(image)
        .map_err(|e| fail("error.backup.compress_failed", "BACKUP_COMPRESS_FAILED", e))?;
    let compressed = zeroize::Zeroizing::new(
        gz.finish()
            .map_err(|e| fail("error.backup.compress_failed", "BACKUP_COMPRESS_FAILED", e))?,
    );
    let nonce = aes_gcm::Aes256Gcm::generate_nonce(&mut OsRng);
    let sealed = backup_cipher(db_key)
        .encrypt(
            &nonce,
            Payload {
                msg: &compressed,
                aad: MDBK_MAGIC,
            },
        )
        .map_err(|_| {
            fail(
                "error.backup.compress_failed",
                "BACKUP_ENCRYPT_FAILED",
                "AES-GCM",
            )
        })?;
    let mut out = Vec::with_capacity(MDBK_MAGIC.len() + nonce.len() + sealed.len());
    out.extend_from_slice(MDBK_MAGIC);
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&sealed);
    Ok(out)
}

fn unseal(file: &[u8], db_key: &[u8]) -> Result<zeroize::Zeroizing<Vec<u8>>, AppError> {
    use aes_gcm::aead::{Aead, Payload};
    use std::io::Read;
    if file.len() < MDBK_MAGIC.len() + 12 || &file[..MDBK_MAGIC.len()] != MDBK_MAGIC {
        log_system!(warn, event = "BACKUP_NOT_AN_ARCHIVE", bytes = file.len());
        return Err(AppError::validation_code("error.backup.not_an_archive"));
    }
    let (nonce, sealed) = file[MDBK_MAGIC.len()..].split_at(12);
    let compressed = zeroize::Zeroizing::new(
        backup_cipher(db_key)
            .decrypt(
                aes_gcm::Nonce::from_slice(nonce),
                Payload {
                    msg: sealed,
                    aad: MDBK_MAGIC,
                },
            )
            // Another practice's key, or an altered file.
            .map_err(|_| {
                log_system!(warn, event = "BACKUP_DECRYPT_FAILED");
                AppError::validation_code("error.backup.decrypt_failed")
            })?,
    );
    let mut image = zeroize::Zeroizing::new(Vec::new());
    flate2::read::GzDecoder::new(&compressed[..])
        .read_to_end(&mut image)
        .map_err(|e| fail("error.backup.unpack_failed", "BACKUP_DECOMPRESS_FAILED", e))?;
    Ok(image)
}

/// Writes a compressed, encrypted, signed backup of `pool` to `target`.
pub async fn write_compressed(
    pool: &SqlitePool,
    db_key: &[u8],
    target: &Path,
) -> Result<(), AppError> {
    let image = plaintext_image(pool).await?;
    let key = zeroize::Zeroizing::new(db_key.to_vec());
    // Compression and encryption are CPU-bound: keep them off the async runtime.
    let sealed = tokio::task::spawn_blocking(move || seal(&image, &key))
        .await
        .map_err(|e| {
            fail(
                "error.backup.compress_failed",
                "BACKUP_COMPRESS_TASK_FAILED",
                e,
            )
        })??;
    // Write beside, then rename: a crash never leaves a half-written backup under the real name.
    let part = target.with_extension("mdbk.part");
    if let Err(e) = std::fs::write(&part, &sealed) {
        let _ = std::fs::remove_file(&part);
        return Err(io_fail(
            "error.backup.write_failed",
            "BACKUP_WRITE_FAILED",
            e,
        ));
    }
    std::fs::rename(&part, target)
        .map_err(|e| io_fail("error.backup.write_failed", "BACKUP_RENAME_FAILED", e))?;
    write_signature(target)
}

/// Creates a compressed backup in the backup folder, then applies retention.
pub async fn create_compressed(
    pool: &SqlitePool,
    app_data_dir: &Path,
) -> Result<PathBuf, AppError> {
    let dir = backup_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|e| io_fail("error.backup.folder_unavailable", "BACKUP_DIR_FAILED", e))?;
    let ts = Utc::now().format("%Y%m%dT%H%M%SZ");
    let mut target = dir.join(format!("medoc-{ts}.{COMPRESSED_EXT}"));
    let mut n = 1u32;
    while target.exists() {
        target = dir.join(format!("medoc-{ts}-{n}.{COMPRESSED_EXT}"));
        n += 1;
    }
    log_system!(info, event = "BACKUP_START", target = %target.display(), format = "mdbk");
    let key = backup_key(app_data_dir)?;
    if let Err(e) = write_compressed(pool, &key, &target).await {
        log_system!(error, event = "BACKUP_FAILED", target = %target.display(), code = %e.wire_code());
        let _ = std::fs::remove_file(&target);
        let _ = std::fs::remove_file(sig_path(&target));
        return Err(e);
    }
    copy_recovery_sidecars(app_data_dir, &target);
    let report = enforce_retention(&dir)?;
    let size = std::fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
    log_system!(
        info,
        event = "BACKUP_COMPLETE",
        target = %target.display(),
        bytes = size,
        kept = report.kept,
        deleted = report.deleted.len(),
    );
    Ok(target)
}

/// `file:` URI for an absolute path (escaping `%`, `?`, `#`; Windows drive paths get a `/`).
fn sqlite_file_uri(path: &Path) -> String {
    let mut p = path.to_string_lossy().replace('\\', "/");
    if !p.starts_with('/') {
        p.insert(0, '/');
    }
    let p = p
        .replace('%', "%25")
        .replace('?', "%3f")
        .replace('#', "%23")
        .replace('\'', "''");
    format!("file:{p}?mode=rwc")
}

/// Unpacks a `.mdbk` into an encrypted database file at `out` (never a plain file on disk):
/// the image is loaded into a plain in-memory connection and `sqlcipher_export` writes it into
/// the attached, encrypted target.
pub async fn unpack_to_encrypted_db(
    mdbk: &Path,
    db_key: &[u8],
    out: &Path,
) -> Result<(), AppError> {
    use sqlx::Connection;
    let file = std::fs::read(mdbk)
        .map_err(|e| io_fail("error.backup.read_failed", "BACKUP_READ_FAILED", e))?;
    let key = zeroize::Zeroizing::new(db_key.to_vec());
    let image = tokio::task::spawn_blocking(move || unseal(&file, &key))
        .await
        .map_err(|e| fail("error.backup.unpack_failed", "BACKUP_UNPACK_TASK_FAILED", e))??;
    let buf = sqlx::sqlite::SqliteOwnedBuf::try_from(&image[..])
        .map_err(|e| fail("error.backup.unpack_failed", "BACKUP_UNPACK_FAILED", e))?;
    drop(image);
    let _ = std::fs::remove_file(out);
    let key_hex = zeroize::Zeroizing::new(
        db_key
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<String>(),
    );
    let mut conn = sqlx::sqlite::SqliteConnection::connect("sqlite::memory:")
        .await
        .map_err(|e| fail("error.backup.unpack_failed", "BACKUP_UNPACK_FAILED", e))?;
    let result = async {
        conn.deserialize(None, buf, false).await?;
        // The memory connection is opened in URI mode: a bare path would also be in memory.
        sqlx::query(&format!(
            "ATTACH DATABASE '{}' AS restored KEY \"x'{}'\"",
            sqlite_file_uri(out),
            key_hex.as_str()
        ))
        .execute(&mut conn)
        .await?;
        sqlx::query("SELECT sqlcipher_export('restored')")
            .execute(&mut conn)
            .await?;
        sqlx::query("DETACH DATABASE restored")
            .execute(&mut conn)
            .await?;
        Ok::<_, sqlx::Error>(())
    }
    .await;
    let _ = conn.close().await;
    if let Err(e) = result {
        let _ = std::fs::remove_file(out);
        return Err(fail(
            "error.backup.unpack_failed",
            "BACKUP_UNPACK_FAILED",
            e,
        ));
    }
    if !out.is_file() {
        return Err(fail(
            "error.backup.unpack_failed",
            "BACKUP_UNPACK_FAILED",
            "no file written",
        ));
    }
    log_system!(info, event = "BACKUP_UNPACKED", from = %mdbk.display());
    Ok(())
}

/// One backup action from the audit log, for Settings → Backups.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct BackupHistoryRow {
    pub at: String,
    pub action: String,
    /// Staff name, or `system` for the automatic run.
    pub by: String,
    pub details: Option<String>,
}

/// Backup actions (automatic runs, manual backups, restores, resets, schedule changes), newest
/// first. They live in the tamper-evident audit log; this is a read view of it.
/// Not shown in Settings for now (kept internal: audit log + app log); kept for support tooling.
pub async fn history(pool: &SqlitePool, limit: i64) -> Result<Vec<BackupHistoryRow>, AppError> {
    Ok(sqlx::query_as::<_, BackupHistoryRow>(
        "SELECT a.created_at AS at, a.action, COALESCE(s.name, a.user_id) AS by,
                COALESCE(a.details, a.entity_id) AS details
           FROM audit_log a LEFT JOIN staff s ON s.id = a.user_id
          WHERE a.entity = 'Backup'
          ORDER BY a.created_at DESC LIMIT ?1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

// ---------------------------------------------------------------------------
// Automatic schedule
// ---------------------------------------------------------------------------

/// Automatic daily backups are on unless an administrator paused them.
pub async fn schedule_enabled(pool: &SqlitePool) -> bool {
    crate::infrastructure::database::repos::admin::app_kv::get(pool, SCHEDULE_KV_KEY)
        .await
        .ok()
        .flatten()
        .and_then(|v| serde_json::from_str::<serde_json::Value>(&v).ok())
        .and_then(|v| v.get("enabled").and_then(serde_json::Value::as_bool))
        .unwrap_or(true)
}

/// Records who turned automatic backups on or off, when and why (also in the audit log).
pub async fn set_schedule(
    pool: &SqlitePool,
    enabled: bool,
    user_id: &str,
    reason: &str,
) -> Result<(), AppError> {
    let value = serde_json::json!({
        "enabled": enabled,
        "changedBy": user_id,
        "changedAt": Utc::now().to_rfc3339(),
        "reason": reason.trim(),
    });
    crate::infrastructure::database::repos::admin::app_kv::set(
        pool,
        SCHEDULE_KV_KEY,
        &value.to_string(),
    )
    .await?;
    audit_repo::create(
        pool,
        user_id,
        if enabled {
            "BACKUP_SCHEDULE_ON"
        } else {
            "BACKUP_SCHEDULE_OFF"
        },
        "Backup",
        None,
        Some(reason.trim()).filter(|r| !r.is_empty()),
    )
    .await?;
    log_system!(warn, event = "BACKUP_SCHEDULE_CHANGED", enabled, by = %user_id, reason = %reason.trim());
    Ok(())
}

/// The daily run: makes today's backup if the schedule is on and none exists yet for today.
/// Safe to call often (the app checks every 30 minutes, so a practice that closes the app
/// in the evening still gets its backup the next morning).
pub async fn run_scheduled_if_due(
    pool: &SqlitePool,
    app_data_dir: &Path,
) -> Result<Option<PathBuf>, AppError> {
    if !schedule_enabled(pool).await {
        log_system!(debug, event = "BACKUP_AUTO_PAUSED");
        return Ok(None);
    }
    let today = chrono::Local::now().date_naive();
    let has_today = list_metadata()?
        .iter()
        .filter_map(|e| e.created_at)
        .any(|t| t.with_timezone(&chrono::Local).date_naive() == today);
    if has_today {
        return Ok(None);
    }
    // A manual backup or restore in progress: try again at the next check.
    let Ok(_guard) = begin_operation() else {
        return Ok(None);
    };
    let path = match create_compressed(pool, app_data_dir).await {
        Ok(p) => p,
        Err(e) => {
            // In the audit log too, so Settings → Backups shows that the night's backup failed.
            let _ = audit_repo::create(
                pool,
                "system",
                "BACKUP_AUTO_FAILED",
                "Backup",
                None,
                Some(&e.wire_code()),
            )
            .await;
            return Err(e);
        }
    };
    let name = path.file_name().map(|n| n.to_string_lossy().into_owned());
    audit_repo::create(
        pool,
        "system",
        "BACKUP_AUTO",
        "Backup",
        name.as_deref(),
        None,
    )
    .await?;
    Ok(Some(path))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreReport {
    /// Live DB pool was closed; restart the app before further work.
    pub requires_app_restart: bool,
    /// Path of the file copied into `medoc.db`.
    pub restored_from: PathBuf,
    /// Whether a pre-restore safety snapshot was created.
    pub pre_restore_backup_created: bool,
}

/// Replace `medoc.db` with a validated backup snapshot (G2 / WAAD 9.1).
///
/// Closes the active pool; the desktop app must restart to reopen the database.
///
/// Safety rules:
/// - a snapshot of the current data must succeed first, or nothing is replaced;
/// - the backup is copied aside before that snapshot runs retention, which
///   could otherwise delete the very file being restored;
/// - an unsigned file is accepted only when it opens with this practice's key,
///   so a foreign plaintext SQLite file cannot replace the practice database;
/// - the live file is swapped atomically and never deleted before the new one
///   is in place.
pub async fn restore_from_backup(
    pool: &SqlitePool,
    app_data_dir: &Path,
    backup_path: &Path,
) -> Result<RestoreReport, AppError> {
    if !backup_path.is_file() {
        return Err(AppError::validation_code("error.backup.file_not_found"));
    }
    if is_compressed(backup_path) {
        // A compressed archive must carry a valid signature; it is unpacked into an encrypted
        // database file, which then goes through the same checks and safe swap as any backup.
        if verify_signature(backup_path) != Some(true) {
            return Err(AppError::validation_code("error.backup.signature_invalid"));
        }
        let key = backup_key(app_data_dir)?;
        // Outside the backup folder, so rotation during the restore cannot touch it.
        let unpacked = app_data_dir.join("medoc-restore-unpacked.db");
        unpack_to_encrypted_db(backup_path, &key, &unpacked).await?;
        write_signature(&unpacked)?;
        let outcome = Box::pin(restore_from_backup(pool, app_data_dir, &unpacked)).await;
        let _ = std::fs::remove_file(&unpacked);
        let _ = std::fs::remove_file(sig_path(&unpacked));
        return outcome.map(|mut r| {
            r.restored_from = backup_path.to_path_buf();
            r
        });
    }
    if backup_path.extension().and_then(|e| e.to_str()) != Some("db") {
        return Err(AppError::validation_code("error.backup.only_db_files"));
    }
    let signed = match verify_signature(backup_path) {
        Some(false) => {
            return Err(AppError::validation_code("error.backup.signature_invalid"));
        }
        Some(true) => true,
        None => {
            if !validate(backup_path)? {
                return Err(AppError::validation_code("error.backup.invalid_sqlite"));
            }
            false
        }
    };

    let key = backup_key(app_data_dir)?;
    let opens_encrypted = sqlcipher::opens_with_sqlcipher_key(backup_path, &key).await;
    let plaintext = !opens_encrypted && sqlcipher::is_plaintext_sqlite_file(backup_path);
    if !opens_encrypted && !(plaintext && signed) {
        return Err(AppError::validation_code("error.backup.invalid_medoc_db"));
    }

    // Copy the source aside first: the safety snapshot below runs retention,
    // which may delete an old backup — possibly this one.
    let source_copy = backup_path.with_extension("db.restore-src");
    let _ = std::fs::remove_file(&source_copy);
    std::fs::copy(backup_path, &source_copy)
        .map_err(|e| io_fail("error.backup.read_failed", "BACKUP_RESTORE_COPY_FAILED", e))?;

    let outcome = restore_staged(pool, app_data_dir, &source_copy, &key, plaintext).await;
    let _ = std::fs::remove_file(&source_copy);
    let pre_path = outcome?;

    log_system!(
        warn,
        event = "BACKUP_RESTORE",
        from = %backup_path.display(),
        target = %app_data_dir.join("medoc.db").display(),
        pre_snapshot = %pre_path.display(),
    );

    Ok(RestoreReport {
        requires_app_restart: true,
        restored_from: backup_path.to_path_buf(),
        pre_restore_backup_created: true,
    })
}

/// Snapshot the live data, then swap in `source`. Returns the snapshot path.
async fn restore_staged(
    pool: &SqlitePool,
    app_data_dir: &Path,
    source: &Path,
    key: &[u8],
    plaintext: bool,
) -> Result<PathBuf, AppError> {
    // No safety snapshot, no restore.
    let pre_path = create(pool).await.map_err(|e| {
        fail(
            "error.backup.safety_backup_failed",
            "BACKUP_RESTORE_ABORTED",
            e.wire_code(),
        )
    })?;

    let db_path = app_data_dir.join("medoc.db");
    pool.close().await;

    // Close releases handles asynchronously on Windows; the swap retries.
    log_system!(warn, event = "BACKUP_RESTORE_SWAP", safety_backup = %pre_path.display());
    replace_live_db_with_backup(&db_path, source).await?;
    if plaintext {
        sqlcipher::migrate_plaintext_to_sqlcipher(&db_path, key).await?;
    }

    let mut opened = sqlcipher::opens_with_sqlcipher_key(&db_path, key).await;
    for attempt in 1..10u32 {
        if opened {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(30 * u64::from(attempt))).await;
        opened = sqlcipher::opens_with_sqlcipher_key(&db_path, key).await;
    }
    if !opened {
        // Put the data that was live a moment ago back in place.
        log_system!(error, event = "BACKUP_RESTORE_ROLLBACK", from = %pre_path.display());
        replace_live_db_with_backup(&db_path, &pre_path).await?;
        return Err(AppError::validation_code("error.backup.invalid_medoc_db"));
    }
    Ok(pre_path)
}

fn db_sidecar(db_path: &Path, suffix: &str) -> PathBuf {
    let mut os = db_path.as_os_str().to_owned();
    os.push(suffix);
    PathBuf::from(os)
}

fn remove_db_sidecars(db_path: &Path) {
    for suffix in ["-wal", "-shm", "-journal"] {
        let _ = std::fs::remove_file(db_sidecar(db_path, suffix));
    }
}

/// Copy `backup_path` onto `db_path` without leaving a stale WAL next to a replaced file.
///
/// The live file is never deleted before the new one is in place: it is moved
/// aside, the staged copy is renamed in (same directory, so the rename is
/// atomic), and only then is the old file removed. On failure the old file is
/// moved back and the staged copy is kept for manual recovery.
async fn replace_live_db_with_backup(db_path: &Path, backup_path: &Path) -> Result<(), AppError> {
    let staging = db_path.with_file_name("medoc.db.restore-tmp");
    let aside = db_path.with_file_name("medoc.db.restore-old");
    let _ = std::fs::remove_file(&staging);

    {
        std::fs::copy(backup_path, &staging).map_err(|e| {
            io_fail(
                "error.backup.restore_failed",
                "BACKUP_RESTORE_STAGE_FAILED",
                e,
            )
        })?;
        // Flush the staged copy before the swap (Windows AV / SMB).
        let f = std::fs::File::open(&staging).map_err(|e| {
            io_fail(
                "error.backup.restore_failed",
                "BACKUP_RESTORE_STAGE_FAILED",
                e,
            )
        })?;
        f.sync_all().map_err(|e| {
            io_fail(
                "error.backup.restore_failed",
                "BACKUP_RESTORE_STAGE_FAILED",
                e,
            )
        })?;
    }

    let mut last_err: Option<std::io::Error> = None;
    for attempt in 0..16u32 {
        remove_db_sidecars(db_path);
        let had_live = db_path.exists();
        if had_live {
            let _ = std::fs::remove_file(&aside);
            if let Err(e) = std::fs::rename(db_path, &aside) {
                // Still locked by a closing connection: wait and retry.
                last_err = Some(e);
                tokio::time::sleep(std::time::Duration::from_millis(
                    25 * u64::from(attempt + 1),
                ))
                .await;
                continue;
            }
        }
        match std::fs::rename(&staging, db_path) {
            Ok(()) => {
                remove_db_sidecars(db_path);
                let _ = std::fs::remove_file(&aside);
                return Ok(());
            }
            Err(e) => {
                if had_live {
                    if let Err(back) = std::fs::rename(&aside, db_path) {
                        log_system!(
                            error,
                            event = "BACKUP_RESTORE_PUT_BACK_FAILED",
                            aside = %aside.display(),
                            error = %back
                        );
                        return Err(fail(
                            "error.backup.restore_failed",
                            "BACKUP_RESTORE_SWAP_FAILED",
                            format!("current database kept at {}: {e}", aside.display()),
                        ));
                    }
                }
                last_err = Some(e);
            }
        }
        tokio::time::sleep(std::time::Duration::from_millis(
            25 * u64::from(attempt + 1),
        ))
        .await;
    }

    // The staged copy stays on disk so the backup is not lost with the error.
    Err(fail(
        "error.backup.restore_failed",
        "BACKUP_RESTORE_SWAP_FAILED",
        format!(
            "replace {}, staged copy kept at {}: {}",
            db_path.display(),
            staging.display(),
            last_err
                .map(|e| e.to_string())
                .unwrap_or_else(|| "destination still locked".into())
        ),
    ))
}

/// Open `path` with the practice key. A plaintext SQLite file still passes the
/// header check. An encrypted file passes only when the key opens it.
pub async fn validate_open(path: &Path, key: &[u8]) -> Result<bool, AppError> {
    if crate::infrastructure::database::sqlcipher::opens_with_sqlcipher_key(path, key).await {
        return Ok(true);
    }
    if crate::infrastructure::database::sqlcipher::is_plaintext_sqlite_file(path) {
        return validate(path);
    }
    Ok(false)
}

/// Validate that a backup file looks like a SQLite database.
pub fn validate(path: &Path) -> Result<bool, AppError> {
    use std::io::Read;
    let mut f = std::fs::File::open(path)
        .map_err(|e| io_fail("error.backup.read_failed", "BACKUP_READ_FAILED", e))?;
    let mut header = [0u8; 16];
    // Shorter than a SQLite header: not a database.
    if f.read_exact(&mut header).is_err() {
        return Ok(false);
    }
    Ok(&header == b"SQLite format 3\0")
}

#[cfg(test)]
mod list_tests {
    use super::*;

    #[test]
    fn metadata_listing_reports_not_checked_instead_of_bad() {
        let dir = std::env::temp_dir().join(format!("medoc-backup-list-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = dir.join("medoc-20261122T100000Z.db");
        std::fs::write(&db, b"not really a database").unwrap();
        std::fs::write(sig_path(&db), "0000\n").unwrap(); // wrong signature
        std::env::set_var("MEDOC_BACKUP_DIR", &dir);

        let full = list().unwrap();
        let meta = list_metadata().unwrap();

        std::env::remove_var("MEDOC_BACKUP_DIR");
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(full.len(), 1);
        assert_eq!(
            full[0].signature_ok,
            Some(false),
            "Ops listing must catch the bad signature"
        );
        assert_eq!(meta[0].size_bytes, 21);
        assert_eq!(
            meta[0].signature_ok, None,
            "About listing does not check, so it must not say bad"
        );
    }
}
