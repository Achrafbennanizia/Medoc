//! Tauri IPC command surface — grouped by domain.

use tauri::Manager;

use crate::error::AppError;

pub fn app_data_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, AppError> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App data directory: {e}")))
}

pub mod admin;
pub mod app_lifecycle;
pub mod billing;
pub mod clinical;
pub mod documents;
pub mod list_params;
pub mod network;
pub mod ownership;
pub mod practice;
pub mod rbac_state;
pub mod register;
pub mod scheduling;
pub mod system;
