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
use crate::infrastructure::database::audit_repo;
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
        .map_err(|e| AppError::Internal(format!("Signatur schreiben: {e}")))?;
    Ok(())
}

fn verify_signature(db_path: &Path) -> Option<bool> {
    let sig = sig_path(db_path);
    let expected = std::fs::read_to_string(&sig).ok()?;
    audit_repo::verify_file_hmac(db_path, &expected).ok()
}

/// Create a timestamped backup of the live database.
pub async fn create(pool: &SqlitePool) -> Result<PathBuf, AppError> {
    let dir = backup_dir();
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Internal(format!("backup dir: {e}")))?;

    let ts = Utc::now().format("%Y%m%dT%H%M%SZ");
    let target = dir.join(format!("medoc-{ts}.db"));

    log_system!(info, event = "BACKUP_START", target = %target.display());

    let path_lit = target.display().to_string().replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{path_lit}'"))
        .execute(pool)
        .await
        .map_err(|e| {
            log_system!(error, event = "BACKUP_FAILED", error = %e);
            AppError::Internal(format!("VACUUM INTO failed: {e}"))
        })?;

    write_signature(&target)?;
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
                    .push(format!("Zeitstempel nicht lesbar: {}", path.display()));
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
pub async fn restore_from_backup(
    pool: &SqlitePool,
    app_data_dir: &Path,
    backup_path: &Path,
) -> Result<RestoreReport, AppError> {
    if !backup_path.is_file() {
        return Err(AppError::Validation("Backup-Datei nicht gefunden.".into()));
    }
    if backup_path.extension().and_then(|e| e.to_str()) != Some("db") {
        return Err(AppError::Validation(
            "Nur .db-Dateien können wiederhergestellt werden.".into(),
        ));
    }
    match verify_signature(backup_path) {
        Some(false) => {
            return Err(AppError::Validation(
                "Backup-Signatur ungültig — Wiederherstellung abgebrochen.".into(),
            ));
        }
        Some(true) => {}
        None => {
            if !validate(backup_path)? {
                return Err(AppError::Validation(
                    "Datei ist keine gültige SQLite-Sicherung (keine Signatur, Header ungültig)."
                        .into(),
                ));
            }
        }
    }

    let pre = create(pool).await.is_ok();

    let db_path = app_data_dir.join("medoc.db");
    pool.close().await;

    for suffix in ["-wal", "-shm", "-journal"] {
        let p = PathBuf::from(format!("{}{}", db_path.display(), suffix));
        let _ = std::fs::remove_file(p);
    }

    std::fs::copy(backup_path, &db_path).map_err(|e| {
        AppError::Internal(format!(
            "Wiederherstellung fehlgeschlagen (Kopie nach {}): {e}",
            db_path.display()
        ))
    })?;

    // `VACUUM INTO` may yield plaintext or SQLCipher (header is always "SQLite format 3").
    let key = db_key::ensure_sqlcipher_key(app_data_dir, false)?;
    if !sqlcipher::opens_with_sqlcipher_key(&db_path, &key).await {
        if sqlcipher::is_plaintext_sqlite_file(&db_path) {
            sqlcipher::migrate_plaintext_to_sqlcipher(&db_path, &key).await?;
        } else {
            return Err(AppError::Validation(
                "Wiederhergestellte Datei ist keine gültige MeDoc-Datenbank.".into(),
            ));
        }
    }

    log_system!(
        warn,
        event = "BACKUP_RESTORE",
        from = %backup_path.display(),
        target = %db_path.display(),
        pre_snapshot = pre,
    );

    Ok(RestoreReport {
        requires_app_restart: true,
        restored_from: backup_path.to_path_buf(),
        pre_restore_backup_created: pre,
    })
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
