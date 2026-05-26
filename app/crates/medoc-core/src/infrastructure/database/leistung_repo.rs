use crate::domain::entities::leistung::{CreateLeistung, UpdateLeistung};
use crate::domain::entities::Leistung;
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Leistung>, AppError> {
    let rows = sqlx::query_as::<_, Leistung>(
        "SELECT * FROM leistung WHERE aktiv = 1 ORDER BY kategorie, name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create(pool: &SqlitePool, data: &CreateLeistung) -> Result<Leistung, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO leistung (id, name, beschreibung, kategorie, preis)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(&id)
    .bind(&data.name)
    .bind(&data.beschreibung)
    .bind(&data.kategorie)
    .bind(data.preis)
    .execute(pool)
    .await?;

    Ok(
        sqlx::query_as::<_, Leistung>("SELECT * FROM leistung WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateLeistung,
) -> Result<Leistung, AppError> {
    let existing = sqlx::query_as::<_, Leistung>("SELECT * FROM leistung WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Leistung".into()))?;

    sqlx::query(
        "UPDATE leistung SET name = ?1, beschreibung = ?2, kategorie = ?3, preis = ?4,
         aktiv = ?5, updated_at = CURRENT_TIMESTAMP WHERE id = ?6",
    )
    .bind(data.name.as_deref().unwrap_or(&existing.name))
    .bind(
        data.beschreibung
            .as_deref()
            .or(existing.beschreibung.as_deref()),
    )
    .bind(data.kategorie.as_deref().unwrap_or(&existing.kategorie))
    .bind(data.preis.unwrap_or(existing.preis))
    .bind(data.aktiv.unwrap_or(existing.aktiv))
    .bind(id)
    .execute(pool)
    .await?;

    Ok(
        sqlx::query_as::<_, Leistung>("SELECT * FROM leistung WHERE id = ?1")
            .bind(id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    // Soft delete
    sqlx::query("UPDATE leistung SET aktiv = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
