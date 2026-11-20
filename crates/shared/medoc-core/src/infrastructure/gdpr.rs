// GDPR (DSGVO) compliance helpers (NFA-EU-01).
//
// - export_patient: collects **all data** linked to a patient (full rows, not
//   ids), the access log and issued documents, as one JSON document
//   (Art. 15 — right of access, Art. 20 — data portability).
// - erase_patient: refuses while statutory retention applies (§ 630f BGB:
//   10 years after treatment; § 147 AO: 10 years for invoices/payments —
//   Art. 17 Abs. 3 lit. b DSGVO). After that it pseudonymises the patient
//   and deletes related medical records, backups and log references.

use serde::Serialize;
use serde_json::{json, Map, Value};
use sqlx::sqlite::SqliteRow;
use sqlx::{Column, Row, SqlitePool, TypeInfo, ValueRef};
use std::path::Path;

use crate::error::AppError;
use crate::infrastructure::database::repos::clinical::patient as patient_repo;
use crate::infrastructure::database::{db_key, sqlcipher};
use crate::infrastructure::{backup, logging::sanitizer};
use crate::log_system;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErasureReport {
    pub patient_id: String,
    pub anonymised_at: String,
    pub deleted_records: u64,
    pub backups_redacted: u32,
    pub log_files_redacted: u32,
}

/// Tuple representing the patient row queried for the DSGVO export.
type PatientRow = (
    String,
    String,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    Option<String>,
    String,
);

/// Collect every row that references the patient and return a single JSON
/// document. Returns an `Err` with `NotFound` if the patient does not exist.
pub async fn export_patient(pool: &SqlitePool, patient_id: &str) -> Result<Value, AppError> {
    let patient: Option<PatientRow> = sqlx::query_as(
        "SELECT id, name, date_of_birth, sex, insurance_number,
                    phone, email, address, status
             FROM patient WHERE id = ?1",
    )
    .bind(patient_id)
    .fetch_optional(pool)
    .await?;
    let p = patient.ok_or(AppError::NotFound("Patient".into()))?;

    let related = collect_related(pool, patient_id).await?;
    let access_log = crate::infrastructure::database::repos::admin::audit::find_for_patient_entity(
        pool, patient_id, 100_000,
    )
    .await?;
    let issued_documents =
        crate::infrastructure::database::repos::billing::issued_document::list_for_patient(
            pool, patient_id,
        )
        .await
        .unwrap_or_default();

    log_system!(info, event = "DSGVO_EXPORT", patient_id = %patient_id);

    Ok(json!({
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "schema_version": 3,
        "legal_basis": "Art. 15 und Art. 20 DSGVO",
        "access_log": access_log,
        "issued_documents": issued_documents,
        "patient": {
            "id": p.0, "name": p.1, "date_of_birth": p.2, "sex": p.3,
            "insurance_number": p.4, "phone": p.5, "email": p.6,
            "address": p.7, "status": p.8,
        },
        "related": related,
    }))
}

/// Pseudonymise + erase a patient's medical data while keeping an anonymised
/// stub row so foreign-key audit trails remain valid.
pub async fn erase_patient(
    pool: &SqlitePool,
    patient_id: &str,
    app_data_dir: &Path,
) -> Result<ErasureReport, AppError> {
    if let Some(until) = retention_until(pool, patient_id).await? {
        return Err(AppError::validation_code_params(
            "error.gdpr.retention_active",
            &[("until", until)],
        ));
    }
    let (deleted, chart_ids) = erase_patient_records(pool, patient_id).await?;

    for (aid,) in chart_ids {
        crate::infrastructure::database::repos::clinical::chart_attachment::remove_storage_dir_best_effort(
            app_data_dir,
            &aid,
        );
    }

    let backups_redacted = redact_patient_from_all_backups(app_data_dir, patient_id).await?;
    let log_files_redacted = sanitizer::redact_patient_id_in_logs(patient_id)?
        .redacted_files
        .len() as u32;

    log_system!(warn,
        event = "DSGVO_ERASURE",
        patient_id = %patient_id,
        deleted_records = deleted,
        backups_redacted = backups_redacted,
        log_files_redacted = log_files_redacted,
    );

    Ok(ErasureReport {
        patient_id: patient_id.to_string(),
        anonymised_at: chrono::Utc::now().to_rfc3339(),
        deleted_records: deleted,
        backups_redacted,
        log_files_redacted,
    })
}

