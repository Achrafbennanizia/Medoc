use crate::domain::entities::patient::{CreatePatient, UpdatePatient};
use crate::domain::entities::Patient;
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Patient>, AppError> {
    let rows = sqlx::query_as::<_, Patient>("SELECT * FROM patient ORDER BY name")
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Patient>, AppError> {
    let row = sqlx::query_as::<_, Patient>("SELECT * FROM patient WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn search(
    pool: &SqlitePool,
    query: &str,
    include_versicherungsnummer: bool,
) -> Result<Vec<Patient>, AppError> {
    let pattern = format!("%{}%", query);
    let sql = if include_versicherungsnummer {
        "SELECT * FROM patient WHERE name LIKE ?1 OR versicherungsnummer LIKE ?1 ORDER BY name"
    } else {
        "SELECT * FROM patient WHERE name LIKE ?1 ORDER BY name"
    };
    let rows = sqlx::query_as::<_, Patient>(sql)
        .bind(&pattern)
        .fetch_all(pool)
        .await?;
    Ok(rows)
}

pub async fn create(pool: &SqlitePool, data: &CreatePatient) -> Result<Patient, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let geschlecht = serde_json::to_string(&data.geschlecht)
        .map_err(|e| AppError::Internal(format!("Geschlecht serialisieren: {e}")))?
        .trim_matches('"')
        .to_uppercase();

    sqlx::query(
        "INSERT INTO patient (id, name, geburtsdatum, geschlecht, versicherungsnummer, telefon, email, adresse)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    )
    .bind(&id)
    .bind(&data.name)
    .bind(data.geburtsdatum.to_string())
    .bind(&geschlecht)
    .bind(&data.versicherungsnummer)
    .bind(&data.telefon)
    .bind(&data.email)
    .bind(&data.adresse)
    .execute(pool)
    .await?;

    // Auto-create Patientenakte
    let akte_id = uuid::Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO patientenakte (id, patient_id) VALUES (?1, ?2)")
        .bind(&akte_id)
        .bind(&id)
        .execute(pool)
        .await?;

    let anam_id = uuid::Uuid::new_v4().to_string();
    let empty_anam = r#"{"version":1,"vorerkrankungen":{},"medikation":{},"allergien":{}}"#;
    sqlx::query(
        "INSERT INTO anamnesebogen (id, patient_id, antworten, unterschrieben) VALUES (?1, ?2, ?3, 0)",
    )
    .bind(&anam_id)
    .bind(&id)
    .bind(empty_anam)
    .execute(pool)
    .await?;

    let inserted = find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))?;
    let body = serde_json::to_string(&inserted).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "patient", &id, "INSERT", &body,
    )
    .await?;
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "patientenakte",
        &akte_id,
        "INSERT",
        &format!("{{\"id\":\"{akte_id}\",\"patient_id\":\"{id}\"}}"),
    )
    .await?;
    Ok(inserted)
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdatePatient,
) -> Result<Patient, AppError> {
    let existing = find_by_id(pool, id)
        .await?
        .ok_or(AppError::NotFound("Patient".into()))?;

    let name = data.name.as_deref().unwrap_or(&existing.name);
    let status = match data.status.as_ref() {
        Some(s) => serde_json::to_string(s)
            .map_err(|e| AppError::Internal(format!("Status serialisieren: {e}")))?
            .trim_matches('"')
            .to_uppercase(),
        None => existing.status.clone(),
    };

    sqlx::query(
        "UPDATE patient SET name = ?1, telefon = ?2, email = ?3, adresse = ?4,
         status = ?5, updated_at = CURRENT_TIMESTAMP WHERE id = ?6",
    )
    .bind(name)
    .bind(data.telefon.as_deref().or(existing.telefon.as_deref()))
    .bind(data.email.as_deref().or(existing.email.as_deref()))
    .bind(data.adresse.as_deref().or(existing.adresse.as_deref()))
    .bind(&status)
    .bind(id)
    .execute(pool)
    .await?;

    let updated = find_by_id(pool, id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))?;
    let body = serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "patient", id, "UPDATE", &body,
    )
    .await?;
    Ok(updated)
}

/// FA-PAT-03: NEU marks first-time visitors with initial appointment(s).
/// Status expires automatically when their first appointment is completed (`DURCHGEFUEHRT`).
pub async fn expire_neu_status_after_completed_termin(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<bool, AppError> {
    let existing = find_by_id(pool, patient_id).await?;
    let Some(p) = existing else {
        return Ok(false);
    };
    if !p.status.eq_ignore_ascii_case("NEU") {
        return Ok(false);
    }

    let result = sqlx::query(
        "UPDATE patient SET status = 'AKTIV', updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND status = 'NEU'",
    )
    .bind(patient_id)
    .execute(pool)
    .await?;

    if result.rows_affected() == 0 {
        return Ok(false);
    }

    let updated = find_by_id(pool, patient_id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))?;
    let body =
        serde_json::to_string(&updated).unwrap_or_else(|_| format!("{{\"id\":\"{patient_id}\"}}"));
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool, "patient", patient_id, "UPDATE", &body,
    )
    .await?;
    Ok(true)
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM patient WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    crate::infrastructure::database::sync_outbox::record_or_noop(
        pool,
        "patient",
        id,
        "DELETE",
        &format!("{{\"id\":\"{id}\"}}"),
    )
    .await?;
    Ok(())
}
