// Operations commands: backup, DSGVO export/erasure, CSV import.

use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::{backup, backup_files, gdpr, migration, retention};

// snake_case on the wire: ops.controller.ts and every screen read `size_bytes`, `signature_ok`, …
#[derive(Debug, Serialize)]
pub struct BackupInfo {
    pub path: String,
    pub size_bytes: u64,
    /// `None` = legacy backup without sidecar; `Some` = HMAC verification result.
    pub signature_ok: Option<bool>,
    /// RFC 3339, from the file name.
    pub created_at: Option<String>,
    /// `.mdbk` (compressed + encrypted) or legacy `.db`.
    pub compressed: bool,
    /// Why it is kept: `daily`, `weekly`, `half_year` (empty: goes at the next rotation).
    pub tiers: Vec<backup::BackupTier>,
}

impl From<backup::BackupEntry> for BackupInfo {
    fn from(e: backup::BackupEntry) -> Self {
        BackupInfo {
            path: e.path.display().to_string(),
            size_bytes: e.size_bytes,
            signature_ok: e.signature_ok,
            created_at: e.created_at.map(|t| t.to_rfc3339()),
            compressed: e.compressed,
            tiers: e.tiers,
        }
    }
}

/// A failed backup action, in the audit log with the error code (who tried what, and why it failed).
async fn audit_backup_failure(
    pool: &SqlitePool,
    user_id: &str,
    action: &str,
    label: Option<&str>,
    e: &AppError,
) {
    let _ = audit_repo::create(
        pool,
        user_id,
        "BACKUP_FAILED",
        "Backup",
        label,
        Some(&format!("action={action}; error={}", e.wire_code())),
    )
    .await;
}

/// File name only, for the audit log (no full local path).
fn backup_label(path: &std::path::Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default()
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(app, pool, session_state))]
pub async fn create_backup(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<BackupInfo, AppError> {
    let session = rbac::require(&session_state, "ops.backup")?;
    let _op = backup::begin_operation()?;
    let app_dir = crate::commands::app_data_dir(&app)?;
    let path = match backup::create_compressed(&pool, &app_dir).await {
        Ok(p) => p,
        Err(e) => {
            audit_backup_failure(&pool, &session.user_id, "BACKUP_MANUAL", None, &e).await;
            return Err(e);
        }
    };
    audit_repo::create(
        &pool,
        &session.user_id,
        "BACKUP_MANUAL",
        "Backup",
        Some(&backup_label(&path)),
        None,
    )
    .await?;
    let entry = backup::list_metadata()?
        .into_iter()
        .find(|e| e.path == path)
        .ok_or_else(|| AppError::Internal("backup not listed after creation".into()))?;
    Ok(entry.into())
}

/// Lists backups off the UI thread. `verify_signatures` (default `true`) HMACs every signed
/// file — the Ops page wants that; About only needs metadata and passes `false`.
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub async fn list_backups(
    session_state: State<'_, SessionState>,
    verify_signatures: Option<bool>,
) -> Result<Vec<BackupInfo>, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    let verify = verify_signatures.unwrap_or(true);
    let entries = tokio::task::spawn_blocking(move || {
        if verify {
            backup::list()
        } else {
            backup::list_metadata()
        }
    })
    .await
    .map_err(|e| AppError::Internal(format!("backup listing task: {e}")))??;
    Ok(entries.into_iter().map(BackupInfo::from).collect())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, path))]
pub async fn validate_backup(
    app: AppHandle,
    session_state: State<'_, SessionState>,
    path: String,
) -> Result<bool, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    let app_dir = crate::commands::app_data_dir(&app)?;
    let key = crate::infrastructure::database::db_key::ensure_sqlcipher_key(&app_dir, false)?;
    backup::validate_open(&PathBuf::from(path), &key).await
}

// snake_case on the wire: ops.controller.ts and every screen read `size_bytes`, `signature_ok`, …
#[derive(Debug, Serialize)]
pub struct RestoreBackupResult {
    pub requires_app_restart: bool,
    pub restored_from: String,
    pub pre_restore_backup_created: bool,
    /// Attachments (X-rays, scans…) put back from the backup.
    pub restored_files: usize,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(app, session_state, path))]