/// DB-only erasure (used for live DB and SQLCipher backup snapshots).
pub async fn erase_patient_records(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<(u64, Vec<(String,)>), AppError> {
    let chart_ids: Vec<(String,)> =
        sqlx::query_as("SELECT id FROM patient_chart WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let mut deleted: u64 = 0;
    let mut tx = pool.begin().await?;

    let exists: Option<(String,)> = sqlx::query_as("SELECT id FROM patient WHERE id = ?1")
        .bind(patient_id)
        .fetch_optional(&mut *tx)
        .await?;
    if exists.is_none() {
        tx.rollback().await?;
        return Err(AppError::NotFound("Patient".into()));
    }

    deleted += patient_repo::delete_dependents(&mut tx, patient_id, true).await?;

    let pseudo_name = format!("Anonymisiert ({patient_id})");
    let pseudo_vnr = format!("ANON-{patient_id}");

    let n = sqlx::query(
        "UPDATE patient SET
            name = ?1,
            date_of_birth = '1900-01-01',
            sex = 'DIVERSE',
            insurance_number = ?2,
            phone = NULL,
            email = NULL,
            address = NULL,
            status = 'READONLY',
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?3",
    )
    .bind(&pseudo_name)
    .bind(&pseudo_vnr)
    .bind(patient_id)
    .execute(&mut *tx)
    .await?
    .rows_affected();

    if n == 0 {
        tx.rollback().await?;
        return Err(AppError::Internal(
            "Patient was not updated after check".into(),
        ));
    }
    // F119: the pseudonymised row must replace the original on every device.
    crate::infrastructure::database::recorded_write::record_in_tx(
        &mut tx, "patient", patient_id, "UPDATE",
    )
    .await?;

    tx.commit().await?;
    Ok((deleted, chart_ids))
}

/// Apply patient erasure to every SQLCipher backup that still contains `patient_id`.
async fn redact_patient_from_all_backups(
    app_data_dir: &Path,
    patient_id: &str,
) -> Result<u32, AppError> {
    let key = db_key::ensure_sqlcipher_key(app_data_dir, false)?;
    let mut redacted = 0u32;
    for entry in backup::list()? {
        let path = entry.path;
        let Ok(pool) = sqlcipher::open_encrypted_pool(&path, key.clone(), false).await else {
            log_system!(warn,
                event = "BACKUP_REDACT_SKIP",
                path = %path.display(),
                reason = "not_sqlcipher_or_wrong_key",
            );
            continue;
        };
        let present = sqlx::query_scalar::<_, i32>("SELECT 1 FROM patient WHERE id = ?1")
            .bind(patient_id)
            .fetch_optional(&pool)
            .await?
            .is_some();
        if present {
            erase_patient_records(&pool, patient_id).await?;
            pool.close().await;
            backup::sign_file(&path)?;
            redacted += 1;
            log_system!(info,
                event = "BACKUP_REDACT_OK",
                path = %path.display(),
                patient_id = %patient_id,
            );
        } else {
            pool.close().await;
        }
    }
    Ok(redacted)
}

/// Statutory retention (§ 630f Abs. 3 BGB, § 147 AO): 10 years after the end
/// of the year of the last treatment / payment / issued document.
/// Returns the date (YYYY-12-31) until which erasure is blocked, if any.
pub async fn retention_until(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Option<String>, AppError> {
    let last: Option<String> = sqlx::query_scalar(
        "SELECT MAX(d) FROM (
            SELECT MAX(CAST(t.created_at AS TEXT)) AS d FROM treatment t
              JOIN patient_chart c ON c.id = t.chart_id WHERE c.patient_id = ?1
            UNION ALL SELECT MAX(CAST(e.created_at AS TEXT)) FROM examination e
              JOIN patient_chart c ON c.id = e.chart_id WHERE c.patient_id = ?1
            UNION ALL SELECT MAX(CAST(created_at AS TEXT)) FROM payment WHERE patient_id = ?1
            UNION ALL SELECT MAX(CAST(created_at AS TEXT)) FROM prescription WHERE patient_id = ?1
            UNION ALL SELECT MAX(CAST(created_at AS TEXT)) FROM certificate WHERE patient_id = ?1
            UNION ALL SELECT MAX(issued_at) FROM issued_document WHERE patient_id = ?1
         )",
    )
    .bind(patient_id)
    .fetch_one(pool)
    .await
    .unwrap_or(None);
    let Some(last) = last.filter(|s| s.len() >= 4) else {
        return Ok(None);
    };
    let year: i32 = last[..4].parse().unwrap_or(0);
    let until_year = year + 10;
    let now_year = chrono::Local::now()
        .format("%Y")
        .to_string()
        .parse::<i32>()
        .unwrap_or(0);
    if now_year <= until_year {
        Ok(Some(format!("{until_year}-12-31")))
    } else {
        Ok(None)
    }
}

/// Converts any SQLite row into a JSON object (column → value).
fn row_to_json(row: &SqliteRow) -> Value {
    use base64::Engine;
    let mut m = Map::new();
    for col in row.columns() {
        let i = col.ordinal();
        let raw = match row.try_get_raw(i) {
            Ok(r) => r,
            Err(_) => continue,
        };
        let v = if raw.is_null() {
            Value::Null
        } else {
            match raw.type_info().name() {
                "INTEGER" | "INT" | "INT8" | "BIGINT" | "BOOLEAN" => row
                    .try_get::<i64, _>(i)
                    .map(Value::from)
                    .unwrap_or(Value::Null),
                "REAL" | "FLOAT" | "DOUBLE" | "NUMERIC" => row
                    .try_get::<f64, _>(i)
                    .map(Value::from)
                    .unwrap_or(Value::Null),
                "BLOB" => row
                    .try_get::<Vec<u8>, _>(i)
                    .map(|b| Value::String(base64::engine::general_purpose::STANDARD.encode(b)))
                    .unwrap_or(Value::Null),
                _ => row
                    .try_get::<String, _>(i)
                    .map(Value::String)
                    .unwrap_or(Value::Null),
            }
        };
        m.insert(col.name().to_string(), v);
    }
    Value::Object(m)
}

async fn rows(pool: &SqlitePool, sql: &str, patient_id: &str) -> Result<Value, AppError> {
    let rows = sqlx::query(sql).bind(patient_id).fetch_all(pool).await?;
    Ok(Value::Array(rows.iter().map(row_to_json).collect()))
}

async fn collect_related(pool: &SqlitePool, patient_id: &str) -> Result<Value, AppError> {
    const CHART: &str = "(SELECT id FROM patient_chart WHERE patient_id = ?1)";
    let queries: Vec<(&str, String)> = vec![
        (
            "patient_chart",
            "SELECT * FROM patient_chart WHERE patient_id = ?1".into(),
        ),
        (
            "anamnesis_form",
            "SELECT * FROM anamnesis_form WHERE patient_id = ?1".into(),
        ),
        (
            "dental_findings",
            format!("SELECT * FROM dental_finding WHERE chart_id IN {CHART}"),
        ),
        (
            "examinations",
            format!("SELECT * FROM examination WHERE chart_id IN {CHART}"),
        ),
        (
            "treatments",
            format!("SELECT * FROM treatment WHERE chart_id IN {CHART}"),
        ),
        (
            "prescriptions",
            "SELECT * FROM prescription WHERE patient_id = ?1".into(),
        ),
        (
            "certificates",
            "SELECT * FROM certificate WHERE patient_id = ?1".into(),
        ),
        (
            "appointments",
            "SELECT * FROM appointment WHERE patient_id = ?1".into(),
        ),
        (
            "payments",
            "SELECT * FROM payment WHERE patient_id = ?1".into(),
        ),
        (
            // Metadata only; the files themselves are added by the ZIP export.
            "chart_attachments",
            format!(
                "SELECT id, chart_id, display_name, mime_type, size_bytes, created_at \
                 FROM chart_attachment WHERE chart_id IN {CHART}"
            ),
        ),
    ];
    let mut out = Map::new();
    for (key, sql) in queries {
        out.insert(key.to_string(), rows(pool, &sql, patient_id).await?);
    }
    Ok(Value::Object(out))
}
