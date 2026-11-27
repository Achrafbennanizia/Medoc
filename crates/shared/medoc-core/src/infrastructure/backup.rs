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

mod compressed;
pub use compressed::*;
mod schedule;
pub use schedule::*;
mod restore;
pub use restore::*;

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

/// Where backups are written now: the folder chosen in Settings (e.g. a USB stick) while it is
/// there, else this computer's default folder. See `backup_files`.
pub fn backup_dir() -> PathBuf {
    super::backup_files::active_backup_dir().0
}

/// Folders that may hold backups: the active one, plus the default folder when backups fell
/// back to it (drive unplugged) or were made there before another folder was chosen.
fn backup_dirs() -> Vec<PathBuf> {
    let active = backup_dir();
    let local = super::backup_files::default_backup_dir();
    if local != active && local.is_dir() {
        vec![active, local]
    } else {
        vec![active]
    }
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

/// `None` = no signature file; `Some(ok)` = verification result.
pub(crate) fn signature_ok(path: &Path) -> Option<bool> {
    verify_signature(path)
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
    let mut found = Vec::new();
    for dir in backup_dirs() {
        if !dir.exists() {
            continue;
        }
        let rd = std::fs::read_dir(&dir)
            .map_err(|e| io_fail("error.backup.folder_unavailable", "BACKUP_LIST_FAILED", e))?;
        found.extend(rd.filter_map(|e| e.ok()));
    }
    let mut entries: Vec<BackupEntry> = found
        .into_iter()
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
    for dir in backup_dirs() {
        super::backup_files::collect_garbage(&dir);
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
    let inside = backup_dirs()
        .into_iter()
        .map(|d| d.canonicalize().unwrap_or(d))
        .any(|d| file.parent() == Some(d.as_path()));
    if !inside || !is_backup_file(&file) {
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
    if let Some(dir) = file.parent() {
        super::backup_files::collect_garbage(dir);
    }
    log_system!(warn, event = "BACKUP_DELETED", file = %name);
    Ok(name)
}

#[cfg(test)]
#[path = "backup_tests.rs"]
mod list_tests;
