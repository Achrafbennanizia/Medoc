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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AkteNextTerminPendingRow {
    pub patient_id: String,
    pub hint_json: String,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_akte_next_termin_hints_pending(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<AkteNextTerminPendingRow>, AppError> {
    let _session = rbac::require(&session_state, "patient.read")?;
    let rows = akte_next_termin_repo::list_all_ordered(&pool).await?;
    let mut out = Vec::new();
    for (patient_id, hint_json) in rows {
        let trimmed = hint_json.trim();
        if !akte_next_termin_repo::hint_json_is_pending_non_empty(trimmed) {
            continue;
        }
        out.push(AkteNextTerminPendingRow {
            patient_id,
            hint_json: trimmed.to_string(),
        });
    }
    Ok(out)
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

/// IPC commands for [`crate::commands::register`].
#[macro_export]
macro_rules! register_akte_next_termin_commands {
    () => {
        $crate::commands::akte_next_termin_commands::get_akte_next_termin_hint,
        $crate::commands::akte_next_termin_commands::list_akte_next_termin_hints_pending,
        $crate::commands::akte_next_termin_commands::set_akte_next_termin_hint,
    };
}
