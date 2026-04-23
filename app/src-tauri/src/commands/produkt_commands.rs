use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::produkt::{CreateProdukt, UpdateProdukt};
use crate::domain::entities::Produkt;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, produkt_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn list_produkte(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Produkt>, AppError> {
    rbac::require(&session_state, "produkt.read")?;
    produkt_repo::find_all(&pool).await
}

#[tauri::command]
pub async fn create_produkt(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateProdukt,
) -> Result<Produkt, AppError> {
    let session = rbac::require(&session_state, "produkt.write")?;
    let p = produkt_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Produkt",
        Some(&p.id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

#[tauri::command]
pub async fn update_produkt(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdateProdukt,
) -> Result<Produkt, AppError> {
    let session = rbac::require(&session_state, "produkt.write")?;
    let p = produkt_repo::update(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Produkt",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

#[tauri::command]
pub async fn delete_produkt(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "produkt.write")?;
    produkt_repo::delete(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Produkt",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}
