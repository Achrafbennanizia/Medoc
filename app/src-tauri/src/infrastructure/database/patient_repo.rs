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

pub async fn search(pool: &SqlitePool, query: &str) -> Result<Vec<Patient>, AppError> {
    let pattern = format!("%{}%", query);
    let rows = sqlx::query_as::<_, Patient>(
        "SELECT * FROM patient WHERE name LIKE ?1 OR versicherungsnummer LIKE ?1 ORDER BY name",
    )
    .bind(&pattern)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create(pool: &SqlitePool, data: &CreatePatient) -> Result<Patient, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    let geschlecht = serde_json::to_string(&data.geschlecht)
        .unwrap()
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

    find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Insert failed".into()))
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
    let status = data
        .status
        .as_ref()
        .map(|s| {
            serde_json::to_string(s)
                .unwrap()
                .trim_matches('"')
                .to_uppercase()
        })
        .unwrap_or(existing.status.clone());

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

    find_by_id(pool, id)
        .await?
        .ok_or(AppError::Internal("Update failed".into()))
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM patient WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