pub async fn restore_backup(
    app: AppHandle,
    session_state: State<'_, SessionState>,
    path: String,
) -> Result<RestoreBackupResult, AppError> {
    let session = rbac::require(&session_state, "ops.backup")?;
    let _op = backup::begin_operation()?;
    if let Some(control) = app.try_state::<crate::commands::network::lan::LanServerControl>() {
        crate::commands::network::lan::stop_lan_listener(&control).await;
    }
    let app_dir = crate::commands::app_data_dir(&app)?;
    let label = backup_label(std::path::Path::new(&path));
    let report = {
        let pool = app.state::<SqlitePool>();
        // Record the attempt in the data being replaced: the restored database is older and
        // would not otherwise show that a restore was asked for.
        audit_repo::create(
            pool.inner(),
            &session.user_id,
            "BACKUP_RESTORE_START",
            "Backup",
            Some(&label),
            None,
        )
        .await
        .ok();
        match backup::restore_from_backup(pool.inner(), &app_dir, &PathBuf::from(&path)).await {
            Ok(r) => r,
            Err(e) => {
                // The live pool stays open when the checks refuse the backup; when the swap itself
                // failed it is closed and the record is written by the reopened pool below.
                if !pool.inner().is_closed() {
                    audit_backup_failure(
                        pool.inner(),
                        &session.user_id,
                        "BACKUP_RESTORE",
                        Some(&label),
                        &e,
                    )
                    .await;
                } else if let Ok(p) =
                    crate::infrastructure::database::connection::reopen_app_pool(&app_dir).await
                {
                    audit_backup_failure(&p, &session.user_id, "BACKUP_RESTORE", Some(&label), &e)
                        .await;
                    #[allow(deprecated)]
                    let _closed = app.unmanage::<SqlitePool>();
                    app.manage(p);
                }
                return Err(e);
            }
        }
    };
    let reopened = crate::infrastructure::database::connection::reopen_app_pool(&app_dir).await?;
    // The backup folder is a property of this computer, not of the data: keep the current choice
    // even if the restored (older) database remembers another one.
    let folder = serde_json::json!({
        "path": backup_files::chosen_backup_dir().map(|d| d.display().to_string())
    });
    crate::infrastructure::database::repos::admin::app_kv::set(
        &reopened,
        backup_files::DIR_KV_KEY,
        &folder.to_string(),
    )
    .await
    .ok();
    // And in the restored data, so the record survives the jump back in time.
    audit_repo::create(
        &reopened,
        &session.user_id,
        "BACKUP_RESTORE",
        "Backup",
        Some(&label),
        None,
    )
    .await?;
    // The command's State guard is already dropped. Swap the managed pool so
    // the next command uses the restored file without restarting the process.
    #[allow(deprecated)]
    let _closed = app.unmanage::<SqlitePool>();
    app.manage(reopened);
    Ok(RestoreBackupResult {
        requires_app_restart: false,
        restored_from: report.restored_from.display().to_string(),
        pre_restore_backup_created: report.pre_restore_backup_created,
        restored_files: report.restored_files,
    })
}

/// Settings → Backups: everything the page shows in one call.
#[derive(Debug, Serialize)]
pub struct BackupOverview {
    pub enabled: bool,
    /// Last schedule change: `{enabled, changedBy, changedAt, reason}` (absent: never changed).
    pub schedule: Option<Value>,
    /// Folder backups go to now.
    pub backup_dir: String,
    /// Folder chosen in Settings (None = this computer's default folder).
    pub chosen_dir: Option<String>,
    /// The chosen folder is missing (drive unplugged): backups go to `backup_dir` meanwhile.
    pub chosen_dir_missing: bool,
    /// The active folder is on a USB stick, external disk or network share.
    pub external: bool,
    pub default_dir: String,
    pub total_bytes: u64,
    /// Attachments stored with the backups (shared encrypted copies): count and bytes.
    pub files_count: u64,
    pub files_bytes: u64,
    pub backups: Vec<BackupInfo>,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn backup_overview(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<BackupOverview, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    let entries = tokio::task::spawn_blocking(backup::list)
        .await
        .map_err(|e| AppError::Internal(format!("backup listing task: {e}")))??;
    let schedule =
        crate::infrastructure::database::repos::admin::app_kv::get(&pool, backup::SCHEDULE_KV_KEY)
            .await?
            .and_then(|v| serde_json::from_str::<Value>(&v).ok());
    let (active, missing) = backup_files::active_backup_dir();
    let (files_count, files_bytes) = backup_files::store_usage(&active);
    Ok(BackupOverview {
        enabled: backup::schedule_enabled(&pool).await,
        schedule,
        backup_dir: active.display().to_string(),
        chosen_dir: backup_files::chosen_backup_dir().map(|d| d.display().to_string()),
        chosen_dir_missing: missing,
        external: backup_files::is_external_location(&active),
        default_dir: backup_files::default_backup_dir().display().to_string(),
        total_bytes: entries.iter().map(|e| e.size_bytes).sum::<u64>() + files_bytes,
        files_count,
        files_bytes,
        backups: entries.into_iter().map(BackupInfo::from).collect(),
    })
}

/// Native folder picker for the backup folder (USB stick, external disk).
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn pick_backup_folder(
    session_state: State<'_, SessionState>,
) -> Result<Option<String>, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    Ok(rfd::FileDialog::new()
        .pick_folder()
        .map(|p| p.to_string_lossy().into_owned()))
}

