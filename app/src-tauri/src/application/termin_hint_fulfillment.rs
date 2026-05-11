//! When a new appointment is booked for a patient who still had a „nächster Termin“-Hinweis,
//! clear that hint (removes the row from „Ausstehende Freigaben“) and notify the appointment’s clinician.

use crate::domain::entities::Termin;
use crate::error::AppError;
use crate::infrastructure::database::{
    akte_next_termin_repo, audit_repo, in_app_notification_repo, patient_repo,
};
use sqlx::SqlitePool;

pub async fn after_termin_created_best_effort(pool: &SqlitePool, session_user_id: &str, termin: &Termin) {
    if let Err(e) = try_fulfill_plan_hint(pool, session_user_id, termin).await {
        tracing::warn!(
            target: "medoc::system",
            event = "TERMIN_HINT_FULFILL_SKIP",
            error = %e,
            termin_id = %termin.id,
            patient_id = %termin.patient_id,
        );
    }
}

async fn try_fulfill_plan_hint(
    pool: &SqlitePool,
    session_user_id: &str,
    termin: &Termin,
) -> Result<(), AppError> {
    let hint = match akte_next_termin_repo::get_json(pool, &termin.patient_id).await? {
        Some(h) => h,
        None => return Ok(()),
    };
    if !akte_next_termin_repo::hint_json_is_pending_non_empty(&hint) {
        return Ok(());
    }

    akte_next_termin_repo::delete_for_patient(pool, &termin.patient_id).await?;

    let _ = audit_repo::create(
        pool,
        session_user_id,
        "UPDATE",
        "AkteNextTerminHint",
        Some(&termin.patient_id),
        Some("cleared_after_termin"),
    )
    .await;

    let patient_name = patient_repo::find_by_id(pool, &termin.patient_id)
        .await?
        .map(|p| p.name)
        .unwrap_or_else(|| termin.patient_id.clone());

    let time_short = termin.uhrzeit.chars().take(5).collect::<String>();

    let title = "Termin-Hinweis erfüllt";
    let body = format!("{patient_name}: Termin am {} um {}", termin.datum, time_short);

    let payload = serde_json::json!({
        "termin_id": termin.id,
        "patient_id": termin.patient_id,
    })
    .to_string();

    in_app_notification_repo::insert(
        pool,
        &termin.arzt_id,
        "plan_hint_fulfilled",
        title,
        &body,
        Some(&payload),
    )
    .await?;
    Ok(())
}
