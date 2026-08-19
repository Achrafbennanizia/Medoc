use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::certificate::CreateCertificate;
use crate::domain::entities::Certificate;
use crate::error::AppError;
use crate::infrastructure::database::{certificate_repo, audit_repo};

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, patient_id))]
pub async fn list_certificates(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Vec<Certificate>, AppError> {
    let session = rbac::require_one_of(
        &session_state,
        &["patient.read_medical", "patient.read_documents"],
    )?;
    let a = certificate_repo::find_for_patient(&pool, &patient_id).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "READ",
        "Certificate",
        Some(&patient_id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_certificate(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateCertificate,
) -> Result<Certificate, AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    if data.valid_until < data.valid_from {
        return Err(AppError::Validation(
            "Valid-to date must not be before valid-from date".into(),
        ));
    }
    let a = certificate_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Certificate",
        Some(&a.id),
        None,
    )
    .await
    .ok();
    Ok(a)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, id))]
pub async fn delete_certificate(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write_medical")?;
    certificate_repo::delete(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Certificate", Some(&id), None)
        .await
        .ok();
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_certificate_commands {
    () => {
        $crate::commands::certificate_commands::list_certificates,
        $crate::commands::certificate_commands::create_certificate,
        $crate::commands::certificate_commands::delete_certificate,
    };
}
