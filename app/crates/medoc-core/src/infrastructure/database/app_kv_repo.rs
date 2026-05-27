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
    if !is_internal_sync_key(key) {
        let payload = format!(
            "{{\"key\":{},\"value\":{}}}",
            serde_json_string(key),
            serde_json_string(value)
        );
        // Upserts are mapped to UPDATE for the outbox to satisfy the
        // `op IN ('INSERT','UPDATE','DELETE')` CHECK on `sync_outbox`.
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool, "app_kv", key, "UPDATE", &payload,
        )
        .await?;
    }
    Ok(())
}

pub async fn delete(pool: &SqlitePool, key: &str) -> Result<(), AppError> {
    sqlx::query("DELETE FROM app_kv WHERE key = ?1")
        .bind(key)
        .execute(pool)
        .await?;
    if !is_internal_sync_key(key) {
        let payload = format!("{{\"key\":{}}}", serde_json_string(key));
        crate::infrastructure::database::sync_outbox::record_or_noop(
            pool, "app_kv", key, "DELETE", &payload,
        )
        .await?;
    }
    Ok(())
}

/// Keys that drive the sync engine itself must never be funnelled through the
/// outbox: replicating them between peers would clobber per-device identity
/// and create recursive writes (see [`sync_outbox::record_or_noop`]).
fn is_internal_sync_key(key: &str) -> bool {
    key.starts_with("sync.") || key.starts_with("license.") || key.starts_with("pairing.")
}

fn serde_json_string(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_else(|_| "\"\"".into())
}
