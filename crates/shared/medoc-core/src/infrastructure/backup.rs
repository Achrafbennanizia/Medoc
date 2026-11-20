// Backup & restore (NFA-SEC-08, supports DSGVO + system continuity).
//
// Uses SQLite's built-in `VACUUM INTO` to produce a self-contained snapshot
// that includes WAL contents and skips free pages. Snapshots are timestamped
// and stored under `~/medoc-data/backups/`.
//
// Retention (TASK 2.6): all backups ≤30 days; one per ISO week for weeks 31–84;
// one per calendar month for months 85–365; older than 12 months are removed.
// Each `.db` file gets an HMAC sidecar `*.db.sig` using the audit-chain key.

use chrono::{DateTime, Datelike, Duration, NaiveDateTime, Utc};
use serde::Serialize;
use sqlx::SqlitePool;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::{db_key, sqlcipher};
use crate::log_system;

const DAILY_DAYS: i64 = 30;
const WEEKLY_WEEKS: i64 = 12;
const MONTHLY_MONTHS: i64 = 12;

type WeekKey = (i32, u32);
type MonthKey = (i32, u32);
type DatedBackup = (PathBuf, DateTime<Utc>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub path: PathBuf,
    pub size_bytes: u64,
    /// `None` = no `.sig` sidecar (legacy backup); `Some` = verification result.
    pub signature_ok: Option<bool>,
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
    let naive = NaiveDateTime::parse_from_str(ts, "%Y%m%dT%H%M%SZ").ok()?;
    Some(DateTime::from_naive_utc_and_offset(naive, Utc))
}

/// Sign a backup file (integration tests + manual repair).
pub fn sign_file(db_path: &Path) -> Result<(), AppError> {
    write_signature(db_path)
}

fn write_signature(db_path: &Path) -> Result<(), AppError> {
    let hmac = audit_repo::hmac_file(db_path)?;
    let sig = sig_path(db_path);
    std::fs::write(&sig, format!("{hmac}\n"))
        .map_err(|e| AppError::Internal(format!("Write signature: {e}")))?;
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
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Internal(format!("backup dir: {e}")))?;

    let ts = Utc::now().format("%Y%m%dT%H%M%SZ");
    let target = dir.join(format!("medoc-{ts}.db"));

    log_system!(info, event = "BACKUP_START", target = %target.display());

    let path_lit = target
        .to_string_lossy()
        .replace('\\', "/")
        .replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{path_lit}'"))
        .execute(pool)
        .await
        .map_err(|e| {
            log_system!(error, event = "BACKUP_FAILED", error = %e);
            AppError::Internal(format!("VACUUM INTO failed: {e}"))
        })?;

    write_signature(&target)?;
    if let Some(app_dir) = app_data_dir {
        copy_recovery_sidecars(app_dir, &target);
    }
    let report = enforce_retention(&dir)?;
    log_system!(
        info,
        event = "BACKUP_RETENTION",
        kept = report.kept,
        deleted = report.deleted.len(),
    );

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

/// List all backup files (newest first) with optional signature verification.
pub fn list() -> Result<Vec<BackupEntry>, AppError> {
    let dir = backup_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut entries: Vec<BackupEntry> = std::fs::read_dir(&dir)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("db"))
        .map(|e| {
            let path = e.path();
            let size_bytes = e.metadata().map(|m| m.len()).unwrap_or(0);
            let signature_ok = if sig_path(&path).exists() {
                verify_signature(&path)
            } else {
                None
            };
            BackupEntry {
                path,
                size_bytes,
                signature_ok,
            }
        })
        .collect();
    entries.sort_by(|a, b| b.path.cmp(&a.path));
    Ok(entries)
}

/// GFS-style retention: daily 30d, weekly 12w, monthly 12m.
pub fn enforce_retention(dir: &Path) -> Result<BackupRetentionReport, AppError> {
    enforce_retention_at(dir, Utc::now())
}

