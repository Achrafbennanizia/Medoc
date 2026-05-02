//! Tagesabschluss (Kasse / Abgleich) — protokollierte Läufe.
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::tagesabschluss_protokoll::{CreateTagesabschlussProtokoll, TagesabschlussProtokoll};
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, tagesabschluss_protokoll_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_tagesabschluss_protokolle(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<TagesabschlussProtokoll>, AppError> {
    rbac::require(&session_state, "finanzen.read")?;
    tagesabschluss_protokoll_repo::list(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_tagesabschluss_protokoll(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<TagesabschlussProtokoll, AppError> {
    rbac::require(&session_state, "finanzen.read")?;
    tagesabschluss_protokoll_repo::get(&pool, &id).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_tagesabschluss_protokoll(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateTagesabschlussProtokoll,
) -> Result<TagesabschlussProtokoll, AppError> {
    let session = rbac::require(&session_state, "finanzen.tagesabschluss.write")?;
    let row = tagesabschluss_protokoll_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "TagesabschlussProtokoll",
        Some(&row.id),
        Some(&format!("stichtag={}", row.stichtag)),
    )
    .await
    .ok();
    Ok(row)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_tagesabschluss_protokoll(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "finanzen.tagesabschluss.write")?;
    tagesabschluss_protokoll_repo::delete_row(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "TagesabschlussProtokoll",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}
