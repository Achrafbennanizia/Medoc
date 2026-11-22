use crate::error::AppError;
use crate::infrastructure::database::sqlite_error::is_sqlite_busy;
use sqlx::SqlitePool;

/// Same non-empty semantics as `medoc_practice::commands::clinical::chart_next_appointment::list_chart_next_appointment_hints_pending`.
pub fn hint_json_is_pending_non_empty(hint_json: &str) -> bool {
    let trimmed = hint_json.trim();
    if trimmed.is_empty() || trimmed == "{}" || trimmed == "null" {
        return false;
    }
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if val.as_object().map(|o| o.is_empty()).unwrap_or(false) {
            return false;
        }
    }
    true
}

pub async fn get_json(pool: &SqlitePool, patient_id: &str) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT hint_json FROM chart_next_appointment_hint WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_optional(pool)
            .await?;
    Ok(row.map(|(j,)| j))
}

pub async fn set_json(
    pool: &SqlitePool,
    patient_id: &str,
    hint_json: &str,
) -> Result<(), AppError> {
    // IMMEDIATE + busy_timeout: avoid SQLITE_BUSY (code 5) when the UI saves
    // rapidly while sync or another command holds a read/write lock.
    let mut last_err = None;
    for attempt in 0..4u32 {
        match set_json_once(pool, patient_id, hint_json).await {
            Ok(()) => return Ok(()),
            Err(e) if is_sqlite_busy(&e) && attempt < 3 => {
                last_err = Some(e);
                tokio::time::sleep(std::time::Duration::from_millis(40 * (1 << attempt))).await;
            }
            Err(e) => return Err(e),
        }
    }
    Err(last_err.unwrap_or_else(|| AppError::Internal("chart_next_appointment set_json".into())))
}

async fn set_json_once(
    pool: &SqlitePool,
    patient_id: &str,
    hint_json: &str,
) -> Result<(), AppError> {
    let mut tx = pool.begin_with("BEGIN IMMEDIATE").await?;
    sqlx::query(
        "INSERT INTO chart_next_appointment_hint (patient_id, hint_json, updated_at)
         VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(patient_id) DO UPDATE SET
            hint_json = excluded.hint_json,
            updated_at = CURRENT_TIMESTAMP",
    )
    .bind(patient_id)
    .bind(hint_json)
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx,
        "chart_next_appointment_hint",
        patient_id,
        "UPDATE",
    )
    .await?;
    tx.commit().await?;
    Ok(())
}

pub async fn delete_for_patient(pool: &SqlitePool, patient_id: &str) -> Result<u64, AppError> {
    let mut tx = pool.begin().await?;
    let ids: Vec<String> = sqlx::query_scalar(
        "SELECT patient_id FROM chart_next_appointment_hint WHERE patient_id = ?1",
    )
    .bind(patient_id)
    .fetch_all(&mut *tx)
    .await?;
    let n = sqlx::query("DELETE FROM chart_next_appointment_hint WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
    for id in &ids {
        crate::infrastructure::database::recorded_write::record_in_tx(
            &mut tx,
            "chart_next_appointment_hint",
            id,
            "DELETE",
        )
        .await?;
    }
    tx.commit().await?;
    Ok(n)
}

/// All stored hints (newest first). Caller filters empty JSON.
pub async fn list_all_ordered(pool: &SqlitePool) -> Result<Vec<(String, String)>, AppError> {
    let rows: Vec<(String, String)> = sqlx::query_as(
        "SELECT patient_id, hint_json FROM chart_next_appointment_hint ORDER BY updated_at DESC",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}
