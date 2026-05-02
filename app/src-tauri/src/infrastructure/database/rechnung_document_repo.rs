use crate::error::AppError;
use serde::Serialize;
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct RechnungDocumentRow {
    pub id: String,
    pub patient_id: String,
    pub document_number: String,
    pub payload_json: String,
    pub total_cents: i64,
    pub created_at: String,
    pub created_by: String,
}

const LIST_LIMIT_CAP: i64 = 500;

pub async fn list_recent(pool: &SqlitePool, limit: i64) -> Result<Vec<RechnungDocumentRow>, AppError> {
    let lim = limit.clamp(1, LIST_LIMIT_CAP);
    let rows = sqlx::query_as::<_, RechnungDocumentRow>(
        "SELECT id, patient_id, document_number, payload_json, total_cents, created_at, created_by
         FROM rechnung_document
         ORDER BY created_at DESC
         LIMIT ?1",
    )
    .bind(lim)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn insert_with_audit_trail(
    pool: &SqlitePool,
    row: &RechnungDocumentRow,
    audit_excerpt: &str,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await?;

    sqlx::query(
        "INSERT INTO rechnung_document (
            id, patient_id, document_number, payload_json, total_cents, created_at, created_by
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(&row.id)
    .bind(&row.patient_id)
    .bind(&row.document_number)
    .bind(&row.payload_json)
    .bind(row.total_cents)
    .bind(&row.created_at)
    .bind(&row.created_by)
    .execute(&mut *tx)
    .await?;

    let audit_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO rechnung_document_audit (id, document_id, event, user_id, payload_excerpt)
         VALUES (?1, ?2, 'ISSUED', ?3, ?4)",
    )
    .bind(&audit_id)
    .bind(&row.id)
    .bind(&row.created_by)
    .bind(audit_excerpt)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    Ok(())
}

pub async fn delete_for_patient(pool: &SqlitePool, patient_id: &str) -> Result<u64, AppError> {
    let n = sqlx::query("DELETE FROM rechnung_document WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(pool)
        .await?
        .rows_affected();
    Ok(n)
}
