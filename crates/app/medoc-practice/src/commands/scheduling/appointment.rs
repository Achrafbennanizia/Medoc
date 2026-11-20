use crate::application::appointment_hint_fulfillment;
use crate::application::rbac;
use crate::commands::admin::auth::SessionState;
use crate::domain::entities::appointment::{CreateAppointment, UpdateAppointment};
use crate::domain::entities::Appointment;
use crate::domain::services::workflow_transitions;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::clinical::patient as patient_repo;
use crate::infrastructure::database::repos::scheduling::appointment as appointment_repo;
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
#[tracing::instrument(level = "info", skip(pool, session_state, params))]
pub async fn list_appointments_paged(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    params: Option<crate::commands::list_params::ListParams>,
) -> Result<crate::commands::list_params::ListResponse<Appointment>, AppError> {
    rbac::require(&session_state, "appointment.read")?;
    let p = params.unwrap_or_default();
    let limit = p.limit();
    let offset = p.offset();
    let sort_dir = p
        .sort_dir_or(crate::commands::list_params::SortDir::Desc)
        .sql();
    let (items, total) = appointment_repo::find_paginated(
        &pool,
        limit,
        offset,
        sort_dir,
        p.filter_str("dateFrom"),
        p.filter_str("dateTo"),
    )
    .await?;
    Ok(crate::commands::list_params::ListResponse {
        items,
        total,
        page: p.page_one_based(),
        page_size: limit,
    })
}

/// F63: all appointments in the visible calendar range (local dates, inclusive).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_appointments_in_range(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    from_date: String,
    to_date: String,
) -> Result<Vec<Appointment>, AppError> {
    rbac::require(&session_state, "appointment.read")?;
    appointment_repo::find_in_range(&pool, &from_date, &to_date).await
}

/// F70: drag-move of one or more appointments, all or nothing.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, changes))]
pub async fn move_appointments(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    changes: Vec<crate::domain::entities::appointment::AppointmentMove>,
) -> Result<Vec<Appointment>, AppError> {
    let session = rbac::require(&session_state, "appointment.write")?;
    let moved = appointment_repo::move_many(&pool, &changes).await?;
    for a in &moved {
        if let Err(e) = audit_repo::create(
            &pool,
            &session.user_id,
            "UPDATE",
            "Appointment",
            Some(&a.id),
            None,
        )
        .await
        {
            tracing::warn!(target: "medoc::security", event = "AUDIT_WRITE_FAILED", error = %e);
        }
    }
    Ok(moved)
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
    appointment_hint_fulfillment::after_appointment_created_best_effort(
        &pool,
        &session.user_id,
        &t,
    )
    .await;
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
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "Appointment",
        Some(&id),
        None,
    )
    .await
    .ok();
    let became_completed = !current.status.eq_ignore_ascii_case("COMPLETED")
        && t.status.eq_ignore_ascii_case("COMPLETED");
    if became_completed {
        let _ =
            patient_repo::expire_new_status_after_completed_appointment(&pool, &t.patient_id).await;
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
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "Appointment",
        Some(&id),
        None,
    )
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
