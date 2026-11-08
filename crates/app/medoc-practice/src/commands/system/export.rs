//! Native “Save As” for user exports. Programmatic `<a download>` is unreliable
//! in embedded WKWebView (common on macOS); this uses `rfd` like other file flows.

use std::path::{Component, Path, PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac::{self, effective_allowed, Role};
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;

/// Resolved export file. `folder` must be absolute, contain no `..`, and stay inside `allowed_root`.
pub fn export_file_path(
    allowed_root: &Path,
    folder: &Path,
    file_name: &str,
) -> Result<PathBuf, AppError> {
    let name = file_name.trim();
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(AppError::validation_code("error.export.invalid_filename"));
    }
    if !folder.is_absolute() || !allowed_root.is_absolute() {
        return Err(AppError::validation_code(
            "error.export.folder_must_be_absolute",
        ));
    }
    if path_has_parent(folder) || path_has_parent(allowed_root) {
        return Err(AppError::validation_code("error.export.invalid_filename"));
    }
    let root = allowed_root.canonicalize().map_err(|_| {
        AppError::validation_code("error.export.folder_outside_root")
    })?;
    let folder_real = folder.canonicalize().map_err(|_| {
        AppError::validation_code("error.export.folder_outside_root")
    })?;
    if folder_real != root && !folder_real.starts_with(&root) {
        return Err(AppError::validation_code(
            "error.export.folder_outside_root",
        ));
    }
    let full = folder_real.join(name);
    if !full.starts_with(&root) {
        return Err(AppError::validation_code(
            "error.export.folder_outside_root",
        ));
    }
    Ok(full)
}

fn path_has_parent(path: &Path) -> bool {
    path.components().any(|c| matches!(c, Component::ParentDir))
}

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
        .map_err(|_| AppError::validation_code("error.export.invalid_base64"))?;
    let path = rfd::FileDialog::new()
        .set_file_name(&default_file_name)
        .save_file();
    let Some(path) = path else {
        return Ok(None);
    };
    std::fs::write(&path, raw).map_err(|e| AppError::Internal(format!("Write file: {e}")))?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

/// Choose a folder for default exports (Settings → Export).
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state))]
pub fn pick_export_directory(
    session_state: State<'_, SessionState>,
) -> Result<Option<String>, AppError> {
    rbac::require_authenticated(&session_state)?;
    let path = rfd::FileDialog::new().pick_folder();
    Ok(path.map(|p| p.to_string_lossy().into_owned()))
}

/// Write a file into a known folder (e.g. from `export.path.v1`), without “Save As”.
#[tauri::command]
#[tracing::instrument(level = "info", skip(session_state, contents_base64))]
pub async fn save_export_bytes_to_folder(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    folder: String,
    file_name: String,
    contents_base64: String,
) -> Result<String, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let raw = STANDARD
        .decode(contents_base64.trim())
        .map_err(|_| AppError::validation_code("error.export.invalid_base64"))?;
    let requested = PathBuf::from(folder.trim());
    if !requested.is_absolute() || path_has_parent(&requested) {
        return Err(AppError::validation_code(
            "error.export.folder_must_be_absolute",
        ));
    }
    let role = Role::parse(&session.role).ok_or(AppError::Forbidden)?;
    let ops = effective_allowed("ops.system", role, &session.permission_overrides);
    let allowed = if ops {
        requested.clone()
    } else {
        let configured = app_kv_repo::get(&pool, "export.path.v1")
            .await?
            .unwrap_or_default();
        let configured = configured.trim();
        if configured.is_empty() {
            return Err(AppError::validation_code(
                "error.export.folder_outside_root",
            ));
        }
        PathBuf::from(configured)
    };
    if ops {
        std::fs::create_dir_all(&requested)
            .map_err(|e| AppError::Internal(format!("Create folder: {e}")))?;
    }
    let full = export_file_path(&allowed, &requested, &file_name)?;
    std::fs::write(&full, raw).map_err(|e| AppError::Internal(format!("Write file: {e}")))?;
    Ok(full.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::export_file_path;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn export_rejects_a_folder_outside_the_configured_root() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("medoc-export-{stamp}"));
        let other = std::env::temp_dir().join(format!("medoc-export-other-{stamp}"));
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&other).unwrap();
        let inside = export_file_path(&root, &root, "chart.csv").unwrap();
        assert!(inside.ends_with("chart.csv"));
        assert!(export_file_path(&root, &other, "chart.csv").is_err());
        assert!(export_file_path(&root, &root.join("../etc"), "chart.csv").is_err());
        assert!(export_file_path(&root, &root, "../chart.csv").is_err());
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&other);
    }
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_export_commands {
    () => {
        $crate::commands::export_commands::save_export_file,
        $crate::commands::export_commands::pick_export_directory,
        $crate::commands::export_commands::save_export_bytes_to_folder,
    };
}
