//! Commands for the generic app key/value store.
//!
//! Keys are **whitelisted** to a known set so the FE cannot use this surface
//! to write arbitrary tables; this also documents the catalogue of practice-
//! wide settings persisted via SQLite (vs. the prior `localStorage` blob).
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;
use sqlx::SqlitePool;
use tauri::State;

/// Allowed keys. Reading is open to any authenticated user; mutation requires
/// a per-key permission (mapped to the closest existing scope).
fn permission_for(key: &str) -> Option<&'static str> {
    match key {
        // Praxis-wide working schedule + special closure rules.
        "praxis.arbeitszeiten.v1" | "praxis.sperrzeiten.v1" => Some("ops.system"),
        // Per-practice user-facing preferences (theme, density, ...).
        "praxis.preferences.v1" | "praxis.preferences-termin.v1" => Some("dashboard.read"),
        // Export / print defaults (practice workstation — same scope as client prefs).
        "export.path.v1" | "export.formats.v1" | "praxis.logo.v1" => Some("dashboard.read"),
        _ => None,
    }
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_app_kv(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    key: String,
) -> Result<Option<String>, AppError> {
    if permission_for(&key).is_none() {
        return Err(AppError::Validation(format!("Unbekannter KV-Key: {key}")));
    }
    rbac::require_authenticated(&session_state)?;
    app_kv_repo::get(&pool, &key).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, value))]
pub async fn set_app_kv(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    let perm = permission_for(&key)
        .ok_or_else(|| AppError::Validation(format!("Unbekannter KV-Key: {key}")))?;
    rbac::require(&session_state, perm)?;
    app_kv_repo::set(&pool, &key, &value).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_app_kv(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    key: String,
) -> Result<(), AppError> {
    let perm = permission_for(&key)
        .ok_or_else(|| AppError::Validation(format!("Unbekannter KV-Key: {key}")))?;
    rbac::require(&session_state, perm)?;
    app_kv_repo::delete(&pool, &key).await
}
