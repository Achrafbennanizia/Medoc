//! Next-appointment planning hint (per patient, replaces browser `localStorage`).
//!
//! Invoke payload keys follow Tauri v2 defaults (**camelCase**, e.g. `patientId`, `hintJson`).
//! The frontend centralizes snake_case ↔ camelCase mirroring in `services/tauri.service.ts`.

use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::{chart_next_appointment_repo, audit_repo};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartNextAppointmentHintDto {
    pub patient_id: String,
    pub hint_json: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChartNextAppointmentPendingRow {
    pub patient_id: String,
    pub hint_json: String,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_chart_next_appointment_hints_pending(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<ChartNextAppointmentPendingRow>, AppError> {
    let _session = rbac::require(&session_state, "patient.read")?;
    let rows = chart_next_appointment_repo::list_all_ordered(&pool).await?;
    let mut out = Vec::new();
    for (patient_id, hint_json) in rows {
        let trimmed = hint_json.trim();
        if !chart_next_appointment_repo::hint_json_is_pending_non_empty(trimmed) {
            continue;
        }
        out.push(ChartNextAppointmentPendingRow {
            patient_id,
            hint_json: trimmed.to_string(),
        });
    }
    Ok(out)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_chart_next_appointment_hint(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Option<ChartNextAppointmentHintDto>, AppError> {
    let _session = rbac::require(&session_state, "patient.read")?;
    let hint = chart_next_appointment_repo::get_json(&pool, &patient_id).await?;
    Ok(hint.map(|hint_json| ChartNextAppointmentHintDto {
        patient_id,
        hint_json,
    }))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, hint_json))]
pub async fn set_chart_next_appointment_hint(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
    hint_json: String,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write")?;
    let trimmed = hint_json.trim();
    let is_empty = trimmed.is_empty()
        || trimmed == "{}"
        || trimmed == "null"
        || (trimmed.starts_with('{')
            && serde_json::from_str::<serde_json::Value>(trimmed)
                .ok()
                .and_then(|version| version.as_object().map(|o| o.is_empty()))
                .unwrap_or(false));

    if is_empty {
        chart_next_appointment_repo::delete_for_patient(&pool, &patient_id).await?;
    } else {
        chart_next_appointment_repo::set_json(&pool, &patient_id, trimmed).await?;
    }

    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "ChartNextAppointmentHint",
        Some(&patient_id),
        Some(if is_empty { "cleared" } else { "saved" }),
    )
    .await?;
    Ok(())
}

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_chart_next_appointment_commands {
    () => {
        $crate::commands::chart_next_appointment_commands::get_chart_next_appointment_hint,
        $crate::commands::chart_next_appointment_commands::list_chart_next_appointment_hints_pending,
        $crate::commands::chart_next_appointment_commands::set_chart_next_appointment_hint,
    };
}
