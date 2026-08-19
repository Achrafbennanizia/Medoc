use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::prescription::{CreatePrescription, UpdatePrescription};
use crate::domain::entities::Prescription;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, prescription_repo};

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, patient_id))]
pub async fn list_prescriptions(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Vec<Prescription>, AppError> {
    let session = rbac::require_one_of(
        &session_state,
        &["patient.read_medical", "patient.read_documents"],
    )?;
    let r = prescription_repo::find_for_patient(&pool, &patient_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Prescription",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(r)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_prescription(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePrescription,
) -> Result<Prescription, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let r = prescription_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Prescription",
        Some(&r.id),
        None,
    )
    .await
    .ok();
    Ok(r)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_prescription(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: UpdatePrescription,
) -> Result<Prescription, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    let r = prescription_repo::update(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Prescription",
        Some(&r.id),
        None,
    )
    .await
    .ok();
    Ok(r)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_prescription(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    prescription_repo::delete(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Prescription", Some(&id), None)
        .await
        .ok();
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_prescription_commands {
    () => {
        $crate::commands::prescription_commands::list_prescriptions,
        $crate::commands::prescription_commands::create_prescription,
        $crate::commands::prescription_commands::update_prescription,
        $crate::commands::prescription_commands::delete_prescription,
    };
}