pub fn enforce_retention_at(
    dir: &Path,
    now: DateTime<Utc>,
) -> Result<BackupRetentionReport, AppError> {
    let daily_cutoff = now - Duration::days(DAILY_DAYS);
    let weekly_cutoff = now - Duration::weeks(WEEKLY_WEEKS);
    let monthly_cutoff = now - Duration::days(MONTHLY_MONTHS * 30);

    let mut report = BackupRetentionReport {
        scanned: 0,
        kept: 0,
        deleted: Vec::new(),
        errors: Vec::new(),
    };

    let mut files: Vec<(PathBuf, DateTime<Utc>)> = Vec::new();
    if dir.exists() {
        for entry in std::fs::read_dir(dir).map_err(|e| AppError::Internal(e.to_string()))? {
            let entry = entry.map_err(|e| AppError::Internal(e.to_string()))?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("db") {
                continue;
            }
            report.scanned += 1;
            let Some(ts) = parse_backup_timestamp(&path) else {
                report
                    .errors
                    .push(format!("Timestamp not readable: {}", path.display()));
                continue;
            };
            files.push((path, ts));
        }
    }

    let mut keep: HashSet<PathBuf> = HashSet::new();

    for (path, ts) in &files {
        if *ts >= daily_cutoff {
            keep.insert(path.clone());
        }
    }

    let mut by_week: HashMap<WeekKey, Vec<DatedBackup>> = HashMap::new();
    for (path, ts) in &files {
        if *ts < daily_cutoff && *ts >= weekly_cutoff {
            let iso = ts.date_naive().iso_week();
            by_week
                .entry((iso.year(), iso.week()))
                .or_default()
                .push((path.clone(), *ts));
        }
    }
    for files_in_week in by_week.values_mut() {
        files_in_week.sort_by_key(|(_, t)| *t);
        if let Some((path, _)) = files_in_week.last() {
            keep.insert(path.clone());
        }
    }

    let mut by_month: HashMap<MonthKey, Vec<DatedBackup>> = HashMap::new();
    for (path, ts) in &files {
        if *ts < weekly_cutoff && *ts >= monthly_cutoff {
            by_month
                .entry((ts.year(), ts.month()))
                .or_default()
                .push((path.clone(), *ts));
        }
    }
    for files_in_month in by_month.values_mut() {
        files_in_month.sort_by_key(|(_, t)| *t);
        if let Some((path, _)) = files_in_month.last() {
            keep.insert(path.clone());
        }
    }

    report.kept = keep.len();
    for (path, _) in files {
        if keep.contains(&path) {
            continue;
        }
        for p in [path.clone(), sig_path(&path)] {
            if p.exists() {
                match std::fs::remove_file(&p) {
                    Ok(()) => report
                        .deleted
                        .push(p.file_name().unwrap().to_string_lossy().into_owned()),
                    Err(e) => report.errors.push(format!("{}: {e}", p.display())),
                }
            }
        }
    }

    Ok(report)
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

    let key = db_key::ensure_sqlcipher_key(app_data_dir, false)?;
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
        .map_err(|e| AppError::Internal(format!("Restore failed (copy source): {e}")))?;

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
        log_system!(error, event = "BACKUP_RESTORE_ABORTED", error = %e);
        AppError::Internal(format!(
            "Restore cancelled: the safety backup of the current data failed ({e})"
        ))
    })?;

    let db_path = app_data_dir.join("medoc.db");
    pool.close().await;

    // Close releases handles asynchronously on Windows; the swap retries.
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
            AppError::Internal(format!("Restore failed (stage {}): {e}", staging.display()))
        })?;
        // Flush the staged copy before the swap (Windows AV / SMB).
        let f = std::fs::File::open(&staging)
            .map_err(|e| AppError::Internal(format!("Restore failed (stage open): {e}")))?;
        f.sync_all()
            .map_err(|e| AppError::Internal(format!("Restore failed (stage sync): {e}")))?;
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
                        return Err(AppError::Internal(format!(
                            "Restore failed and the current database is kept at {}: {e}",
                            aside.display()
                        )));
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
    Err(AppError::Internal(format!(
        "Restore failed (replace {}, staged copy kept at {}): {}",
        db_path.display(),
        staging.display(),
        last_err
            .map(|e| e.to_string())
            .unwrap_or_else(|| "destination still locked".into())
    )))
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
    let mut f =
        std::fs::File::open(path).map_err(|e| AppError::Internal(format!("open backup: {e}")))?;
    let mut header = [0u8; 16];
    f.read_exact(&mut header)
        .map_err(|e| AppError::Internal(format!("read header: {e}")))?;
    Ok(&header == b"SQLite format 3\0")
}
