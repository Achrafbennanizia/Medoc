use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::termin::{CreateTermin, UpdateTermin};
use crate::domain::entities::Termin;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, termin_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn list_termine(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Termin>, AppError> {
    rbac::require(&session_state, "termin.read")?;
    termin_repo::find_all(&pool).await
}

#[tauri::command]
pub async fn get_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<Termin, AppError> {
    rbac::require(&session_state, "termin.read")?;
    termin_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("Termin".into()))
}

#[tauri::command]
pub async fn create_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateTermin,
) -> Result<Termin, AppError> {
    let session = rbac::require(&session_state, "termin.write")?;
    let t = termin_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Termin",
        Some(&t.id),
        None,
    )
    .await
    .ok();
    Ok(t)
}

#[tauri::command]
pub async fn update_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdateTermin,
) -> Result<Termin, AppError> {
    let session = rbac::require(&session_state, "termin.write")?;
    let t = termin_repo::update(&pool, &id, &data).await?;
    audit_repo::create(&pool, &session.user_id, "UPDATE", "Termin", Some(&id), None)
        .await
        .ok();
    Ok(t)
}

#[tauri::command]
pub async fn delete_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "termin.write")?;
    termin_repo::delete(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Termin", Some(&id), None)
        .await
        .ok();
    Ok(())
}

#[tauri::command]
pub async fn list_termine_by_date(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    datum: String,
) -> Result<Vec<Termin>, AppError> {
    rbac::require(&session_state, "termin.read")?;
    termin_repo::find_by_date(&pool, &datum).await
}
