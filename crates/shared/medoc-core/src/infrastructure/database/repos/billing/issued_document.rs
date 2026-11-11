//! Repository for `issued_document` / `issued_document_print` / `document_sequence`.

use serde::Serialize;
use sha2::{Digest, Sha256};
use sqlx::{SqliteConnection, SqlitePool};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct IssuedDocument {
    pub id: String,
    pub kind: String,
    pub document_number: String,
    pub source_table: Option<String>,
    pub source_id: Option<String>,
    pub copy_variant: String,
    pub patient_id: Option<String>,
    pub sha256: String,
    pub payload_json: String,
    pub status: String,
    pub cancels_id: Option<String>,
    pub issued_by: String,
    pub issued_at: String,
    pub updated_at: String,
}

/// Row without the (large) payload for list views.
#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct IssuedDocumentListRow {
    pub id: String,
    pub kind: String,
    pub document_number: String,
    pub source_id: Option<String>,
    pub copy_variant: String,
    pub patient_id: Option<String>,
    pub sha256: String,
    pub status: String,
    pub cancels_id: Option<String>,
    pub issued_by: String,
    pub issued_at: String,
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

/// Local device must be the numbering authority. Replicas sync issued
/// documents but must not allocate numbers (duplicate numbers break GoBD).
pub async fn ensure_numbering_authority(pool: &SqlitePool) -> Result<(), AppError> {
    let role: Option<String> =
        sqlx::query_scalar("SELECT role FROM sync_device WHERE is_local = 1 LIMIT 1")
            .fetch_optional(pool)
            .await
            .unwrap_or(None);
    if role.as_deref() == Some("REPLICA") {
        return Err(AppError::validation_code(
            "error.documents.issue_on_master_only",
        ));
    }
    Ok(())
}

/// Next gap-free number `PREFIX-YYYY-000001`. Call inside a transaction
/// opened with `BEGIN IMMEDIATE` on `conn` so two issues cannot race.
pub async fn next_number(
    tx: &mut SqliteConnection,
    prefix: &str,
    year: i32,
) -> Result<String, AppError> {
    let value: i64 = sqlx::query_scalar(
        "INSERT INTO document_sequence (prefix, year, last_value) VALUES (?1, ?2, 1)
         ON CONFLICT(prefix, year) DO UPDATE SET last_value = last_value + 1
         RETURNING last_value",
    )
    .bind(prefix)
    .bind(year)
    .fetch_one(&mut *tx)
    .await?;
    Ok(format!("{prefix}-{year}-{value:06}"))
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<IssuedDocument>, AppError> {
    Ok(
        sqlx::query_as::<_, IssuedDocument>("SELECT * FROM issued_document WHERE id = ?1")
            .bind(id)
            .fetch_optional(pool)
            .await?,
    )
}

pub async fn find_by_source(
    pool: &SqlitePool,
    kind: &str,
    source_id: &str,
    copy_variant: &str,
) -> Result<Option<IssuedDocument>, AppError> {
    Ok(sqlx::query_as::<_, IssuedDocument>(
        "SELECT * FROM issued_document WHERE kind = ?1 AND source_id = ?2 AND copy_variant = ?3",
    )
    .bind(kind)
    .bind(source_id)
    .bind(copy_variant)
    .fetch_optional(pool)
    .await?)
}

pub async fn list_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<IssuedDocumentListRow>, AppError> {
    Ok(sqlx::query_as::<_, IssuedDocumentListRow>(
        "SELECT id, kind, document_number, source_id, copy_variant, patient_id, sha256, status,
                cancels_id, issued_by, issued_at
           FROM issued_document WHERE patient_id = ?1 ORDER BY issued_at DESC",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?)
}

pub async fn list_recent(
    pool: &SqlitePool,
    kind: Option<&str>,
    limit: i64,
) -> Result<Vec<IssuedDocumentListRow>, AppError> {
    Ok(sqlx::query_as::<_, IssuedDocumentListRow>(
        "SELECT id, kind, document_number, source_id, copy_variant, patient_id, sha256, status,
                cancels_id, issued_by, issued_at
           FROM issued_document
          WHERE (?1 IS NULL OR kind = ?1)
          ORDER BY issued_at DESC LIMIT ?2",
    )
    .bind(kind)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

pub async fn insert(tx: &mut SqliteConnection, doc: &IssuedDocument) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO issued_document
            (id, kind, document_number, source_table, source_id, copy_variant, patient_id,
             sha256, payload_json, status, cancels_id, issued_by, issued_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)",
    )
    .bind(&doc.id)
    .bind(&doc.kind)
    .bind(&doc.document_number)
    .bind(&doc.source_table)
    .bind(&doc.source_id)
    .bind(&doc.copy_variant)
    .bind(&doc.patient_id)
    .bind(&doc.sha256)
    .bind(&doc.payload_json)
    .bind(&doc.status)
    .bind(&doc.cancels_id)
    .bind(&doc.issued_by)
    .bind(&doc.issued_at)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO issued_document_print (id, document_id, sha256, is_reprint, printed_by)
         VALUES (?1, ?2, ?3, 0, ?4)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(&doc.id)
    .bind(&doc.sha256)
    .bind(&doc.issued_by)
    .execute(&mut *tx)
    .await?;
    Ok(())
}

pub async fn mark_cancelled(tx: &mut SqliteConnection, id: &str) -> Result<(), AppError> {
    let n = sqlx::query(
        "UPDATE issued_document
            SET status = 'CANCELLED', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
          WHERE id = ?1 AND status = 'ISSUED'",
    )
    .bind(id)
    .execute(&mut *tx)
    .await?
    .rows_affected();
    if n == 0 {
        return Err(AppError::Conflict("document already cancelled".into()));
    }
    Ok(())
}

pub async fn record_reprint(
    pool: &SqlitePool,
    document_id: &str,
    sha256: &str,
    user_id: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO issued_document_print (id, document_id, sha256, is_reprint, printed_by)
         VALUES (?1, ?2, ?3, 1, ?4)",
    )
    .bind(uuid::Uuid::new_v4().to_string())
    .bind(document_id)
    .bind(sha256)
    .bind(user_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Verify a PDF someone presents: was it issued (or reprinted) by us?
pub async fn find_by_sha256(
    pool: &SqlitePool,
    sha256: &str,
) -> Result<Option<IssuedDocumentListRow>, AppError> {
    Ok(sqlx::query_as::<_, IssuedDocumentListRow>(
        "SELECT d.id, d.kind, d.document_number, d.source_id, d.copy_variant, d.patient_id,
                d.sha256, d.status, d.cancels_id, d.issued_by, d.issued_at
           FROM issued_document d
           JOIN issued_document_print p ON p.document_id = d.id
          WHERE p.sha256 = ?1
          LIMIT 1",
    )
    .bind(sha256)
    .fetch_optional(pool)
    .await?)
}
