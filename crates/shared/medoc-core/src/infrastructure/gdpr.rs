// GDPR (DSGVO) compliance helpers (NFA-EU-01).
//
// - export_patient: collects all data linked to a patient and serialises it
//   as a single JSON document (Art. 20 — right to data portability).
// - erase_patient: pseudonymises staff identifiers and deletes related
//   medical records (Art. 17 — right to erasure) while preserving the
//   audit trail for legal retention (10 years per § 630f BGB).

use serde::Serialize;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use std::path::Path;

use crate::error::AppError;
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

    log_system!(info, event = "DSGVO_EXPORT", patient_id = %patient_id);

    Ok(json!({
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "schema_version": 2,
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
    let (deleted, chart_ids) = erase_patient_records(pool, patient_id).await?;

    for (aid,) in chart_ids {
        crate::infrastructure::database::chart_attachment_repo::remove_storage_dir_best_effort(
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

    deleted += sqlx::query("DELETE FROM appointment WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM anamnesis_form WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM payment WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM prescription WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM certificate WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM chart_validation WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM chart_next_appointment_hint WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    let in_app_needle = format!("%\"patient_id\":\"{patient_id}\"%");
    deleted += sqlx::query("DELETE FROM in_app_notification WHERE payload_json LIKE ?1")
        .bind(&in_app_needle)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM invoice_document WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM patient_chart WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

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
            status = 'READONLY'
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

async fn collect_related(pool: &SqlitePool, patient_id: &str) -> Result<Value, AppError> {
    let appointments: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM appointment WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let treatments: Vec<(String,)> = sqlx::query_as(
        "SELECT 'row:' || id FROM treatment WHERE chart_id IN
         (SELECT id FROM patient_chart WHERE patient_id = ?1)",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;

    let examinations: Vec<(String,)> = sqlx::query_as(
        "SELECT 'row:' || id FROM examination WHERE chart_id IN
         (SELECT id FROM patient_chart WHERE patient_id = ?1)",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;

    let dentalFindings: Vec<(String,)> = sqlx::query_as(
        "SELECT 'row:' || id FROM dental_finding WHERE chart_id IN
         (SELECT id FROM patient_chart WHERE patient_id = ?1)",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;

    let anamnesisForm: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM anamnesis_form WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let payments: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM payment WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let patientChart: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM patient_chart WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let prescriptions: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM prescription WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let certificates: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM certificate WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let chart_attachment: Vec<(String,)> = sqlx::query_as(
        "SELECT 'row:' || id FROM chart_attachment WHERE chart_id IN
         (SELECT id FROM patient_chart WHERE patient_id = ?1)",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;

    let mut out = serde_json::Map::new();
    for (key, rows) in [
        ("appointments", appointments),
        ("treatments", treatments),
        ("examinations", examinations),
        ("dentalFindings", dentalFindings),
        ("anamnesis_form", anamnesisForm),
        ("payments", payments),
        ("patient_chart", patientChart),
        ("prescriptions", prescriptions),
        ("certificates", certificates),
        ("chart_attachment", chart_attachment),
    ] {
        out.insert(
            key.to_string(),
            json!(rows.into_iter().map(|(s,)| s).collect::<Vec<_>>()),
        );
    }
    Ok(Value::Object(out))
}
