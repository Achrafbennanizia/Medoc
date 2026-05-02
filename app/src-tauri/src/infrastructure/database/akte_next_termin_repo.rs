use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn get_json(pool: &SqlitePool, patient_id: &str) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> =
        sqlx::query_as("SELECT hint_json FROM akte_next_termin_hint WHERE patient_id = ?1")
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
    sqlx::query(
        "INSERT INTO akte_next_termin_hint (patient_id, hint_json, updated_at)
         VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(patient_id) DO UPDATE SET
            hint_json = excluded.hint_json,
            updated_at = CURRENT_TIMESTAMP",
    )
    .bind(patient_id)
    .bind(hint_json)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete_for_patient(pool: &SqlitePool, patient_id: &str) -> Result<u64, AppError> {
    let n = sqlx::query("DELETE FROM akte_next_termin_hint WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(n)
}
