// Operations commands: backup, DSGVO export/erasure, CSV import.

use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::path::PathBuf;
use tauri::State;

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
pub fn validate_backup(
    session_state: State<'_, SessionState>,
    path: String,
) -> Result<bool, AppError> {
    rbac::require(&session_state, "ops.backup")?;
    backup::validate(&PathBuf::from(path))
}

#[tauri::command]
pub async fn dsgvo_export_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Value, AppError> {
    rbac::require(&session_state, "ops.dsgvo")?;
    dsgvo::export_patient(&pool, &patient_id).await
}

#[tauri::command]
pub async fn dsgvo_erase_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<dsgvo::ErasureReport, AppError> {
    rbac::require(&session_state, "ops.dsgvo")?;
    dsgvo::erase_patient(&pool, &patient_id).await
}

#[tauri::command]
pub async fn import_patients_csv(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    csv_path: String,
    dry_run: bool,
) -> Result<migration::ImportReport, AppError> {
    rbac::require(&session_state, "ops.migration")?;
    migration::import_patients(&pool, &PathBuf::from(csv_path), dry_run).await
}

#[tauri::command]
pub fn enforce_log_retention(
    session_state: State<'_, SessionState>,
) -> Result<retention::RetentionReport, AppError> {
    rbac::require(&session_state, "ops.system")?;
    let log_dir = dirs::home_dir()
        .map(|h| h.join("medoc-data").join("logs"))
        .unwrap_or_else(|| PathBuf::from("./medoc-data/logs"));
    retention::enforce(&log_dir)
}
