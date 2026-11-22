//! Commands for the generic app key/value store.
//!
//! Keys are **whitelisted** to a known set so the FE cannot use this surface
//! to write arbitrary tables; this also documents the catalogue of practice-
//! wide settings persisted via SQLite (vs. the prior `localStorage` blob).
use crate::application::app_kv_policy;
use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::app_kv as app_kv_repo;
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_app_kv(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    key: String,
) -> Result<Option<String>, AppError> {
    let perm = app_kv_policy::read_permission_for_app_kv_key(&key)
        .ok_or_else(|| AppError::Validation(format!("Unknown KV key: {key}")))?;
    rbac::require(&session_state, perm)?;
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
        .ok_or_else(|| AppError::Validation(format!("Unknown KV key: {key}")))?;
    rbac::require(&session_state, perm)?;
    app_kv_policy::validate_app_kv_value(&key, &value)?;
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
        .ok_or_else(|| AppError::Validation(format!("Unknown KV key: {key}")))?;
    rbac::require(&session_state, perm)?;
    app_kv_repo::delete(&pool, &key).await
}
