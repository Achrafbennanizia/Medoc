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
