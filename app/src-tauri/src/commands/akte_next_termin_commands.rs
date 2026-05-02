//! Next-termin planning hint (per patient, replaces browser `localStorage`).
//!
//! Invoke payload keys follow Tauri v2 defaults (**camelCase**, e.g. `patientId`, `hintJson`).
//! The frontend centralizes snake_case ↔ camelCase mirroring in `services/tauri.service.ts`.

use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::{akte_next_termin_repo, audit_repo};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AkteNextTerminHintDto {
    pub patient_id: String,
    pub hint_json: String,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn get_akte_next_termin_hint(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Option<AkteNextTerminHintDto>, AppError> {
    let _session = rbac::require(&session_state, "patient.read")?;
    let hint = akte_next_termin_repo::get_json(&pool, &patient_id).await?;
    Ok(hint.map(|hint_json| AkteNextTerminHintDto {
        patient_id,
        hint_json,
    }))
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, hint_json))]
pub async fn set_akte_next_termin_hint(
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
                .and_then(|v| v.as_object().map(|o| o.is_empty()))
                .unwrap_or(false));

    if is_empty {
        akte_next_termin_repo::delete_for_patient(&pool, &patient_id).await?;
    } else {
        akte_next_termin_repo::set_json(&pool, &patient_id, trimmed).await?;
    }

    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "AkteNextTerminHint",
        Some(&patient_id),
        Some(if is_empty { "cleared" } else { "saved" }),
    )
    .await?;
    Ok(())
}
