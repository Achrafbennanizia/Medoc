// Operations commands: backup, DSGVO export/erasure, CSV import.

use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::{backup, dsgvo, migration, retention};

#[derive(Debug, Serialize)]
pub struct BackupInfo {
    pub path: String,
    pub size_bytes: u64,
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
    })
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn list_backups(session_state: State<'_, SessionState>) -> Result<Vec<BackupInfo>, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    backup::list().map(|v| {
        v.into_iter()
            .map(|(p, s)| BackupInfo {
                path: p.display().to_string(),
                size_bytes: s,
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

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, patient_id))]
pub async fn dsgvo_export_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Value, AppError> {
    rbac::require(&session_state, "ops.dsgvo")?;
    dsgvo::export_patient(&pool, &patient_id).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, patient_id))]
pub async fn dsgvo_erase_patient(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<dsgvo::ErasureReport, AppError> {
    rbac::require(&session_state, "ops.dsgvo")?;
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App-Datenverzeichnis: {e}")))?;
    dsgvo::erase_patient(&pool, &patient_id, &app_dir).await
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
pub fn pick_patients_csv_file(session_state: State<'_, SessionState>) -> Result<Option<String>, AppError> {
    rbac::require(&session_state, "ops.migration")?;
    let path = rfd::FileDialog::new()
        .add_filter("CSV", &["csv"])
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
