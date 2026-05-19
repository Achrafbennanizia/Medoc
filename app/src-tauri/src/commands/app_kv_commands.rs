//! Commands for the generic app key/value store.
//!
//! Keys are **whitelisted** to a known set so the FE cannot use this surface
//! to write arbitrary tables; this also documents the catalogue of practice-
//! wide settings persisted via SQLite (vs. the prior `localStorage` blob).
use crate::application::app_kv_policy;
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::app_kv_repo;
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_app_kv(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    key: String,
) -> Result<Option<String>, AppError> {
    if app_kv_policy::permission_for_app_kv_key(&key).is_none() {
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
    let perm = app_kv_policy::permission_for_app_kv_key(&key)
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
    let perm = app_kv_policy::permission_for_app_kv_key(&key)
        .ok_or_else(|| AppError::Validation(format!("Unbekannter KV-Key: {key}")))?;
    rbac::require(&session_state, perm)?;
    app_kv_repo::delete(&pool, &key).await
}
