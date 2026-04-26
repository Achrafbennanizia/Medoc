use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::zahlung::{Bilanz, CreateZahlung, UpdateZahlung};
use crate::domain::entities::Zahlung;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, zahlung_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_zahlungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Zahlung>, AppError> {
    rbac::require(&session_state, "finanzen.read")?;
    zahlung_repo::find_all(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
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
#[tracing::instrument(level = "info", skip(pool, session_state, id, status))]
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
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_zahlung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdateZahlung,
) -> Result<Zahlung, AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    let z = zahlung_repo::update_fields(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Zahlung",
        Some(&z.id),
        None,
    )
    .await
    .ok();
    Ok(z)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_zahlung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    zahlung_repo::delete_if_pending(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Zahlung", Some(&id), None)
        .await
        .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn get_bilanz(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Bilanz, AppError> {
    rbac::require(&session_state, "finanzen.read")?;
    zahlung_repo::get_bilanz(&pool).await
}

/// Tagesabschluss: alle ausgewählten Zahlungen als kassengeprüft markieren (oder zurücksetzen).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, ids))]
pub async fn set_zahlungen_kasse_geprueft(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    ids: Vec<String>,
    kasse_geprueft: bool,
) -> Result<u64, AppError> {
    let session = rbac::require(&session_state, "finanzen.write")?;
    let v = if kasse_geprueft { 1i64 } else { 0 };
    let n = zahlung_repo::set_kasse_geprueft_for_ids(&pool, &ids, v).await?;
    let detail = format!("kasse_geprueft={} zahlungen={}", v, ids.len());
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Zahlung",
        None,
        Some(&detail),
    )
    .await
    .ok();
    Ok(n)
}
