use sqlx::SqlitePool;
use tauri::State;

use crate::application::prescription_allergy_check::{
    check_prescription_allergies, override_detail,
};
use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::domain::entities::prescription::{CreatePrescription, UpdatePrescription};
use crate::domain::entities::Prescription;
use crate::domain::services::allergy_conflict::AllergyConflict;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::clinical::prescription as prescription_repo;

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
    let mut r = prescription_repo::find_for_patient(&pool, &patient_id).await?;
    let role = rbac::Role::parse(&session.role).ok_or(AppError::Unauthorized)?;
    if !rbac::effective_allowed("patient.read_medical", role, &session.permission_overrides) {
        r.retain(|row| row.status == "ISSUED");
    }
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
    let confirmed = check_prescription_allergies(
        &pool,
        &data.patient_id,
        &data.medication,
        data.active_ingredient.as_deref(),
        data.allergy_override,
    )
    .await?;
    let r = prescription_repo::create(&pool, &data).await?;
    crate::commands::ownership::stamp_created(
        &pool,
        &session,
        "prescription",
        &r.id,
        Some(&data.physician_id),
    )
    .await?;
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
    audit_allergy_override(&pool, &session.user_id, &r.id, confirmed).await;
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
    let existing = prescription_repo::find_by_id(&pool, &data.id)
        .await?
        .ok_or(AppError::NotFound("Prescription".into()))?;
    let confirmed = check_prescription_allergies(
        &pool,
        &existing.patient_id,
        &data.medication,
        data.active_ingredient.as_deref(),
        data.allergy_override,
    )
    .await?;
    let r = prescription_repo::update(&pool, &data).await?;
    audit_allergy_override(&pool, &session.user_id, &r.id, confirmed).await;
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
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Prescription",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

/// The doctor issued a prescription despite the allergy warning: keep who, what and why.
async fn audit_allergy_override(
    pool: &SqlitePool,
    user_id: &str,
    prescription_id: &str,
    confirmed: Option<AllergyConflict>,
) {
    let Some(conflict) = confirmed else { return };
    tracing::warn!(
        target: "medoc::clinical",
        event = "PRESCRIPTION_ALLERGY_OVERRIDE",
        prescription_id,
        "prescription issued despite allergy warning"
    );
    audit_repo::create(
        pool,
        user_id,
        "ALLERGY_OVERRIDE",
        "Prescription",
        Some(prescription_id),
        Some(&override_detail(&conflict)),
    )
    .await
    .ok();
}
