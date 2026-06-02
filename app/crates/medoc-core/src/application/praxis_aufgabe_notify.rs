//! FA-AUFG-04 — In-App-Benachrichtigung an erstellenden Arzt nach REZ-Erledigung.
use crate::domain::entities::praxis_aufgabe::PraxisAufgabe;
use crate::error::AppError;
use crate::infrastructure::database::{in_app_notification_repo, patient_repo};
use serde_json::json;
use sqlx::SqlitePool;

pub async fn notify_creator_if_aufgabe_erledigt_by_other(
    pool: &SqlitePool,
    before: &PraxisAufgabe,
    updated: &PraxisAufgabe,
    new_status: &str,
    completing_user_id: &str,
    erledigt_notiz: Option<&str>,
) -> Result<(), AppError> {
    if new_status != "ERLEDIGT_REZEPTION" || before.created_by == completing_user_id {
        return Ok(());
    }
    let pname = patient_repo::find_by_id(pool, &before.patient_id)
        .await?
        .map(|p| p.name)
        .unwrap_or_default();
    let title = format!("Aufgabe erledigt: {pname}");
    let body = erledigt_notiz
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("Rezeption hat die Aufgabe erledigt.");
    let pay = json!({
        "aufgabeId": updated.id,
        "patientId": before.patient_id,
        "typ": before.typ,
    })
    .to_string();
    in_app_notification_repo::insert(
        pool,
        &before.created_by,
        "PRAXIS_AUFGABE_ERLEDIGT",
        &title,
        body,
        Some(&pay),
    )
    .await
}
