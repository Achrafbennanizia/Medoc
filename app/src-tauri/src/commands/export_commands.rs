//! Native „Speichern unter“ for user exports. Programmatic `<a download>` is unreliable
//! in embedded WKWebView (common on macOS); this uses `rfd` like other file flows.

use base64::{engine::general_purpose::STANDARD, Engine as _};
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;

#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, contents_base64))]
pub fn save_export_file(
    session_state: State<'_, SessionState>,
    default_file_name: String,
    contents_base64: String,
) -> Result<Option<String>, AppError> {
    rbac::require_authenticated(&session_state)?;
    let raw = STANDARD
        .decode(contents_base64.trim())
        .map_err(|_| AppError::Validation("Ungültige Export-Daten (Base64).".into()))?;
    let path = rfd::FileDialog::new()
        .set_file_name(&default_file_name)
        .save_file();
    let Some(path) = path else {
        return Ok(None);
    };
    std::fs::write(&path, raw)
        .map_err(|e| AppError::Internal(format!("Datei schreiben: {e}")))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// Ordner für Standard-Exporte wählen (Settings → Export).
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn pick_export_directory(session_state: State<'_, SessionState>) -> Result<Option<String>, AppError> {
    rbac::require_authenticated(&session_state)?;
    let path = rfd::FileDialog::new().pick_folder();
    Ok(path.map(|p| p.to_string_lossy().into_owned()))
}

/// Schreibt Datei in einen bekannten Ordner (z. B. aus `export.path.v1`), ohne „Speichern unter“.
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, contents_base64))]
pub fn save_export_bytes_to_folder(
    session_state: State<'_, SessionState>,
    folder: String,
    file_name: String,
    contents_base64: String,
) -> Result<String, AppError> {
    rbac::require_authenticated(&session_state)?;
    let raw = STANDARD
        .decode(contents_base64.trim())
        .map_err(|_| AppError::Validation("Ungültige Export-Daten (Base64).".into()))?;
    let base = std::path::PathBuf::from(folder.trim());
    if !base.is_absolute() {
        return Err(AppError::Validation("Zielordner muss absolut sein.".into()));
    }
    let name = file_name.trim();
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::Validation("Ungültiger Dateiname.".into()));
    }
    let full = base.join(name);
    if let Some(parent) = full.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::Internal(format!("Ordner anlegen: {e}")))?;
    }
    std::fs::write(&full, raw).map_err(|e| AppError::Internal(format!("Datei schreiben: {e}")))?;
    Ok(full.to_string_lossy().into_owned())
}
