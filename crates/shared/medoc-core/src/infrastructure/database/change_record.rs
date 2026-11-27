//! Change records (T5.8 phase 2): for every change to a patient or money record, who made it
//! (`syncActor`, T5.8 phase 1), on which device, and the row as it was after the change. History
//! compares consecutive records (`application::history`). Kept on each device (`DeviceLocal`):
//! every device applies every change, so each builds the same history without extra sync traffic.
//! A device that joins later starts its history at the join (plan D4).
//!
//! Duo and Group (`cap-multi-staff`); Solo writes nothing.

use sqlx::{Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::error::AppError;

/// Tables with a history (plan D2: patient record, calendar, money, tasks, orders).
pub const TRACKED: &[&str] = &[
    "patient",
    "patient_chart",
    "anamnesis_form",
    "dental_finding",
    "examination",
    "treatment",
    "chart_attachment",
    "chart_validation",
    "prescription",
    "certificate",
    "sick_leave_certificate",
    "issued_document",
    "appointment",
    "payment",
    "practice_task",
    "purchase_order",
];

pub fn is_tracked(table: &str) -> bool {
    cfg!(feature = "cap-multi-staff") && TRACKED.contains(&table)
}

pub async fn ensure_table(pool: &SqlitePool) -> Result<(), AppError> {
    for sql in [
        "CREATE TABLE IF NOT EXISTS change_record (
            id TEXT PRIMARY KEY,
            entity_table TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            patient_id TEXT,
            op TEXT NOT NULL,
            actor_staff_id TEXT,
            device_id TEXT NOT NULL,
            origin_seq INTEGER,
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        )",
        "CREATE INDEX IF NOT EXISTS idx_change_record_entity
            ON change_record (entity_table, entity_id, created_at)",
        "CREATE INDEX IF NOT EXISTS idx_change_record_patient
            ON change_record (patient_id, created_at)",
    ] {
        sqlx::query(sql)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

/// One change to record.
pub struct NewRecord<'a> {
    pub table: &'a str,
    pub entity_id: &'a str,
    pub op: &'a str,
    /// The row after the change (`None` for a delete).
    pub row_json: Option<&'a str>,
    pub actor_staff_id: Option<&'a str>,
    pub device_id: &'a str,
    pub origin_seq: Option<i64>,
    pub created_at: &'a str,
}

/// Erasure writes `insurance_number = ANON-<id>` (`gdpr::erase_patient_records`).
fn is_erased_patient(table: &str, id: &str, row: &serde_json::Value) -> bool {
    table == "patient"
        && row.get("insurance_number").and_then(|v| v.as_str()) == Some(&format!("ANON-{id}"))
}

/// Write one record inside the caller's transaction.
pub async fn write(tx: &mut Transaction<'_, Sqlite>, rec: NewRecord<'_>) -> Result<(), AppError> {
    if !is_tracked(rec.table) {
        return Ok(());
    }
    let row: serde_json::Value = rec
        .row_json
        .and_then(|j| serde_json::from_str(j).ok())
        .unwrap_or_else(|| serde_json::json!({ "id": rec.entity_id }));
    let patient_id = patient_of(tx, rec.table, rec.entity_id, &row).await?;
    if is_erased_patient(rec.table, rec.entity_id, &row) {
        // GDPR: old values of an erased patient leave history on every device.
        sqlx::query("DELETE FROM change_record WHERE patient_id = ?1")
            .bind(rec.entity_id)
            .execute(&mut **tx)
            .await
            .map_err(AppError::Database)?;
    }
    sqlx::query(
        "INSERT INTO change_record
            (id, entity_table, entity_id, patient_id, op, actor_staff_id, device_id, origin_seq, payload_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
    )
    .bind(Uuid::new_v4().to_string())
    .bind(rec.table)
    .bind(rec.entity_id)
    .bind(patient_id)
    .bind(rec.op)
    .bind(rec.actor_staff_id.filter(|a| !a.is_empty()))
    .bind(rec.device_id)
    .bind(rec.origin_seq)
    .bind(row.to_string())
    .bind(rec.created_at)
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// The patient a row belongs to: its own id, its `patient_id`, its chart's patient, else the
/// patient an earlier record of the same row named (deletes carry only the id).
async fn patient_of(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    id: &str,
    row: &serde_json::Value,
) -> Result<Option<String>, AppError> {
    let field = |k: &str| {
        row.get(k)
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(str::to_string)
    };
    if table == "patient" {
        return Ok(Some(id.to_string()));
    }
    if let Some(p) = field("patient_id") {
        return Ok(Some(p));
    }
    if let Some(chart) = field("chart_id") {
        let p: Option<String> =
            sqlx::query_scalar("SELECT patient_id FROM patient_chart WHERE id = ?1")
                .bind(chart)
                .fetch_optional(&mut **tx)
                .await
                .map_err(AppError::Database)?;
        if p.is_some() {
            return Ok(p);
        }
    }
    sqlx::query_scalar(
        "SELECT patient_id FROM change_record
          WHERE entity_table = ?1 AND entity_id = ?2 AND patient_id IS NOT NULL
          ORDER BY created_at DESC LIMIT 1",
    )
    .bind(table)
    .bind(id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(AppError::Database)
}

/// Record a change applied from another device: the row as it is here after the merge (a
/// field merge may keep some local fields), with the origin's author, device and sequence.
pub async fn write_applied(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
    op: &str,
    actor_staff_id: Option<&str>,
    device_id: &str,
    origin_seq: i64,
    created_at: &str,
) -> Result<(), AppError> {
    if !is_tracked(table) {
        return Ok(());
    }
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    let row = if op == "DELETE" {
        None
    } else {
        crate::infrastructure::database::recorded_write::row_json(&mut tx, table, entity_id).await?
    };
    write(
        &mut tx,
        NewRecord {
            table,
            entity_id,
            op,
            row_json: row.as_deref(),
            actor_staff_id,
            device_id,
            origin_seq: Some(origin_seq),
            created_at,
        },
    )
    .await?;
    tx.commit().await.map_err(AppError::Database)
}
