//! Initial DB passphrase setup / unlock when keyring is unavailable.
//!
//! Also exposes [`init_db_from_app`] — the Tauri-bound entry point that
//! resolves the desktop app's `app_data_dir` and delegates to the
//! Tauri-free [`crate::infrastructure::database::connection::init_db_headless`].
//! Keeping the `AppHandle` boundary in `commands/` (rather than in
//! `infrastructure/database/`) lets the `database` module live without a
//! `tauri` dependency.

use serde::Serialize;
use sqlx::sqlite::SqlitePool;
use tauri::{AppHandle, Manager};

use crate::error::AppError;
use crate::infrastructure::database::connection::init_db_headless;
use crate::infrastructure::database::db_key;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbSetupStatusDto {
    pub needs_passphrase_setup: bool,
    pub needs_unlock: bool,
}

/// Tauri-bound DB initialisation: resolves `app_data_dir` from the
/// `AppHandle` and delegates to the headless initialiser. The desktop
/// binary (`lib.rs::run`) calls this once at startup.
pub async fn init_db_from_app(app: &AppHandle) -> Result<SqlitePool, AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App-Datenverzeichnis nicht verfügbar: {e}")))?;
    init_db_headless(&app_dir).await
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn get_db_setup_status(app: AppHandle) -> Result<DbSetupStatusDto, AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App-Datenverzeichnis: {e}")))?;
    let db_path = app_dir.join("medoc.db");
    let wrap = db_key::wrap_path(&app_dir);
    let keyring_ok = db_key::env_override_key().is_some() || db_key::try_keyring_key().is_some();
    let needs_unlock = wrap.exists() && !keyring_ok && db_path.exists();
    let needs_passphrase_setup = !db_path.exists() && !keyring_ok && !wrap.exists();
    Ok(DbSetupStatusDto {
        needs_passphrase_setup,
        needs_unlock,
    })
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn provision_db_passphrase(
    app: AppHandle,
    passphrase: String,
    confirm: String,
) -> Result<(), AppError> {
    if passphrase != confirm {
        return Err(AppError::Validation(
            "Passphrasen stimmen nicht überein.".into(),
        ));
    }
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App-Datenverzeichnis: {e}")))?;
    db_key::provision_user_passphrase(&app_dir, &passphrase)
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn unlock_db_passphrase(app: AppHandle, passphrase: String) -> Result<(), AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App-Datenverzeichnis: {e}")))?;
    let _ = db_key::unlock_with_passphrase(&app_dir, &passphrase)?;
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_db_setup_commands {
    () => {
        $crate::commands::db_setup_commands::get_db_setup_status,
        $crate::commands::db_setup_commands::provision_db_passphrase,
        $crate::commands::db_setup_commands::unlock_db_passphrase,
    };
}
