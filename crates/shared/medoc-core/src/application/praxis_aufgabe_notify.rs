//! FA-AUFG-04/05 — In-App-Benachrichtigungen für Praxis-Aufgaben-Workflow.
use crate::domain::entities::praxis_aufgabe::PraxisAufgabe;
use crate::error::AppError;
use crate::infrastructure::database::{in_app_notification_repo, patient_repo, personal_repo};
use crate::infrastructure::logging::workflow;
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
    workflow::run_service_call_async(
        "application.praxis_aufgabe_notify",
        "notify_creator_if_aufgabe_erledigt_by_other",
        || async {
            if new_status != "ERLEDIGT_REZEPTION" || before.created_by == completing_user_id {
                return Ok(());
            }
            let pname = patient_name(pool, before.patient_id.as_deref()).await?;
            let title = if pname.is_empty() {
                format!("Aufgabe erledigt: {}", before.titel.trim())
            } else {
                format!("Aufgabe erledigt: {pname}")
            };
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
        },
    )
    .await
}

/// FA-AUFG-05 — Empfänger (Rezeption-Pool oder Ziel-Arzt) bei `ZURUECK` benachrichtigen.
pub async fn notify_assignees_if_aufgabe_zurueck(
    pool: &SqlitePool,
    before: &PraxisAufgabe,
    updated: &PraxisAufgabe,
    new_status: &str,
    returning_user_id: &str,
    zurueck_begruendung: Option<&str>,
) -> Result<(), AppError> {
    workflow::run_service_call_async(
        "application.praxis_aufgabe_notify",
        "notify_assignees_if_aufgabe_zurueck",
        || async {
            if new_status != "ZURUECK" {
                return Ok(());
            }

            let recipients = resolve_zurueck_recipients(pool, before).await?;
            if recipients.is_empty() {
                return Ok(());
            }

            let pname = patient_name(pool, before.patient_id.as_deref()).await?;
            let title = if pname.is_empty() {
                format!("Aufgabe zurück: {}", before.titel.trim())
            } else {
                format!("Aufgabe zurück: {pname}")
            };
            let body = zurueck_begruendung
                .filter(|s| !s.trim().is_empty())
                .unwrap_or("Bitte erneut bearbeiten.");
            let pay = json!({
                "aufgabeId": updated.id,
                "patientId": before.patient_id,
                "typ": before.typ,
                "status": "ZURUECK",
            })
            .to_string();

            for user_id in recipients {
                if user_id.trim() == returning_user_id.trim() {
                    continue;
                }
                in_app_notification_repo::insert(
                    pool,
                    &user_id,
                    "PRAXIS_AUFGABE_ZURUECK",
                    &title,
                    body,
                    Some(&pay),
                )
                .await?;
            }
            Ok(())
        },
    )
    .await
}

async fn patient_name(pool: &SqlitePool, patient_id: Option<&str>) -> Result<String, AppError> {
    match patient_id.filter(|s| !s.trim().is_empty()) {
        Some(pid) => Ok(patient_repo::find_by_id(pool, pid)
            .await?
            .map(|p| p.name)
            .unwrap_or_default()),
        None => Ok(String::new()),
    }
}

async fn resolve_zurueck_recipients(
    pool: &SqlitePool,
    aufgabe: &PraxisAufgabe,
) -> Result<Vec<String>, AppError> {
    if let Some(uid) = aufgabe
        .assignee_user_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        return Ok(vec![uid.to_string()]);
    }
    if aufgabe
        .assignee_role
        .as_deref()
        .map(str::trim)
        .is_some_and(|r| r.eq_ignore_ascii_case("REZEPTION"))
    {
        return personal_repo::find_user_ids_by_role(pool, "REZEPTION").await;
    }
    Ok(vec![])
}
