//! Indexes for the lookups behind the main screens.
//!
//! Measured with `tests/perf_probe.rs` on the full demo year: opening a patient record scanned
//! every treatment, examination, finding, prescription, certificate, payment and appointment of
//! the practice, so each lookup grew with the practice's whole history. These indexes turn those
//! scans into index lookups. Chosen from the probe, not guessed:
//! - patient/chart foreign keys read on every patient record;
//! - date columns the calendar, payment list and audit log sort or filter by.
//! Not indexed: `physician_id` columns (one dentist per practice: no selectivity) and small tables.
//!
//! Runs at the end of every migration, because the schema upgrades rebuild some tables
//! (and a rebuilt table loses its indexes). `IF NOT EXISTS` makes it a no-op once created.

use sqlx::SqlitePool;

use crate::error::AppError;

/// (table, index name, columns)
const INDEXES: &[(&str, &str, &str)] = &[
    ("appointment", "idx_appointment_patient", "patient_id"),
    ("appointment", "idx_appointment_date", "date, time"),
    ("treatment", "idx_treatment_chart", "chart_id"),
    ("examination", "idx_examination_chart", "chart_id"),
    ("dental_finding", "idx_dental_finding_chart", "chart_id"),
    ("anamnesis_form", "idx_anamnesis_form_patient", "patient_id"),
    ("prescription", "idx_prescription_patient", "patient_id"),
    ("certificate", "idx_certificate_patient", "patient_id"),
    ("payment", "idx_payment_patient", "patient_id"),
    ("payment", "idx_payment_created", "created_at"),
    ("practice_task", "idx_practice_task_patient", "patient_id"),
    ("audit_log", "idx_audit_log_created", "created_at"),
    (
        "work_time_session",
        "idx_work_time_session_staff",
        "staff_id",
    ),
];

pub async fn ensure_lookup_indexes(pool: &SqlitePool) -> Result<(), AppError> {
    for (table, name, cols) in INDEXES {
        // Skip a table or column that an older or newer schema does not have.
        let present: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM pragma_table_info(?1) WHERE name = ?2")
                .bind(table)
                .bind(cols.split(',').next().unwrap_or("").trim())
                .fetch_one(pool)
                .await?;
        if present == 0 {
            continue;
        }
        sqlx::query(&format!(
            "CREATE INDEX IF NOT EXISTS {name} ON {table}({cols})"
        ))
        .execute(pool)
        .await?;
    }
    Ok(())
}
