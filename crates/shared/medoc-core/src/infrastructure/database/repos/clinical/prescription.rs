use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::entities::prescription::{CreatePrescription, Prescription, UpdatePrescription};
use crate::error::AppError;

pub async fn find_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<Prescription>, AppError> {
    let rows = sqlx::query_as::<_, Prescription>(
        // F86: superseded versions stay in the table (history) but not in the list.
        "SELECT * FROM prescription WHERE patient_id = ?1 AND status != 'REPLACED' ORDER BY issued_at DESC",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Prescription>, AppError> {
    let row = sqlx::query_as::<_, Prescription>("SELECT * FROM prescription WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn create(
    pool: &SqlitePool,
    data: &CreatePrescription,
) -> Result<Prescription, AppError> {
    let id = Uuid::new_v4().to_string();
    let aut_idem = data.aut_idem.unwrap_or(true);
    let prescription_type = data
        .prescription_type
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("PRIVAT");
    // F87: issue date is the practice-local day, not SQLite's UTC date('now').
    let issued_on = local_today(pool).await;
    sqlx::query(
        "INSERT INTO prescription (
            id, patient_id, physician_id, medication, active_ingredient, dosage, duration, instructions,
            pzn, dosage_form, pack_size, quantity, aut_idem, prescription_type, icd10_code, prescribing_physician_id,
            issued_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(&data.physician_id)
    .bind(&data.medication)
    .bind(&data.active_ingredient)
    .bind(&data.dosage)
    .bind(&data.duration)
    .bind(&data.instructions)
    .bind(&data.pzn)
    .bind(&data.dosage_form)
    .bind(&data.pack_size)
    .bind(data.quantity)
    .bind(aut_idem)
    .bind(prescription_type)
    .bind(&data.icd10_code)
    .bind(&data.prescribing_physician_id)
    .bind(&issued_on)
    .execute(pool)
    .await?;
    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Prescription create failed".into()))?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "prescription",
        &id,
        "INSERT",
        &body,
    )
    .await?;
    Ok(inserted)
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM prescription WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "prescription",
        id,
        "DELETE",
        "{}",
    )
    .await?;
    Ok(())
}

async fn local_today(pool: &SqlitePool) -> String {
    let tz = crate::domain::practice_time::practice_tz(pool).await;
    chrono::Utc::now().with_timezone(&tz).date_naive().format("%Y-%m-%d").to_string()
}

/// F86: insert the corrected version (`replaces_id` = old id) and mark the old
/// row `REPLACED`, in one transaction. Returns the new version.
async fn correct_issued(
    pool: &SqlitePool,
    ex: &Prescription,
    data: &UpdatePrescription,
    aut_idem: bool,
    prescription_type: &str,
) -> Result<Prescription, AppError> {
    let new_id = Uuid::new_v4().to_string();
    let issued_on = local_today(pool).await;
    let mut tx = pool.begin().await?;
    sqlx::query(
        "INSERT INTO prescription (
            id, patient_id, physician_id, medication, active_ingredient, dosage, duration, instructions,
            pzn, dosage_form, pack_size, quantity, aut_idem, prescription_type, icd10_code, prescribing_physician_id,
            issued_at, status, replaces_id, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, 'ISSUED', ?18,
                  strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    )
    .bind(&new_id)
    .bind(&ex.patient_id)
    .bind(&ex.physician_id)
    .bind(&data.medication)
    .bind(&data.active_ingredient)
    .bind(&data.dosage)
    .bind(&data.duration)
    .bind(&data.instructions)
    .bind(&data.pzn)
    .bind(&data.dosage_form)
    .bind(&data.pack_size)
    .bind(data.quantity)
    .bind(aut_idem)
    .bind(prescription_type)
    .bind(&data.icd10_code)
    .bind(&data.prescribing_physician_id)
    .bind(&issued_on)
    .bind(&ex.id)
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(&mut tx, "prescription", &new_id, "INSERT")
        .await?;
    sqlx::query(
        "UPDATE prescription SET status = 'REPLACED', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?1 AND status = 'ISSUED'",
    )
    .bind(&ex.id)
    .execute(&mut *tx)
    .await?;
    crate::infrastructure::database::recorded_write::record_in_tx(&mut tx, "prescription", &ex.id, "UPDATE")
        .await?;
    tx.commit().await?;
    find_by_id(pool, &new_id)
        .await?
        .ok_or(AppError::Internal("Prescription correction failed".into()))
}

pub async fn update(
    pool: &SqlitePool,
    data: &UpdatePrescription,
) -> Result<Prescription, AppError> {
    let ex = find_by_id(pool, &data.id)
        .await?
        .ok_or(AppError::NotFound("Prescription".into()))?;
    let aut_idem = data.aut_idem.or(ex.aut_idem).unwrap_or(true);
    let prescription_type = data
        .prescription_type
        .as_deref()
        .or(ex.prescription_type.as_deref())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("PRIVAT");
    match ex.status.as_str() {
        "REPLACED" => {
            return Err(AppError::Conflict(
                "This prescription was already corrected; edit the newest version".into(),
            ))
        }
        // F86: an issued prescription is a document; a correction is a new version.
        "ISSUED" => return correct_issued(pool, &ex, data, aut_idem, prescription_type).await,
        _ => {}
    }
    sqlx::query(
        "UPDATE prescription SET
            medication = ?1, active_ingredient = ?2, dosage = ?3, duration = ?4, instructions = ?5,
            pzn = ?6, dosage_form = ?7, pack_size = ?8, quantity = ?9,
            aut_idem = ?10, prescription_type = ?11, icd10_code = ?12, prescribing_physician_id = ?13,
            updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?14",
    )
    .bind(&data.medication)
    .bind(&data.active_ingredient)
    .bind(&data.dosage)
    .bind(&data.duration)
    .bind(&data.instructions)
    .bind(&data.pzn)
    .bind(&data.dosage_form)
    .bind(&data.pack_size)
    .bind(data.quantity)
    .bind(aut_idem)
    .bind(prescription_type)
    .bind(&data.icd10_code)
    .bind(&data.prescribing_physician_id)
    .bind(&data.id)
    .execute(pool)
    .await?;
    let updated = find_by_id(pool, &ex.id)
        .await?
        .ok_or(AppError::Internal("Prescription update failed".into()))?;
    let body = serde_json::to_string(&updated)
        .unwrap_or_else(|_| format!("{{\"id\":\"{}\"}}", updated.id));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "prescription",
        &updated.id,
        "UPDATE",
        &body,
    )
    .await?;
    Ok(updated)
}
