use crate::application::rbac::{self, FINANZEN_READ_OR_RECEPTION};
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
    rbac::require_one_of(&session_state, FINANZEN_READ_OR_RECEPTION)?;
    zahlung_repo::find_all(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, patient_id))]
pub async fn list_zahlungen_for_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Vec<Zahlung>, AppError> {
    rbac::require_one_of(&session_state, FINANZEN_READ_OR_RECEPTION)?;
    zahlung_repo::find_by_patient_id(&pool, &patient_id).await
}

/// For patient list: `patient_id` values with at least one open/partially paid booking.
#[tauri::command]
#[tracing::instrument(level = "debug", skip(pool, session_state))]
pub async fn list_patient_ids_open_invoice(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<String>, AppError> {
    rbac::require_one_of(&session_state, FINANZEN_READ_OR_RECEPTION)?;
    zahlung_repo::patient_ids_open_invoice(&pool).await
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
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Zahlung",
        Some(&id),
        None,
    )
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
    rbac::require_one_of(&session_state, FINANZEN_READ_OR_RECEPTION)?;
    zahlung_repo::get_bilanz(&pool).await
}

/// Day-end closing: mark selected payments as cash-checked (or clear the flag).
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

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_zahlung_commands {
    () => {
        $crate::commands::zahlung_commands::list_zahlungen,
        $crate::commands::zahlung_commands::list_zahlungen_for_patient,
        $crate::commands::zahlung_commands::list_patient_ids_open_invoice,
        $crate::commands::zahlung_commands::create_zahlung,
        $crate::commands::zahlung_commands::update_zahlung,
        $crate::commands::zahlung_commands::delete_zahlung,
        $crate::commands::zahlung_commands::update_zahlung_status,
        $crate::commands::zahlung_commands::get_bilanz,
        $crate::commands::zahlung_commands::set_zahlungen_kasse_geprueft,
    };
}