/// Sets the backup folder (`None` = this computer's default). The folder is created and must be
/// writable; backups are kept in a `MeDoc-Backups` subfolder. Existing backups stay where they
/// are. Recorded in the audit log and the app log.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn set_backup_folder(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    path: Option<String>,
) -> Result<BackupOverview, AppError> {
    let session = rbac::require(&session_state, "ops.backup")?;
    let _op = backup::begin_operation()?;
    let chosen = match path.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
        Some(p) => {
            let base = PathBuf::from(p);
            // A subfolder keeps MeDoc's files apart from whatever else is on the stick.
            let dir = if base
                .file_name()
                .map(|n| n == "MeDoc-Backups")
                .unwrap_or(false)
            {
                base
            } else {
                base.join("MeDoc-Backups")
            };
            backup_files::validate_target_dir(&dir)?;
            Some(dir)
        }
        None => None,
    };
    let value = serde_json::json!({ "path": chosen.as_ref().map(|d| d.display().to_string()) });
    crate::infrastructure::database::repos::admin::app_kv::set(
        &pool,
        backup_files::DIR_KV_KEY,
        &value.to_string(),
    )
    .await?;
    backup_files::set_chosen_backup_dir(chosen.clone());
    let shown = chosen
        .as_ref()
        .map(|d| d.display().to_string())
        .unwrap_or_else(|| "default".into());
    audit_repo::create(
        &pool,
        &session.user_id,
        "BACKUP_FOLDER_CHANGED",
        "Backup",
        None,
        Some(&format!(
            "folder={shown}; external={}",
            chosen
                .as_deref()
                .map(backup_files::is_external_location)
                .unwrap_or(false)
        )),
    )
    .await?;
    tracing::warn!(target: "medoc::system", event = "BACKUP_FOLDER_CHANGED", folder = %shown);
    drop(_op);
    backup_overview(pool, session_state).await
}

/// Pause or resume the automatic daily backup. Pausing needs a reason (kept in the audit log).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, reason))]
pub async fn set_backup_schedule(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    enabled: bool,
    reason: Option<String>,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "ops.backup")?;
    let reason = reason.unwrap_or_default();
    if !enabled && reason.trim().len() < 3 {
        return Err(AppError::validation_code("error.backup.reason_required"));
    }
    backup::set_schedule(&pool, enabled, &session.user_id, &reason).await
}

