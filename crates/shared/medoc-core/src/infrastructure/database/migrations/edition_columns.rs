//! Columns for who did what, where and for which doctor (docs/architecture/editions-plan.md §4.1).
//!
//! All editions get them (one schema everywhere); all are nullable so existing rows stay valid.
//! Group uses them for per-doctor views, signing doctors on documents, and change records.

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

async fn add_column_if_missing(
    pool: &SqlitePool,
    table: &str,
    column: &str,
    ddl: &str,
) -> Result<(), AppError> {
    let table_exists: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1")
            .bind(table)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;
    if table_exists == 0 {
        return Ok(());
    }
    let n: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2")
        .bind(table)
        .bind(column)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
    if n == 0 {
        sqlx::query(&format!("ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
    }
    Ok(())
}

/// (table, column) — every column is `TEXT` and nullable.
const COLUMNS: &[(&str, &str)] = &[
    // Treating doctor: default signing doctor of the patient's documents (Q3).
    ("patient", "treating_staff_id"),
    // Clinical acts: responsible doctor, author and device.
    ("patient_chart", "responsible_staff_id"),
    ("examination", "responsible_staff_id"),
    ("examination", "created_by"),
    ("examination", "device_id"),
    ("treatment", "responsible_staff_id"),
    ("treatment", "created_by"),
    ("treatment", "device_id"),
    // Money: who took it, for which doctor, on which device.
    ("payment", "created_by"),
    ("payment", "collected_by"),
    ("payment", "for_staff_id"),
    ("payment", "device_id"),
    ("cash_movement", "for_staff_id"),
    ("cash_movement", "device_id"),
    // Documents: the doctor named in the signature block, and who asked for the document.
    ("prescription", "signed_by_staff_id"),
    ("prescription", "requested_by_staff_id"),
    ("certificate", "signed_by_staff_id"),
    ("certificate", "requested_by_staff_id"),
    ("sick_leave_certificate", "signed_by_staff_id"),
    ("issued_document", "signed_by_staff_id"),
    ("issued_document", "requested_by_staff_id"),
    ("invoice_document", "signed_by_staff_id"),
    // Orders: for whom, paid by whom, approved by whom.
    ("purchase_order", "ordered_for_staff_id"),
    ("purchase_order", "paid_by_staff_id"),
    ("purchase_order", "paid_at"),
    ("purchase_order", "approved_by"),
    // Calendar chair, task doctor.
    ("appointment", "room_id"),
    ("practice_task", "doctor_id"),
    // Audit: the device that wrote the entry (the hash chain does not cover it).
    ("audit_log", "device_id"),
];

pub(super) async fn ensure_edition_columns(pool: &SqlitePool) -> Result<(), AppError> {
    for (table, column) in COLUMNS {
        add_column_if_missing(pool, table, column, "TEXT").await?;
    }
    // Who released a treatment / examination for billing is its responsible doctor until told otherwise.
    for table in ["treatment", "examination"] {
        let has = |c: &'static str| async move {
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2",
            )
            .bind(table)
            .bind(c)
            .fetch_one(pool)
            .await
            .map(|n| n > 0)
            .unwrap_or(false)
        };
        if has("released_by_physician_id").await && has("responsible_staff_id").await {
            sqlx::query(&format!(
                "UPDATE {table} SET responsible_staff_id = released_by_physician_id
                 WHERE responsible_staff_id IS NULL AND released_by_physician_id IS NOT NULL"
            ))
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        }
    }
    Ok(())
}
