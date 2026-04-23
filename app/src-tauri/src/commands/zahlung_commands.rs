use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::zahlung::{Bilanz, CreateZahlung};
use crate::domain::entities::Zahlung;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, zahlung_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn list_zahlungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Zahlung>, AppError> {
    rbac::require(&session_state, "finanzen.read")?;
    zahlung_repo::find_all(&pool).await
}

#[tauri::command]
pub async fn create_zahlung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateZahlung,
) -> Result<Zahlung, AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    let z = zahlung_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Zahlung",
        Some(&z.id),
        None,
    )
    .await
    .ok();
    Ok(z)
}

#[tauri::command]
pub async fn update_zahlung_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    status: String,
) -> Result<Zahlung, AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    let z = zahlung_repo::update_status(&pool, &id, &status).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE_STATUS",
        "Zahlung",
        Some(&id),
        Some(&status),
    )
    .await
    .ok();
    Ok(z)
}

#[tauri::command]
pub async fn get_bilanz(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Bilanz, AppError> {
    rbac::require(&session_state, "finanzen.read")?;
    zahlung_repo::get_bilanz(&pool).await
}
