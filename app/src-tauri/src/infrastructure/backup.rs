// Backup & restore (NFA-SEC-08, supports DSGVO + system continuity).
//
// Uses SQLite's built-in `VACUUM INTO` to produce a self-contained snapshot
// that includes WAL contents and skips free pages. Snapshots are timestamped
// and stored under `~/medoc-data/backups/`.

use chrono::Utc;
use sqlx::SqlitePool;
use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::log_system;

pub fn backup_dir() -> PathBuf {
    dirs::home_dir()
        .map(|h| h.join("medoc-data").join("backups"))
        .unwrap_or_else(|| PathBuf::from("./medoc-data/backups"))
}

/// Create a timestamped backup of the live database.
pub async fn create(pool: &SqlitePool) -> Result<PathBuf, AppError> {
    let dir = backup_dir();
    std::fs::create_dir_all(&dir).map_err(|e| AppError::Internal(format!("backup dir: {e}")))?;

    let ts = Utc::now().format("%Y%m%dT%H%M%SZ");
    let target = dir.join(format!("medoc-{ts}.db"));

    log_system!(info, event = "BACKUP_START", target = %target.display());

    // SQLite string literal: escape single quotes by doubling them (path injection hardening).
    let path_lit = target.display().to_string().replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{path_lit}'"))
        .execute(pool)
        .await
        .map_err(|e| {
            log_system!(error, event = "BACKUP_FAILED", error = %e);
            AppError::Internal(format!("VACUUM INTO failed: {e}"))
        })?;

    let size = std::fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
    log_system!(info, event = "BACKUP_COMPLETE", target = %target.display(), bytes = size);

    Ok(target)
}

/// List all backup files (newest first).
pub fn list() -> Result<Vec<(PathBuf, u64)>, AppError> {
    let dir = backup_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut entries: Vec<(PathBuf, u64)> = std::fs::read_dir(&dir)
        .map_err(|e| AppError::Internal(e.to_string()))?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("db"))
        .map(|e| {
            let size = e.metadata().map(|m| m.len()).unwrap_or(0);
            (e.path(), size)
        })
        .collect();
    entries.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(entries)
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
