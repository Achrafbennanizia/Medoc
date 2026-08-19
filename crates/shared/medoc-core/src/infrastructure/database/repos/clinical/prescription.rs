use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::entities::prescription::{CreatePrescription, Prescription, UpdatePrescription};
use crate::error::AppError;

pub async fn find_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<Prescription>, AppError> {
    let rows = sqlx::query_as::<_, Prescription>(
        "SELECT * FROM prescription WHERE patient_id = ?1 ORDER BY issued_at DESC",
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

pub async fn create(pool: &SqlitePool, data: &CreatePrescription) -> Result<Prescription, AppError> {
    let id = Uuid::new_v4().to_string();
    let aut_idem = data.aut_idem.unwrap_or(true);
    let prescription_type = data
        .prescription_type
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("PRIVAT");
    sqlx::query(
        "INSERT INTO prescription (
            id, patient_id, physician_id, medication, active_ingredient, dosage, duration, instructions,
            pzn, dosage_form, pack_size, quantity, aut_idem, prescription_type, icd10_code, prescribing_physician_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
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
    .execute(pool)
    .await?;
    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Prescription create failed".into()))?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "prescription", &id, "INSERT", &body,
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
        pool, "prescription", id, "DELETE", "{}",
    )
    .await?;
    Ok(())
}

pub async fn update(pool: &SqlitePool, data: &UpdatePrescription) -> Result<Prescription, AppError> {
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
    sqlx::query(
        "UPDATE prescription SET
            medication = ?1, active_ingredient = ?2, dosage = ?3, duration = ?4, instructions = ?5,
            pzn = ?6, dosage_form = ?7, pack_size = ?8, quantity = ?9,
            aut_idem = ?10, prescription_type = ?11, icd10_code = ?12, prescribing_physician_id = ?13
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
