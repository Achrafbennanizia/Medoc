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
use tauri::AppHandle;

use crate::error::AppError;
use crate::infrastructure::database::connection::init_db_headless;
use crate::infrastructure::database::db_key;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbSetupStatusDto {
    pub needs_passphrase_setup: bool,
    pub needs_unlock: bool,
    /// Safe-bridge checklist copy for the provision screen (Bridge B).
    pub recovery_checklist: Vec<String>,
}

/// Tauri-bound DB initialisation: resolves `app_data_dir` from the
/// `AppHandle` and delegates to the headless initialiser. The desktop
/// binary (`lib.rs::run`) calls this once at startup.
pub async fn init_db_from_app(app: &AppHandle) -> Result<SqlitePool, AppError> {
    let app_dir = crate::commands::app_data_dir(app)?;
    init_db_headless(&app_dir).await
}

#[tauri::command]
pub async fn get_db_setup_status(app: AppHandle) -> Result<DbSetupStatusDto, AppError> {
    let app_dir = crate::commands::app_data_dir(&app)?;
    let db_path = app_dir.join("medoc.db");
    let wrap = db_key::wrap_path(&app_dir);
    let keyring_ok = db_key::env_override_key().is_some() || db_key::try_keyring_key().is_some();
    let needs_unlock = wrap.exists() && !keyring_ok && db_path.exists();
    let needs_passphrase_setup = !needs_unlock && db_key::bridge_b_passphrase_required(&app_dir);
    Ok(DbSetupStatusDto {
        needs_passphrase_setup,
        needs_unlock,
        recovery_checklist: if needs_passphrase_setup {
            vec![
                "Keep this passphrase offline (password manager or sealed envelope).".into(),
                "Optionally keep a copy of activation.json (Bridge A) offline.".into(),
                "Vendor license alone cannot open the database.".into(),
                "Disaster recovery: medoc-recovery CLI (Bridge A/B/C).".into(),
            ]
        } else {
            Vec::new()
        },
    })
}

#[tauri::command]
pub async fn provision_db_passphrase(
    app: AppHandle,
    passphrase: String,
    confirm: String,
) -> Result<(), AppError> {
    if passphrase != confirm {
        return Err(AppError::Validation("Passphrases do not match.".into()));
    }
    let app_dir = crate::commands::app_data_dir(&app)?;
    db_key::provision_user_passphrase(&app_dir, &passphrase)
}

#[tauri::command]
pub async fn unlock_db_passphrase(app: AppHandle, passphrase: String) -> Result<(), AppError> {
    let app_dir = crate::commands::app_data_dir(&app)?;
    let _ = db_key::unlock_with_passphrase(&app_dir, &passphrase)?;
    Ok(())
}
