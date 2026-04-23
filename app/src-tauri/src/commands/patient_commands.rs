use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::patient::{CreatePatient, UpdatePatient};
use crate::domain::entities::Patient;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, patient_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
pub async fn list_patienten(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Patient>, AppError> {
    rbac::require(&session_state, "patient.read")?;
    patient_repo::find_all(&pool).await
}

#[tauri::command]
pub async fn get_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<Patient, AppError> {
    let session = rbac::require(&session_state, "patient.read")?;
    let p = patient_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;
    audit_repo::create(&pool, &session.user_id, "READ", "Patient", Some(&id), None)
        .await
        .ok();
    Ok(p)
}

#[tauri::command]
pub async fn create_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreatePatient,
) -> Result<Patient, AppError> {
    let session = rbac::require(&session_state, "patient.write")?;
    let p = patient_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Patient",
        Some(&p.id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

#[tauri::command]
pub async fn update_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdatePatient,
) -> Result<Patient, AppError> {
    let session = rbac::require(&session_state, "patient.write")?;

    // FA-PAT-03: Status workflow NEU -> AKTIV -> VALIDIERT -> READONLY (forward only).
    if let Some(new_status) = &data.status {
        let current = patient_repo::find_by_id(&pool, &id)
            .await?
            .ok_or(AppError::NotFound("Patient".into()))?;
        let new_str = serde_json::to_string(new_status)
            .map(|s| s.trim_matches('"').to_string())
            .unwrap_or_default();
        let order = ["NEU", "AKTIV", "VALIDIERT", "READONLY"];
        let cur_idx = order.iter().position(|s| *s == current.status.as_str());
        let new_idx = order.iter().position(|s| *s == new_str.as_str());
        match (cur_idx, new_idx) {
            (Some(c), Some(n)) if n < c => {
                return Err(AppError::Validation(format!(
                    "Patient-Status-Übergang {}→{} ist nicht erlaubt",
                    current.status, new_str
                )));
            }
            _ => {}
        }
    }

    let p = patient_repo::update(&pool, &id, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Patient",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(p)
}

#[tauri::command]
pub async fn delete_patient(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    patient_repo::delete(&pool, &id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Patient",
        Some(&id),
        None,
    )
    .await
    .ok();
    Ok(())
}

#[tauri::command]
pub async fn search_patienten(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    query: String,
) -> Result<Vec<Patient>, AppError> {
    rbac::require(&session_state, "patient.read")?;
    patient_repo::search(&pool, &query).await
}
