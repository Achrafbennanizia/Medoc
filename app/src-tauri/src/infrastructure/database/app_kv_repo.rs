//! Generic key/value store backed by SQLite.
//!
//! Replaces ad-hoc browser `localStorage` for practice-wide settings (work
//! schedule, special closures, dashboard preferences, …). Keeps DSGVO scope
//! tight: values are arbitrary JSON strings owned by the app, not patient
//! data — but they live in the same encrypted-at-rest store as the rest of
//! the medical record (NFA-SEC-08 backlog applies equally).
use crate::error::AppError;
use sqlx::SqlitePool;

pub async fn get(pool: &SqlitePool, key: &str) -> Result<Option<String>, AppError> {
    let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
        .bind(key)
        .fetch_optional(pool)
        .await?;
    Ok(row.map(|(v,)| v))
}

pub async fn set(pool: &SqlitePool, key: &str, value: &str) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, key: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM app_kv WHERE key = ?1")
        .bind(key)
        .execute(pool)
        .await?;
    Ok(())
}
