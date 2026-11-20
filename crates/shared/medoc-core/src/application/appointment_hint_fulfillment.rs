//! When a new appointment is booked for a patient who still had a “next appointment” hint,
//! clear that hint (removes the row from pending releases) and notify the appointment’s clinician.

use crate::domain::entities::Appointment;
use crate::error::AppError;
use crate::infrastructure::database::repos::admin::audit as audit_repo;
use crate::infrastructure::database::repos::clinical::chart_next_appointment as chart_next_appointment_repo;
use crate::infrastructure::database::repos::clinical::patient as patient_repo;
use crate::infrastructure::database::repos::practice::in_app_notification as in_app_notification_repo;
use sqlx::SqlitePool;

pub async fn after_appointment_created_best_effort(
    pool: &SqlitePool,
    session_user_id: &str,
    appointment: &Appointment,
) {
    if let Err(e) = try_fulfill_plan_hint(pool, session_user_id, appointment).await {
        tracing::warn!(
            target: "medoc::system",
            event = "APPOINTMENT_HINT_FULFILL_SKIP",
            error = %e,
            appointment_id = %appointment.id,
            patient_id = %appointment.patient_id,
        );
    }
}

async fn try_fulfill_plan_hint(
    pool: &SqlitePool,
    session_user_id: &str,
    appointment: &Appointment,
) -> Result<(), AppError> {
    let hint = match chart_next_appointment_repo::get_json(pool, &appointment.patient_id).await? {
        Some(h) => h,
        None => return Ok(()),
    };
    if !chart_next_appointment_repo::hint_json_is_pending_non_empty(&hint) {
        return Ok(());
    }

    chart_next_appointment_repo::delete_for_patient(pool, &appointment.patient_id).await?;

    let _ = audit_repo::create(
        pool,
        session_user_id,
        "UPDATE",
        "ChartNextAppointmentHint",
        Some(&appointment.patient_id),
        Some("cleared_after_appointment"),
    )
    .await;

    let patient_name = patient_repo::find_by_id(pool, &appointment.patient_id)
        .await?
        .map(|p| p.name)
        .unwrap_or_else(|| appointment.patient_id.clone());

    let time_short = appointment.time.chars().take(5).collect::<String>();

    let title = patient_name.clone();
    let body = "";

    let payload = serde_json::json!({
        "appointment_id": appointment.id,
        "patient_id": appointment.patient_id,
        "patient_name": patient_name,
        "date": appointment.date,
        "time": time_short,
    })
    .to_string();

    in_app_notification_repo::insert(
        pool,
        &appointment.physician_id,
        "plan_hint_fulfilled",
        &title,
        body,
        Some(&payload),
    )
    .await?;
    Ok(())
}
