use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::leistung::{CreateLeistung, UpdateLeistung};
use crate::domain::entities::Leistung;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, leistung_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn list_leistungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Leistung>, AppError> {
    rbac::require(&session_state, "finanzen.read")?;
    leistung_repo::find_all(&pool).await
}

#[tauri::command]
pub async fn create_leistung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateLeistung,
) -> Result<Leistung, AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    let l = leistung_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Leistung",
        Some(&l.id),
        None,
    )
    .await
    .ok();
    Ok(l)
}

#[tauri::command]
pub async fn update_leistung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdateLeistung,
) -> Result<Leistung, AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    let l = leistung_repo::update(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Leistung",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(l)
}

#[tauri::command]
pub async fn delete_leistung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    leistung_repo::delete(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Leistung",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}
