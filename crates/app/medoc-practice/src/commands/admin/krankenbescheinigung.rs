//! Krankenbescheinigung — sick leave with document + Arbeitsplan cut_range sync.

use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::application::rbac;
use crate::commands::admin::arbeitsplan_adjustment::deactivate_adjustments_for_source;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use tauri::State;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct KrankenbescheinigungRecord {
    pub id: String,
    pub personal_id: String,
    pub note: Option<String>,
    pub document_ref: String,
    pub date_from: String,
    pub date_to: Option<String>,
    pub start_min: Option<i64>,
    pub end_min: Option<i64>,
    pub status: String,
    pub created_by: String,
    pub created_at: String,
    pub ended_at: Option<String>,
    pub ended_by: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KrankenbescheinigungSaveRequest {
    pub personal_id: Option<String>,
    pub note: Option<String>,
    pub document_ref: String,
    pub date_from: String,
    pub date_to: Option<String>,
    pub start_min: Option<i64>,
    pub end_min: Option<i64>,
}

fn cut_range_payload(
    personal_id: &str,
    date_from: &str,
    date_to: Option<&str>,
    label: &str,
) -> String {
    json!({
        "id": format!("kb-cut-{}", Uuid::new_v4()),
        "kind": "cut_range",
        "personalId": personal_id,
        "dateFrom": date_from,
        "dateTo": date_to.unwrap_or(date_from),
        "label": label,
    })
    .to_string()
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn krankenbescheinigung_save(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    request: KrankenbescheinigungSaveRequest,
) -> Result<KrankenbescheinigungRecord, AppError> {
    let session = rbac::require(&session_state, "verwaltung.team.read")?;
    let doc = request.document_ref.trim();
    if doc.is_empty() {
        return Err(AppError::Validation("Dokument ist Pflicht.".into()));
    }
    NaiveDate::parse_from_str(&request.date_from, "%Y-%m-%d")
        .map_err(|_| AppError::Validation("date_from: YYYY-MM-DD".into()))?;
    if let Some(ref to) = request.date_to {
        NaiveDate::parse_from_str(to, "%Y-%m-%d")
            .map_err(|_| AppError::Validation("date_to: YYYY-MM-DD".into()))?;
    }

    let target_personal = request
        .personal_id
        .as_deref()
        .unwrap_or(&session.user_id)
        .to_string();

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let payload = cut_range_payload(
        &target_personal,
        &request.date_from,
        request.date_to.as_deref(),
        "Krankenbescheinigung",
    );

    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    sqlx::query(
        "INSERT INTO krankenbescheinigung
         (id, personal_id, note, document_ref, date_from, date_to, start_min, end_min, status, created_by, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'ACTIVE', ?9, ?10)",
    )
    .bind(&id)
    .bind(&target_personal)
    .bind(request.note.as_deref())
    .bind(doc)
    .bind(&request.date_from)
    .bind(request.date_to.as_deref())
    .bind(request.start_min)
    .bind(request.end_min)
    .bind(&session.user_id)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    let adj_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO arbeitsplan_adjustment (id, source, source_id, personal_id, payload_json, active, created_at)
         VALUES (?1, 'krankenbescheinigung', ?2, ?3, ?4, 1, ?5)",
    )
    .bind(&adj_id)
    .bind(&id)
    .bind(&target_personal)
    .bind(&payload)
    .bind(&now)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    tx.commit().await.map_err(AppError::Database)?;

    fetch_krank(&pool, &id).await
}

async fn fetch_krank(pool: &SqlitePool, id: &str) -> Result<KrankenbescheinigungRecord, AppError> {
    sqlx::query_as::<_, KrankenbescheinigungRecord>(
        "SELECT id, personal_id, note, document_ref, date_from, date_to, start_min, end_min,
                status, created_by, created_at, ended_at, ended_by
         FROM krankenbescheinigung WHERE id = ?1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn list_krankenbescheinigungen(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<KrankenbescheinigungRecord>, AppError> {
    rbac::require(&session_state, "verwaltung.team.read")?;
    let rows = sqlx::query_as::<_, KrankenbescheinigungRecord>(
        "SELECT id, personal_id, note, document_ref, date_from, date_to, start_min, end_min,
                status, created_by, created_at, ended_at, ended_by
         FROM krankenbescheinigung
         ORDER BY created_at DESC",
    )
    .fetch_all(pool.inner())
    .await
    .map_err(AppError::Database)?;
    Ok(rows)
}

#[tauri::command]
#[tracing::instrument(level = "debug", skip_all)]
pub async fn end_krankenbescheinigung(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<KrankenbescheinigungRecord, AppError> {
    let session = rbac::require(&session_state, "verwaltung.team.read")?;
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE krankenbescheinigung
         SET status = 'ENDED', ended_at = ?1, ended_by = ?2
         WHERE id = ?3 AND status = 'ACTIVE'",
    )
    .bind(&now)
    .bind(&session.user_id)
    .bind(&id)
    .execute(pool.inner())
    .await
    .map_err(AppError::Database)?;
    deactivate_adjustments_for_source(&pool, "krankenbescheinigung", &id).await?;
    fetch_krank(&pool, &id).await
}

#[macro_export]
macro_rules! register_krankenbescheinigung_commands {
    () => {
        $crate::commands::krankenbescheinigung_commands::krankenbescheinigung_save,
        $crate::commands::krankenbescheinigung_commands::list_krankenbescheinigungen,
        $crate::commands::krankenbescheinigung_commands::end_krankenbescheinigung,
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn save_request_requires_document() {
        let req = KrankenbescheinigungSaveRequest {
            personal_id: None,
            note: None,
            document_ref: "   ".into(),
            date_from: "2026-06-01".into(),
            date_to: None,
            start_min: None,
            end_min: None,
        };
        assert!(req.document_ref.trim().is_empty());
    }
}
