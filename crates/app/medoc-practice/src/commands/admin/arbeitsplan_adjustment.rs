//! Server-synced Arbeitsplan compose adjustments (cut_range from Krankenbescheinigung).

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::application::rbac;
use crate::commands::auth_commands::SessionState;
use crate::error::AppError;
use tauri::State;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ArbeitsplanAdjustmentRecord {
    pub id: String,
    pub source: String,
    pub source_id: Option<String>,
    pub personal_id: String,
    pub payload_json: String,
    pub active: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArbeitsplanAdjustmentListQuery {
    pub personal_id: Option<String>,
    pub active_only: Option<bool>,
}

pub async fn insert_cut_range_adjustment(
    pool: &SqlitePool,
    source: &str,
    source_id: Option<&str>,
    personal_id: &str,
    payload_json: &str,
) -> Result<String, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO arbeitsplan_adjustment (id, source, source_id, personal_id, payload_json, active, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6)",
    )
    .bind(&id)
    .bind(source)
    .bind(source_id)
    .bind(personal_id)
    .bind(payload_json)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(id)
}

pub async fn deactivate_adjustments_for_source(
    pool: &SqlitePool,
    source: &str,
    source_id: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "UPDATE arbeitsplan_adjustment SET active = 0 WHERE source = ?1 AND source_id = ?2",
    )
    .bind(source)
    .bind(source_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

#[tauri::command]
pub async fn list_arbeitsplan_adjustments(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    query: ArbeitsplanAdjustmentListQuery,
) -> Result<Vec<ArbeitsplanAdjustmentRecord>, AppError> {
    let session = rbac::require_authenticated(&session_state)?;
    let personal_id = if let Some(pid) = query.personal_id {
        rbac::require(&session_state, "work_time.admin")?;
        pid
    } else {
        session.user_id.clone()
    };
    let active_only = query.active_only.unwrap_or(true);
    let rows = if active_only {
        sqlx::query_as::<_, ArbeitsplanAdjustmentRecord>(
            "SELECT id, source, source_id, personal_id, payload_json, active, created_at
             FROM arbeitsplan_adjustment
             WHERE personal_id = ?1 AND active = 1
             ORDER BY created_at DESC",
        )
        .bind(&personal_id)
        .fetch_all(pool.inner())
        .await
    } else {
        sqlx::query_as::<_, ArbeitsplanAdjustmentRecord>(
            "SELECT id, source, source_id, personal_id, payload_json, active, created_at
             FROM arbeitsplan_adjustment
             WHERE personal_id = ?1
             ORDER BY created_at DESC",
        )
        .bind(&personal_id)
        .fetch_all(pool.inner())
        .await
    }
    .map_err(AppError::Database)?;
    Ok(rows)
}

#[macro_export]
macro_rules! register_arbeitsplan_adjustment_commands {
    () => {
        $crate::commands::arbeitsplan_adjustment_commands::list_arbeitsplan_adjustments,
    };
}
