//! Tauri commands for the Bilanz wizard snapshots (FA-FIN-09/10).
use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::bilanz_snapshot::{BilanzSnapshot, CreateBilanzSnapshot};
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, bilanz_snapshot_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_bilanz_snapshots(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<BilanzSnapshot>, AppError> {
    rbac::require(&session_state, "finanzen.read")?;
    bilanz_snapshot_repo::list(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_bilanz_snapshot(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<BilanzSnapshot, AppError> {
    rbac::require(&session_state, "finanzen.read")?;
    bilanz_snapshot_repo::get(&pool, &id).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_bilanz_snapshot(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateBilanzSnapshot,
) -> Result<BilanzSnapshot, AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    let snap = bilanz_snapshot_repo::create(&pool, &data, &session.user_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "BilanzSnapshot",
        Some(&snap.id),
        Some(&format!(
            "zeitraum={};einnahmen={};ausgaben={};saldo={}",
            snap.zeitraum, snap.einnahmen_cents, snap.ausgaben_cents, snap.saldo_cents
        )),
    )
    .await
    .ok();
    Ok(snap)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_bilanz_snapshot(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    bilanz_snapshot_repo::delete(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "BilanzSnapshot",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}
