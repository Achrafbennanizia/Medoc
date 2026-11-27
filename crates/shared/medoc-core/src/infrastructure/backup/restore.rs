//! Restoring a backup over the live database, and validating backup files (split from `backup.rs`).

use super::*;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreReport {
    /// Live DB pool was closed; restart the app before further work.
    pub requires_app_restart: bool,
    /// Path of the file copied into `medoc.db`.
    pub restored_from: PathBuf,
    /// Whether a pre-restore safety snapshot was created.
    pub pre_restore_backup_created: bool,
    /// Attachments put back from the backup (missing or changed here).
    pub restored_files: usize,
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
        // The attachment list is read now: the safety backup below may rotate it away.
        let files = super::super::backup_files::load_restore_list(backup_path)?;
        // Outside the backup folder, so rotation during the restore cannot touch it.
        let unpacked = app_data_dir.join("medoc-restore-unpacked.db");
        unpack_to_encrypted_db(backup_path, &key, &unpacked).await?;
        write_signature(&unpacked)?;
        let outcome = Box::pin(restore_from_backup(pool, app_data_dir, &unpacked)).await;
        let _ = std::fs::remove_file(&unpacked);
        let _ = std::fs::remove_file(sig_path(&unpacked));
        let mut report = outcome?;
        report.restored_from = backup_path.to_path_buf();
        // The database is back; now the X-rays and scans it refers to.
        if let Some((dir, list)) = files {
            let app_dir = app_data_dir.to_path_buf();
            report.restored_files = super::super::backup_files::run_in_background(move || {
                super::super::backup_files::restore_attachments(&app_dir, &dir, &list, &key)
            })
            .await?;
        }
        return Ok(report);
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
        restored_files: 0,
    })
}

/// Snapshot the live data, then swap in `source`. Returns the snapshot path.
pub(super) async fn restore_staged(
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

pub(super) fn db_sidecar(db_path: &Path, suffix: &str) -> PathBuf {
    let mut os = db_path.as_os_str().to_owned();
    os.push(suffix);
    PathBuf::from(os)
}

pub(super) fn remove_db_sidecars(db_path: &Path) {
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
pub(super) async fn replace_live_db_with_backup(
    db_path: &Path,
    backup_path: &Path,
) -> Result<(), AppError> {
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
