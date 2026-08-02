use crate::domain::entities::termin::{CreateTermin, UpdateTermin};
use crate::domain::entities::Termin;
use crate::domain::services::konflikt::{self, ArztSlotConflictQuery};
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Termin>, AppError> {
    let rows = sqlx::query_as::<_, Termin>("SELECT * FROM termin ORDER BY datum DESC, uhrzeit ASC")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Termin>, AppError> {
    let row = sqlx::query_as::<_, Termin>("SELECT * FROM termin WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn find_by_date(pool: &SqlitePool, datum: &str) -> Result<Vec<Termin>, AppError> {
    let rows =
        sqlx::query_as::<_, Termin>("SELECT * FROM termin WHERE datum = ?1 ORDER BY uhrzeit ASC")
            .bind(datum)
            .fetch_all(pool)
            .await?;
    Ok(rows)
}

pub async fn check_conflict(
    pool: &SqlitePool,
    datum: &str,
    uhrzeit: &str,
    arzt_id: &str,
    exclude_id: Option<&str>,
) -> Result<bool, AppError> {
    konflikt::has_arzt_slot_conflict(
        pool,
        ArztSlotConflictQuery {
            datum,
            uhrzeit,
            arzt_id,
            exclude_termin_id: exclude_id,
        },
    )
    .await
}

pub async fn create(pool: &SqlitePool, data: &CreateTermin) -> Result<Termin, AppError> {
    // Check for time conflict
    if check_conflict(pool, &data.datum, &data.uhrzeit, &data.arzt_id, None).await? {
        return Err(AppError::Conflict(konflikt::arzt_slot_conflict_message(
            &data.datum,
            &data.uhrzeit,
        )));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let art = serde_json::to_string(&data.art)
        .map_err(|e| AppError::Internal(format!("Serialize appointment type: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    sqlx::query(
        "INSERT INTO termin (id, datum, uhrzeit, art, patient_id, arzt_id, notizen, beschwerden)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(&data.datum)
    .bind(&data.uhrzeit)
    .bind(&art)
    .bind(&data.patient_id)
    .bind(&data.arzt_id)
    .bind(&data.notizen)
    .bind(&data.beschwerden)
    .execute(pool)
    .await?;

    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "termin", &id, "INSERT", &body,
    )
    .await?;
    Ok(inserted)
}

pub async fn update(pool: &SqlitePool, id: &str, data: &UpdateTermin) -> Result<Termin, AppError> {
    let existing = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Termin".into()))?;

    let datum = data.datum.as_deref().unwrap_or(&existing.datum);
    let uhrzeit = data.uhrzeit.as_deref().unwrap_or(&existing.uhrzeit);
    let arzt_id = data.arzt_id.as_deref().unwrap_or(&existing.arzt_id);

    // Check conflict if date/time/arzt changed
    if (datum != existing.datum || uhrzeit != existing.uhrzeit || arzt_id != existing.arzt_id)
        && check_conflict(pool, datum, uhrzeit, arzt_id, Some(id)).await?
    {
        return Err(AppError::Conflict(
            konflikt::appointment_conflict_short_message().into(),
        ));
    }

    let art = match data.art.as_ref() {
        Some(a) => serde_json::to_string(a)
            .map_err(|e| AppError::Internal(format!("Serialize appointment type: {e}")))?
            .trim_matches('"')
            .to_uppercase(),
        None => existing.art.clone(),
    };
    let status = match data.status.as_ref() {
        Some(s) => serde_json::to_string(s)
            .map_err(|e| AppError::Internal(format!("Serialize appointment status: {e}")))?
            .trim_matches('"')
            .to_uppercase(),
        None => existing.status.clone(),
    };

    sqlx::query(
        "UPDATE termin SET datum = ?1, uhrzeit = ?2, art = ?3, status = ?4,
         notizen = ?5, beschwerden = ?6, arzt_id = ?7, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?8",
    )
    .bind(datum)
    .bind(uhrzeit)
    .bind(&art)
    .bind(&status)
    .bind(data.notizen.as_deref().or(existing.notizen.as_deref()))
    .bind(
        data.beschwerden
            .as_deref()
            .or(existing.beschwerden.as_deref()),
    )
    .bind(arzt_id)
    .bind(id)
    .execute(pool)
    .await?;

    let updated = find_by_id(pool, id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "termin", id, "UPDATE", &body,
    )
    .await?;
    Ok(updated)
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM termin WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "termin",
        id,
        "DELETE",
        &format!("{{\"id\":\"{id}\"}}"),
    )
    .await?;
    Ok(())
}

/// Next upcoming appointment for the patient (local by date/time).
/// Excludes cancelled appointments.
pub async fn find_next_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Option<Termin>, AppError> {
    let row = sqlx::query_as::<_, Termin>(
        "SELECT * FROM termin
         WHERE patient_id = ?1
           AND (status IS NULL OR TRIM(UPPER(status)) NOT IN ('ABGESAGT'))
           AND (
             (datum || ' ' || CASE
               WHEN trim(COALESCE(uhrzeit, '')) = '' THEN '23:59'
               ELSE trim(uhrzeit)
             END)
             >= strftime('%Y-%m-%d %H:%M', 'now', 'localtime')
           )
         ORDER BY datum ASC, uhrzeit ASC
         LIMIT 1",
    )
    .bind(patient_id)
    .fetch_optional(pool)
    .await?;
    Ok(row)
}
