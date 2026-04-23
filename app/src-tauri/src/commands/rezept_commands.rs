use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::rezept::CreateRezept;
use crate::domain::entities::Rezept;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, rezept_repo};

#[tauri::command]
pub async fn list_rezepte(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Vec<Rezept>, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let r = rezept_repo::find_for_patient(&pool, &patient_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Rezept",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(r)
}

#[tauri::command]
pub async fn create_rezept(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateRezept,
) -> Result<Rezept, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let r = rezept_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Rezept",
        Some(&r.id),
        None,
    )
    .await
    .ok();
    Ok(r)
}

#[tauri::command]
pub async fn delete_rezept(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    rezept_repo::delete(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Rezept", Some(&id), None)
        .await
        .ok();
    Ok(())
}
