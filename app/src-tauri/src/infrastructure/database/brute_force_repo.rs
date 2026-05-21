//! Persistent brute-force lockouts (survive app restart).

use chrono::{DateTime, Utc};
use sqlx::SqlitePool;

use crate::error::AppError;

#[derive(Debug, Clone)]
pub struct LockoutRow {
    pub key_hash: String,
    pub failure_count: i64,
    pub locked_until: Option<DateTime<Utc>>,
}

pub async fn ensure_schema(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS brute_force_lockout (
            key_hash TEXT PRIMARY KEY,
            failure_count INTEGER NOT NULL DEFAULT 0,
            locked_until TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )",
    )
    .execute(pool)
    .await?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_brute_force_locked_until
         ON brute_force_lockout (locked_until)",
    )
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get(pool: &SqlitePool, key_hash: &str) -> Result<Option<LockoutRow>, AppError> {
    let row: Option<(String, i64, Option<String>)> = sqlx::query_as(
        "SELECT key_hash, failure_count, locked_until FROM brute_force_lockout WHERE key_hash = ?1",
    )
    .bind(key_hash)
    .fetch_optional(pool)
    .await?;
    Ok(row.map(|(key_hash, failure_count, locked_until)| LockoutRow {
        key_hash,
        failure_count,
        locked_until: parse_dt(locked_until),
    }))
}

pub async fn upsert(
    pool: &SqlitePool,
    key_hash: &str,
    failure_count: i64,
    locked_until: Option<DateTime<Utc>>,
) -> Result<(), AppError> {
    let locked = locked_until.map(|t| t.to_rfc3339());
    sqlx::query(
        "INSERT INTO brute_force_lockout (key_hash, failure_count, locked_until, updated_at)
         VALUES (?1, ?2, ?3, datetime('now'))
         ON CONFLICT(key_hash) DO UPDATE SET
           failure_count = excluded.failure_count,
           locked_until = excluded.locked_until,
           updated_at = datetime('now')",
    )
    .bind(key_hash)
    .bind(failure_count)
    .bind(locked)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn delete(pool: &SqlitePool, key_hash: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM brute_force_lockout WHERE key_hash = ?1")
        .bind(key_hash)
        .execute(pool)
        .await?;
    Ok(())
}

/// Clears lockouts for every `key_hash` whose storage key starts with `{hashed_subject}|`.
pub async fn clear_by_subject_prefix(pool: &SqlitePool, hashed_subject: &str) -> Result<u64, AppError> {
    let prefix = format!("{hashed_subject}|");
    let res = sqlx::query("DELETE FROM brute_force_lockout WHERE key_hash LIKE ?1")
        .bind(format!("{prefix}%"))
        .execute(pool)
        .await?;
    Ok(res.rows_affected() as u64)
}

pub async fn load_active_lockouts(pool: &SqlitePool) -> Result<Vec<LockoutRow>, AppError> {
    let now = Utc::now().to_rfc3339();
    let rows: Vec<(String, i64, Option<String>)> = sqlx::query_as(
        "SELECT key_hash, failure_count, locked_until FROM brute_force_lockout
         WHERE locked_until IS NOT NULL AND locked_until > ?1",
    )
    .bind(now)
    .fetch_all(pool)
    .await?;
    Ok(rows
        .into_iter()
        .map(|(key_hash, failure_count, locked_until)| LockoutRow {
            key_hash,
            failure_count,
            locked_until: parse_dt(locked_until),
        })
        .collect())
}

fn parse_dt(raw: Option<String>) -> Option<DateTime<Utc>> {
    raw.and_then(|s| DateTime::parse_from_rfc3339(&s).ok())
        .map(|dt| dt.with_timezone(&Utc))
}
