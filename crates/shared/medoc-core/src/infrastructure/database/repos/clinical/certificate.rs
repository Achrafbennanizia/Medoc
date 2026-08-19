use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::entities::certificate::{Certificate, CreateCertificate};
use crate::error::AppError;

pub async fn find_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<Certificate>, AppError> {
    let rows = sqlx::query_as::<_, Certificate>(
        "SELECT * FROM certificate WHERE patient_id = ?1 ORDER BY issued_at DESC",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Certificate>, AppError> {
    let row = sqlx::query_as::<_, Certificate>("SELECT * FROM certificate WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn create(pool: &SqlitePool, data: &CreateCertificate) -> Result<Certificate, AppError> {
    let id = Uuid::new_v4().to_string();
    let first_or_follow_up = data
        .first_or_follow_up
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("FIRST");
    sqlx::query(
        "INSERT INTO certificate (
            id, patient_id, physician_id, kind, body_text, valid_from, valid_until,
            icd10_code, first_or_follow_up, employer, issuing_physician_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(&data.physician_id)
    .bind(&data.kind)
    .bind(&data.body_text)
    .bind(data.valid_from)
    .bind(data.valid_until)
    .bind(&data.icd10_code)
    .bind(first_or_follow_up)
    .bind(&data.employer)
    .bind(&data.issuing_physician_id)
    .execute(pool)
    .await?;
    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Certificate create failed".into()))?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "certificate", &id, "INSERT", &body,
    )
    .await?;
    Ok(inserted)
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM certificate WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "certificate", id, "DELETE", "{}",
    )
    .await?;
    Ok(())
}
