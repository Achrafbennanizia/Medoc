//! Akte validation state (per patient, replaces browser `localStorage`).

use serde::Serialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use crate::infrastructure::database::{akte_validation_repo, audit_repo};

#[derive(Debug, Serialize)]
pub struct AkteValidationRowDto {
    pub patient_id: String,
    pub section_or_item: String,
    pub validated_at: String,
    pub validated_by: Option<String>,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn list_akte_validation(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
) -> Result<Vec<AkteValidationRowDto>, AppError> {
    let _session = rbac::require(&session_state, "patient.read")?;
    let rows = akte_validation_repo::list_for_patient(&pool, &patient_id).await?;
    Ok(rows
        .into_iter()
        .map(|r| AkteValidationRowDto {
            patient_id: r.patient_id,
            section_or_item: r.section_or_item,
            validated_at: r.validated_at,
            validated_by: r.validated_by,
        })
        .collect())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn set_akte_section_validated(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
    section: String,
    validated_by: Option<String>,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write")?;
    let at = chrono::Utc::now().to_rfc3339();
    let by = validated_by.as_deref().unwrap_or(&session.user_id);

    akte_validation_repo::upsert_row(&pool, &patient_id, &section, &at, Some(by)).await?;

    // Stammdaten-Validierung gilt UI-seitig auch für Anamnese.
    if section == "stamm" {
        akte_validation_repo::upsert_row(&pool, &patient_id, "anam", &at, Some(by)).await?;
    }

    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "AkteValidation",
        Some(&patient_id),
        Some(&format!("section={section}")),
    )
    .await?;
    Ok(())
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn set_akte_item_validated(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
    item_key: String,
    validated_by: Option<String>,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write")?;
    let at = chrono::Utc::now().to_rfc3339();
    let by = validated_by.as_deref().unwrap_or(&session.user_id);
    akte_validation_repo::upsert_row(&pool, &patient_id, &item_key, &at, Some(by)).await?;
    audit_repo::create(
        &pool,
        &session.user_id,
        "UPDATE",
        "AkteValidationItem",
        Some(&patient_id),
        Some(&format!("key={item_key}")),
    )
    .await?;
    Ok(())
}

/// Deletes all validation rows for the patient, or a single `section_or_item` when set.
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn clear_akte_validation(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    patient_id: String,
    section_or_item: Option<String>,
) -> Result<(), AppError> {
    let session = rbac::require(&session_state, "patient.write")?;
    let mut n: u64 = 0;
    if let Some(ref s) = section_or_item {
        if s == "stamm" {
            n += akte_validation_repo::clear_for_patient(&pool, &patient_id, Some("stamm")).await?;
            n += akte_validation_repo::clear_for_patient(&pool, &patient_id, Some("anam")).await?;
        } else {
            n += akte_validation_repo::clear_for_patient(&pool, &patient_id, Some(s)).await?;
        }
    } else {
        n += akte_validation_repo::clear_for_patient(&pool, &patient_id, None).await?;
    }
    audit_repo::create(
        &pool,
        &session.user_id,
        "DELETE",
        "AkteValidation",
        Some(&patient_id),
        Some(&format!(
            "cleared_rows={n} filter={}",
            section_or_item.as_deref().unwrap_or("*")
        )),
    )
    .await?;
    Ok(())
}
