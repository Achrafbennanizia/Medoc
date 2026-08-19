use crate::application::rbac;
use crate::application::appointment_hint_fulfillment;
use crate::commands::auth_commands::SessionState;
use crate::domain::entities::appointment::{CreateAppointment, UpdateAppointment};
use crate::domain::entities::Appointment;
use crate::domain::services::workflow_transitions;
use crate::error::AppError;
use crate::infrastructure::database::{audit_repo, patient_repo, appointment_repo};
use sqlx::SqlitePool;
use tauri::State;

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_appointments(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<Appointment>, AppError> {
    rbac::require(&session_state, "appointment.read")?;
    appointment_repo::find_all(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_appointment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<Appointment, AppError> {
    rbac::require(&session_state, "appointment.read")?;
    appointment_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("Appointment".into()))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn create_appointment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    data: CreateAppointment,
) -> Result<Appointment, AppError> {
    let session = rbac::require(&session_state, "appointment.write")?;
    let t = appointment_repo::create(&pool, &data).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "CREATE",
        "Appointment",
        Some(&t.id),
        None,
    )
    .await
    .ok();
    appointment_hint_fulfillment::after_appointment_created_best_effort(&pool, &session.user_id, &t).await;
    Ok(t)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, data))]
pub async fn update_appointment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
    data: UpdateAppointment,
) -> Result<Appointment, AppError> {
    let session = rbac::require(&session_state, "appointment.write")?;
    let current = appointment_repo::find_by_id(&pool, &id)
        .await?
        .ok_or(AppError::NotFound("Appointment".into()))?;
    if let Some(new_status) = &data.status {
        let new_str = serde_json::to_string(new_status)
            .map(|s| s.trim_matches('"').to_uppercase())
            .unwrap_or_default();
        workflow_transitions::appointment_status_transition(&current.status, &new_str)?;
    }
    let t = appointment_repo::update(&pool, &id, &data).await?;
    audit_repo::create(&pool, &session.user_id, "UPDATE", "Appointment", Some(&id), None)
        .await
        .ok();
    let became_completed = !current.status.eq_ignore_ascii_case("COMPLETED")
        && t.status.eq_ignore_ascii_case("COMPLETED");
    if became_completed {
        let _ = patient_repo::expire_new_status_after_completed_appointment(&pool, &t.patient_id).await;
    }
    Ok(t)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn delete_appointment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "appointment.write")?;
    appointment_repo::delete(&pool, &id).await?;
    audit_repo::create(&pool, &session.user_id, "DELETE", "Appointment", Some(&id), None)
        .await
        .ok();
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_appointments_by_date(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    date: String,
) -> Result<Vec<Appointment>, AppError> {
    rbac::require(&session_state, "appointment.read")?;
    appointment_repo::find_by_date(&pool, &date).await
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_appointment_commands {
    () => {
        $crate::commands::appointment_commands::list_appointments,
        $crate::commands::appointment_commands::get_appointment,
        $crate::commands::appointment_commands::create_appointment,
        $crate::commands::appointment_commands::update_appointment,
        $crate::commands::appointment_commands::delete_appointment,
        $crate::commands::appointment_commands::list_appointments_by_date,
    };
}
