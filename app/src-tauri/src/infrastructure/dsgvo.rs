// DSGVO compliance helpers (NFA-EU-01).
//
// - export_patient: collects all data linked to a patient and serialises it
//   as a single JSON document (Art. 20 — Recht auf Datenübertragbarkeit).
// - erase_patient: pseudonymises personal identifiers and deletes related
//   medical records (Art. 17 — Recht auf Löschung) while preserving the
//   audit trail for legal retention (10 years per § 630f BGB).

use serde::Serialize;
use serde_json::{json, Value};
use sqlx::SqlitePool;
use std::path::Path;

use crate::error::AppError;
use crate::log_system;

#[derive(Debug, Serialize)]
pub struct ErasureReport {
    pub patient_id: String,
    pub anonymised_at: String,
    pub deleted_records: u64,
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
        "SELECT id, name, geburtsdatum, geschlecht, versicherungsnummer,
                    telefon, email, adresse, status
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
            "id": p.0, "name": p.1, "geburtsdatum": p.2, "geschlecht": p.3,
            "versicherungsnummer": p.4, "telefon": p.5, "email": p.6,
            "adresse": p.7, "status": p.8,
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
    let akte_ids: Vec<(String,)> = sqlx::query_as(
        "SELECT id FROM patientenakte WHERE patient_id = ?1",
    )
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

    deleted += sqlx::query("DELETE FROM termin WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM anamnesebogen WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM zahlung WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM rezept WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM attest WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM akte_validation WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM akte_next_termin_hint WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    deleted += sqlx::query("DELETE FROM rechnung_document WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    // CASCADE removes zahnbefund, untersuchung, behandlung linked via patientenakte.
    deleted += sqlx::query("DELETE FROM patientenakte WHERE patient_id = ?1")
        .bind(patient_id)
        .execute(&mut *tx)
        .await?
        .rows_affected();

    let pseudo_name = format!("Anonymisiert ({})", patient_id);
    let pseudo_vnr = format!("ANON-{patient_id}");

    let n = sqlx::query(
        "UPDATE patient SET
            name = ?1,
            geburtsdatum = '1900-01-01',
            geschlecht = 'DIVERS',
            versicherungsnummer = ?2,
            telefon = NULL,
            email = NULL,
            adresse = NULL,
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
            "Patient wurde nach Prüfung nicht aktualisiert".into(),
        ));
    }

    tx.commit().await?;

    for (aid,) in akte_ids {
        crate::infrastructure::database::akte_anlage_repo::remove_storage_dir_best_effort(
            app_data_dir,
            &aid,
        );
    }

    log_system!(warn, event = "DSGVO_ERASURE", patient_id = %patient_id, deleted_records = deleted);

    Ok(ErasureReport {
        patient_id: patient_id.to_string(),
        anonymised_at: chrono::Utc::now().to_rfc3339(),
        deleted_records: deleted,
    })
}

async fn collect_related(pool: &SqlitePool, patient_id: &str) -> Result<Value, AppError> {
    let termine: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM termin WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let behandlungen: Vec<(String,)> = sqlx::query_as(
        "SELECT 'row:' || id FROM behandlung WHERE akte_id IN
         (SELECT id FROM patientenakte WHERE patient_id = ?1)",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;

    let untersuchungen: Vec<(String,)> = sqlx::query_as(
        "SELECT 'row:' || id FROM untersuchung WHERE akte_id IN
         (SELECT id FROM patientenakte WHERE patient_id = ?1)",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;

    let zahnbefunde: Vec<(String,)> = sqlx::query_as(
        "SELECT 'row:' || id FROM zahnbefund WHERE akte_id IN
         (SELECT id FROM patientenakte WHERE patient_id = ?1)",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;

    let anamnesebogen: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM anamnesebogen WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let zahlungen: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM zahlung WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let patientenakte: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM patientenakte WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let rezepte: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM rezept WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let atteste: Vec<(String,)> =
        sqlx::query_as("SELECT 'row:' || id FROM attest WHERE patient_id = ?1")
            .bind(patient_id)
            .fetch_all(pool)
            .await?;

    let akte_anlage: Vec<(String,)> = sqlx::query_as(
        "SELECT 'row:' || id FROM akte_anlage WHERE akte_id IN
         (SELECT id FROM patientenakte WHERE patient_id = ?1)",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;

    let mut out = serde_json::Map::new();
    for (key, rows) in [
        ("termine", termine),
        ("behandlungen", behandlungen),
        ("untersuchungen", untersuchungen),
        ("zahnbefunde", zahnbefunde),
        ("anamnesebogen", anamnesebogen),
        ("zahlungen", zahlungen),
        ("patientenakte", patientenakte),
        ("rezepte", rezepte),
        ("atteste", atteste),
        ("akte_anlage", akte_anlage),
    ] {
        out.insert(
            key.to_string(),
            json!(rows.into_iter().map(|(s,)| s).collect::<Vec<_>>()),
        );
    }
    Ok(Value::Object(out))
}
