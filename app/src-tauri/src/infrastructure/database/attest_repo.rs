use sqlx::SqlitePool;
use uuid::Uuid;

use crate::domain::entities::attest::{Attest, CreateAttest};
use crate::error::AppError;

pub async fn find_for_patient(
    pool: &SqlitePool,
    patient_id: &str,
) -> Result<Vec<Attest>, AppError> {
    let rows = sqlx::query_as::<_, Attest>(
        "SELECT * FROM attest WHERE patient_id = ?1 ORDER BY ausgestellt_am DESC",
    )
    .bind(patient_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn find_by_id(pool: &SqlitePool, id: &str) -> Result<Option<Attest>, AppError> {
    let row = sqlx::query_as::<_, Attest>("SELECT * FROM attest WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?;
    Ok(row)
}

pub async fn create(pool: &SqlitePool, data: &CreateAttest) -> Result<Attest, AppError> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO attest (id, patient_id, arzt_id, typ, inhalt, gueltig_von, gueltig_bis)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(&id)
    .bind(&data.patient_id)
    .bind(&data.arzt_id)
    .bind(&data.typ)
    .bind(&data.inhalt)
    .bind(data.gueltig_von)
    .bind(data.gueltig_bis)
    .execute(pool)
    .await?;
    find_by_id(pool, &id)
        .await?
        .ok_or(AppError::Internal("Attest create failed".into()))
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM attest WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
