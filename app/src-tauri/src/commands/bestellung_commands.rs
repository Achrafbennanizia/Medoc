//! Tauri commands for purchase orders (Bestellungen).
//!
//! - RBAC enforced via [`rbac::require`] with `bestellung.read`/`bestellung.write`.
//! - Mutations are recorded in the audit log so the inventory trail is auditable.
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::bestellung::{Bestellung, CreateBestellung, UpdateBestellung};
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, bestellung_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_bestellungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Bestellung>, AppError> {
    rbac::require(&session_state, "bestellung.read")?;
    bestellung_repo::find_all(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_bestellung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateBestellung,
) -> Result<Bestellung, AppError> {
    let session = rbac::require(&session_state, "bestellung.write")?;
    let b = bestellung_repo::create(&pool, &data, &session.user_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Bestellung",
        Some(&b.id),
        Some(&format!(
            "lieferant={};artikel={};menge={}",
            b.lieferant, b.artikel, b.menge
        )),
    )
    .await
    .ok();
    Ok(b)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn update_bestellung_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    status: String,
) -> Result<Bestellung, AppError> {
    let session = rbac::require(&session_state, "bestellung.write")?;
    let b = bestellung_repo::update_status(&pool, &id, &status).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE_STATUS",
        "Bestellung",
        Some(&id),
        Some(&format!("status={status}")),
    )
    .await
    .ok();
    Ok(b)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_bestellung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdateBestellung,
) -> Result<Bestellung, AppError> {
    let session = rbac::require(&session_state, "bestellung.write")?;
    let b = bestellung_repo::update(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Bestellung",
        Some(&id),
        Some(&format!(
            "lieferant={};artikel={};menge={}",
            b.lieferant, b.artikel, b.menge
        )),
    )
    .await
    .ok();
    Ok(b)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_bestellung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "bestellung.write")?;
    bestellung_repo::delete(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Bestellung",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}
