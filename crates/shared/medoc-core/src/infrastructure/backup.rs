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

mod retention;
#[allow(unused_imports)]
pub use retention::*;

mod sealed;
#[allow(unused_imports)]
pub use sealed::*;

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

mod restore;
#[allow(unused_imports)]
pub use restore::*;

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
