use crate::domain::entities::produkt::{CreateProdukt, UpdateProdukt};
use crate::domain::entities::Produkt;
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn find_all(pool: &SqlitePool) -> Result<Vec<Produkt>, AppError> {
    let rows = sqlx::query_as::<_, Produkt>(
        "SELECT * FROM produkt WHERE aktiv = 1 ORDER BY kategorie, name",
    )
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

pub async fn create(pool: &SqlitePool, data: &CreateProdukt) -> Result<Produkt, AppError> {
    let id = uuid::Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO produkt (id, name, beschreibung, kategorie, preis, bestand, mindestbestand)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
    )
    .bind(&id)
    .bind(&data.name)
    .bind(&data.beschreibung)
    .bind(&data.kategorie)
    .bind(data.preis)
    .bind(data.bestand)
    .bind(data.mindestbestand)
    .execute(pool)
    .await?;

    Ok(
        sqlx::query_as::<_, Produkt>("SELECT * FROM produkt WHERE id = ?1")
            .bind(&id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn update(
    pool: &SqlitePool,
    id: &str,
    data: &UpdateProdukt,
) -> Result<Produkt, AppError> {
    let existing = sqlx::query_as::<_, Produkt>("SELECT * FROM produkt WHERE id = ?1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound("Produkt".into()))?;

    sqlx::query(
        "UPDATE produkt SET name = ?1, beschreibung = ?2, kategorie = ?3, preis = ?4,
         bestand = ?5, mindestbestand = ?6, aktiv = ?7, updated_at = CURRENT_TIMESTAMP WHERE id = ?8"
    )
    .bind(data.name.as_deref().unwrap_or(&existing.name))
    .bind(data.beschreibung.as_deref().or(existing.beschreibung.as_deref()))
    .bind(data.kategorie.as_deref().unwrap_or(&existing.kategorie))
    .bind(data.preis.unwrap_or(existing.preis))
    .bind(data.bestand.unwrap_or(existing.bestand))
    .bind(data.mindestbestand.unwrap_or(existing.mindestbestand))
    .bind(data.aktiv.unwrap_or(existing.aktiv))
    .bind(id)
    .execute(pool)
    .await?;

    Ok(
        sqlx::query_as::<_, Produkt>("SELECT * FROM produkt WHERE id = ?1")
            .bind(id)
            .fetch_one(pool)
            .await?,
    )
}

pub async fn delete(pool: &SqlitePool, id: &str) -> Result<(), AppError> {
    sqlx::query("UPDATE produkt SET aktiv = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