/// Delete every backup and start again with a fresh one. Needs a reason (audit log).
#[tauri::command]
#[tracing::instrument(level = "info", skip(app, pool, session_state, reason))]
pub async fn reset_backups(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    reason: String,
) -> Result<BackupInfo, AppError> {
    let session = rbac::require(&session_state, "ops.backup")?;
    if reason.trim().len() < 3 {
        return Err(AppError::validation_code("error.backup.reason_required"));
    }
    let _op = backup::begin_operation()?;
    let app_dir = crate::commands::app_data_dir(&app)?;
    let deleted = match backup::delete_all() {
        Ok(n) => n,
        Err(e) => {
            audit_backup_failure(&pool, &session.user_id, "BACKUP_RESET", None, &e).await;
            return Err(e);
        }
    };
    audit_repo::create(
        &pool,
        &session.user_id,
        "BACKUP_RESET",
        "Backup",
        None,
        Some(&format!("deleted={deleted}; reason={}", reason.trim())),
    )
    .await?;
    let path = match backup::create_compressed(&pool, &app_dir).await {
        Ok(p) => p,
        Err(e) => {
            audit_backup_failure(&pool, &session.user_id, "BACKUP_MANUAL", None, &e).await;
            return Err(e);
        }
    };
    audit_repo::create(
        &pool,
        &session.user_id,
        "BACKUP_MANUAL",
        "Backup",
        Some(&backup_label(&path)),
        Some("after reset"),
    )
    .await?;
    let entry = backup::list_metadata()?
        .into_iter()
        .find(|e| e.path == path)
        .ok_or_else(|| AppError::Internal("backup not listed after creation".into()))?;
    Ok(entry.into())
}

/// Delete one backup (and its signature and key files). Needs a reason (audit log).
/// Only files in the backup folder; the last remaining backup cannot be deleted.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, path, reason))]
pub async fn delete_backup(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    path: String,
    reason: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "ops.backup")?;
    if reason.trim().len() < 3 {
        return Err(AppError::validation_code("error.backup.reason_required"));
    }
    let _op = backup::begin_operation()?;
    let label = backup_label(std::path::Path::new(&path));
    match backup::delete_one(std::path::Path::new(&path)) {
        Ok(name) => {
            audit_repo::create(
                &pool,
                &session.user_id,
                "BACKUP_DELETE",
                "Backup",
                Some(&name),
                Some(&format!("reason={}", reason.trim())),
            )
            .await?;
            Ok(())
        }
        Err(e) => {
            audit_backup_failure(&pool, &session.user_id, "BACKUP_DELETE", Some(&label), &e).await;
            Err(e)
        }
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, patient_id))]
pub async fn dsgvo_export_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Value, AppError> {
    let session = rbac::require(&session_state, "ops.dsgvo")?;
    let export = gdpr::export_patient(&pool, &patient_id).await?;
    // Art. 15 disclosures are themselves processing → audit them.
    crate::infrastructure::database::repos::admin::audit::create(
        &pool,
        &session.user_id,
        "DSGVO_EXPORT",
        "Patient",
        Some(&patient_id),
        None,
    )
    .await?;
    Ok(export)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, patient_id))]
pub async fn dsgvo_erase_patient(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<gdpr::ErasureReport, AppError> {
    rbac::require(&session_state, "ops.dsgvo")?;
    let app_dir = crate::commands::app_data_dir(&app)?;
    gdpr::erase_patient(&pool, &patient_id, &app_dir).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, csv_path))]
pub async fn import_patients_csv(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    csv_path: String,
    dry_run: bool,
) -> Result<migration::ImportReport, AppError> {
    rbac::require(&session_state, "ops.migration")?;
    migration::import_patients(&pool, &PathBuf::from(csv_path), dry_run).await
}

/// Native file picker for CSV import (ops UI); avoids manual path typing.
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn pick_patients_csv_file(
    session_state: State<'_, SessionState>,
) -> Result<Option<String>, AppError> {
    rbac::require(&session_state, "ops.migration")?;
    let path = rfd::FileDialog::new()
        .add_filter("CSV", &["csv"])
        .pick_file();
    Ok(path.map(|p| p.to_string_lossy().into_owned()))
}

/// Native file picker for backup validation (avoids manual path typing / wrong separators).
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn pick_backup_file(
    session_state: State<'_, SessionState>,
) -> Result<Option<String>, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    let path = rfd::FileDialog::new()
        .add_filter("Sicherung", &["db", "sqlite", "sqlite3", "zip"])
        .pick_file();
    Ok(path.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn enforce_log_retention(
    session_state: State<'_, SessionState>,
) -> Result<retention::RetentionReport, AppError> {
    rbac::require(&session_state, "ops.system")?;
    // F53: the directory logging::init writes to (app data dir), not ~/medoc-data.
    let log_dir = medoc_core::infrastructure::logging::log_dir()?.to_path_buf();
    retention::enforce(&log_dir)
}
