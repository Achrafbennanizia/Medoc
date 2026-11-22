// Operations commands: backup, DSGVO export/erasure, CSV import.

use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::infrastructure::{backup, gdpr, migration, retention};

// snake_case on the wire: ops.controller.ts and every screen read `size_bytes`, `signature_ok`, …
#[derive(Debug, Serialize)]
pub struct BackupInfo {
    pub path: String,
    pub size_bytes: u64,
    /// `None` = legacy backup without sidecar; `Some` = HMAC verification result.
    pub signature_ok: Option<bool>,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(app, pool, session_state))]
pub async fn create_backup(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<BackupInfo, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    let app_dir = crate::commands::app_data_dir(&app)?;
    let path = backup::create_with_app_dir(&pool, Some(&app_dir)).await?;
    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    Ok(BackupInfo {
        path: path.display().to_string(),
        size_bytes: size,
        signature_ok: Some(true),
    })
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
    Ok(entries
        .into_iter()
        .map(|e| BackupInfo {
            path: e.path.display().to_string(),
            size_bytes: e.size_bytes,
            signature_ok: e.signature_ok,
        })
        .collect())
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
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(app, session_state, path))]
pub async fn restore_backup(
    app: AppHandle,
    session_state: State<'_, SessionState>,
    path: String,
) -> Result<RestoreBackupResult, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    if let Some(control) = app.try_state::<crate::commands::network::lan::LanServerControl>() {
        crate::commands::network::lan::stop_lan_listener(&control).await;
    }
    let app_dir = crate::commands::app_data_dir(&app)?;
    let report = {
        let pool = app.state::<SqlitePool>();
        backup::restore_from_backup(pool.inner(), &app_dir, &PathBuf::from(path)).await?
    };
    let reopened = crate::infrastructure::database::connection::reopen_app_pool(&app_dir).await?;
    // The command's State guard is already dropped. Swap the managed pool so
    // the next command uses the restored file without restarting the process.
    #[allow(deprecated)]
    let _closed = app.unmanage::<SqlitePool>();
    app.manage(reopened);
    Ok(RestoreBackupResult {
        requires_app_restart: false,
        restored_from: report.restored_from.display().to_string(),
        pre_restore_backup_created: report.pre_restore_backup_created,
    })
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
