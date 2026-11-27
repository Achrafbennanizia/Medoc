//! Sync problems and field conflicts an admin resolves on the main device (T3.3).

use medoc_sync::problems::{self, SyncProblem};
use sqlx::SqlitePool;
use tauri::State;

use crate::commands::admin::auth::SessionState;
use crate::commands::rbac_state::require;
use crate::error::AppError;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_problem_list(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    include_resolved: Option<bool>,
) -> Result<Vec<SyncProblem>, AppError> {
    require(&session_state, "ops.system")?;
    problems::list(&pool, include_resolved.unwrap_or(false)).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_problem_open_count(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<i64, AppError> {
    require(&session_state, "ops.system")?;
    problems::open_count(&pool).await
}

/// Applies the change again; for a field conflict, takes the other value.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_problem_retry(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = require(&session_state, "ops.system")?;
    problems::retry(&pool, &id, &session.user_id).await
}

/// Keeps the current data; the problem is closed.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_problem_dismiss(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = require(&session_state, "ops.system")?;
    problems::dismiss(&pool, &id, &session.user_id).await
}
