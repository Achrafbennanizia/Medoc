use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::entities::rezept::{CreateRezept, Rezept, UpdateRezept};
use crate::error::AppError;

pub async fn find_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<Rezept>, AppError> {
    let rows = sqlx::query_as::<_, Rezept>(
        "SELECT * FROM rezept WHERE patient_id = ?1 ORDER BY ausgestellt_am DESC",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Rezept>, AppError> {
    let row = sqlx::query_as::<_, Rezept>("SELECT * FROM rezept WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn create(pool: &SqlitePool, data: &CreateRezept) -> Result<Rezept, AppError> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO rezept (id, patient_id, arzt_id, medikament, wirkstoff, dosierung, dauer, hinweise)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(&data.arzt_id)
    .bind(&data.medikament)
    .bind(&data.wirkstoff)
    .bind(&data.dosierung)
    .bind(&data.dauer)
    .bind(&data.hinweise)
    .execute(pool)
    .await?;
    find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Rezept create failed".into()))
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM rezept WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update(pool: &SqlitePool, data: &UpdateRezept) -> Result<Rezept, AppError> {
    let ex = find_by_id(pool, &data.id)
        .await?
        .ok_or(AppError::NotFound("Rezept".into()))?;
    sqlx::query(
        "UPDATE rezept SET medikament = ?1, wirkstoff = ?2, dosierung = ?3, dauer = ?4, hinweise = ?5
         WHERE id = ?6",
    )
    .bind(&data.medikament)
    .bind(&data.wirkstoff)
    .bind(&data.dosierung)
    .bind(&data.dauer)
    .bind(&data.hinweise)
    .bind(&data.id)
    .execute(pool)
    .await?;
    find_by_id(pool, &ex.id)
        .await?
        .ok_or(AppError::Internal("Rezept update failed".into()))
}
