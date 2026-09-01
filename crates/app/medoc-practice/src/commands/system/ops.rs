// Operations commands: backup, DSGVO export/erasure, CSV import.

use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::{backup, gdpr, migration, retention};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub path: String,
    pub size_bytes: u64,
    /// `None` = legacy backup without sidecar; `Some` = HMAC verification result.
    pub signature_ok: Option<bool>,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn create_backup(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<BackupInfo, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    let path = backup::create(&pool).await?;
    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    Ok(BackupInfo {
        path: path.display().to_string(),
        size_bytes: size,
        signature_ok: Some(true),
    })
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn list_backups(session_state: State<'_, SessionState>) -> Result<Vec<BackupInfo>, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    backup::list().map(|version| {
        version.into_iter()
            .map(|e| BackupInfo {
                path: e.path.display().to_string(),
                size_bytes: e.size_bytes,
                signature_ok: e.signature_ok,
            })
            .collect()
    })
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, path))]
pub fn validate_backup(
    session_state: State<'_, SessionState>,
    path: String,
) -> Result<bool, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    backup::validate(&PathBuf::from(path))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreBackupResult {
    pub requires_app_restart: bool,
    pub restored_from: String,
    pub pre_restore_backup_created: bool,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(app, pool, session_state, path))]
pub async fn restore_backup(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    path: String,
) -> Result<RestoreBackupResult, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App data directory: {e}")))?;
    let report = backup::restore_from_backup(&pool, &app_dir, &PathBuf::from(path)).await?;
    Ok(RestoreBackupResult {
        requires_app_restart: report.requires_app_restart,
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
    rbac::require(&session_state, "ops.dsgvo")?;
    gdpr::export_patient(&pool, &patient_id).await
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
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App data directory: {e}")))?;
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
    let log_dir = dirs::home_dir()
        .map(|h| h.join("medoc-data").join("logs"))
        .unwrap_or_else(|| PathBuf::from("./medoc-data/logs"));
    retention::enforce(&log_dir)
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_ops_commands {
    () => {
        $crate::commands::ops_commands::create_backup,
        $crate::commands::ops_commands::list_backups,
        $crate::commands::ops_commands::validate_backup,
        $crate::commands::ops_commands::restore_backup,
        $crate::commands::ops_commands::dsgvo_export_patient,
        $crate::commands::ops_commands::dsgvo_erase_patient,
        $crate::commands::ops_commands::import_patients_csv,
        $crate::commands::ops_commands::pick_patients_csv_file,
        $crate::commands::ops_commands::pick_backup_file,
        $crate::commands::ops_commands::enforce_log_retention,
    };
}
