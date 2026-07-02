use crate::application::rbac;
use crate::application::termin_hint_fulfillment;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::termin::{CreateTermin, UpdateTermin};
use crate::domain::entities::Termin;
use crate::domain::services::workflow_transitions;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, patient_repo, termin_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_termine(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Termin>, AppError> {
    rbac::require(&session_state, "termin.read")?;
    termin_repo::find_all(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<Termin, AppError> {
    rbac::require(&session_state, "termin.read")?;
    termin_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("Termin".into()))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateTermin,
) -> Result<Termin, AppError> {
    let session = rbac::require(&session_state, "termin.write")?;
    let t = termin_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Termin",
        Some(&t.id),
        None,
    )
    .await
    .ok();
    termin_hint_fulfillment::after_termin_created_best_effort(&pool, &session.user_id, &t).await;
    Ok(t)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdateTermin,
) -> Result<Termin, AppError> {
    let session = rbac::require(&session_state, "termin.write")?;
    let current = termin_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("Termin".into()))?;
    if let Some(new_status) = &data.status {
        let new_str = serde_json::to_string(new_status)
            .map(|s| s.trim_matches('"').to_uppercase())
            .unwrap_or_default();
        workflow_transitions::termin_status_transition(&current.status, &new_str)?;
    }
    let t = termin_repo::update(&pool, &id, &data).await?;
    audit_repo::create(&pool, &session.user_id, "UPDATE", "Termin", Some(&id), None)
        .await
        .ok();
    let became_completed = !current.status.eq_ignore_ascii_case("DURCHGEFUEHRT")
        && t.status.eq_ignore_ascii_case("DURCHGEFUEHRT");
    if became_completed {
        let _ = patient_repo::expire_neu_status_after_completed_termin(&pool, &t.patient_id).await;
    }
    Ok(t)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_termin(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "termin.write")?;
    termin_repo::delete(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Termin", Some(&id), None)
        .await
        .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_termine_by_date(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    datum: String,
) -> Result<Vec<Termin>, AppError> {
    rbac::require(&session_state, "termin.read")?;
    termin_repo::find_by_date(&pool, &datum).await
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_termin_commands {
    () => {
        $crate::commands::termin_commands::list_termine,
        $crate::commands::termin_commands::get_termin,
        $crate::commands::termin_commands::create_termin,
        $crate::commands::termin_commands::update_termin,
        $crate::commands::termin_commands::delete_termin,
        $crate::commands::termin_commands::list_termine_by_date,
    };
}
