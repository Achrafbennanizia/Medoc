use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::attest::CreateAttest;
use crate::domain::entities::Attest;
use crate::error::AppError;
use crate::infrastructure::database::{attest_repo, audit_repo};

#[tauri::command]
pub async fn list_atteste(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Vec<Attest>, AppError> {
    let session = rbac::require(&session_state, "patient.read_medical")?;
    let a = attest_repo::find_for_patient(&pool, &patient_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Attest",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
pub async fn create_attest(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateAttest,
) -> Result<Attest, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    if data.gueltig_bis < data.gueltig_von {
        return Err(AppError::Validation(
            "Gültig-bis-Datum darf nicht vor Gültig-von-Datum liegen".into(),
        ));
    }
    let a = attest_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Attest",
        Some(&a.id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
pub async fn delete_attest(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    attest_repo::delete(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Attest", Some(&id), None)
        .await
        .ok();
    Ok(())
}
