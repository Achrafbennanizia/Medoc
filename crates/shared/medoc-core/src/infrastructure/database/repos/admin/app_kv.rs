//! Generic key/value store backed by SQLite.
//!
//! Replaces ad-hoc browser `localStorage` for practice-wide settings (work
//! schedule, special closures, dashboard preferences, …). Keeps DSGVO scope
//! tight: values are arbitrary JSON strings owned by the app, not patient
//! data — but they live in the same encrypted-at-rest store as the rest of
//! the medical record (NFA-SEC-08 backlog applies equally).
use crate::error::AppError;
use crate::infrastructure::database::sqlite_error::is_sqlite_busy;
use sqlx::SqlitePool;

async fn retry_locked<T, F, Fut>(mut op: F) -> Result<T, AppError>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<T, AppError>>,
{
    let mut last = None;
    for attempt in 0..4 {
        match op().await {
            Ok(value) => return Ok(value),
            Err(err) if is_sqlite_busy(&err) && attempt < 3 => {
                tokio::time::sleep(std::time::Duration::from_millis(150 * (attempt as u64 + 1)))
                    .await;
                last = Some(err);
            }
            Err(err) => return Err(err),
        }
    }
    Err(last.expect("retry loop records the last lock error"))
}

pub async fn get(pool: &SqlitePool, key: &str) -> Result<Option<String>, AppError> {
    let key = key.to_string();
    retry_locked(|| {
        let key = key.clone();
        let pool = pool.clone();
        async move {
            let row: Option<(String,)> = sqlx::query_as("SELECT value FROM app_kv WHERE key = ?1")
                .bind(key)
                .fetch_optional(&pool)
                .await?;
            Ok(row.map(|(version,)| version))
        }
    })
    .await
}

pub async fn set(pool: &SqlitePool, key: &str, value: &str) -> Result<(), AppError> {
    let key = key.to_string();
    let value = value.to_string();
    retry_locked(|| {
        let key = key.clone();
        let value = value.clone();
        let pool = pool.clone();
        async move {
            sqlx::query(
                "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
            )
            .bind(&key)
            .bind(&value)
            .execute(&pool)
            .await?;
            if !is_internal_sync_key(&key) {
                let updated_at: String =
                    sqlx::query_scalar("SELECT updated_at FROM app_kv WHERE key = ?1")
                        .bind(&key)
                        .fetch_optional(&pool)
                        .await?
                        .unwrap_or_default();
                let payload = serde_json::json!({
                    "key": key,
                    "value": value,
                    "updated_at": updated_at,
                })
                .to_string();
                // Upserts are mapped to UPDATE for the outbox to satisfy the
                // `op IN ('INSERT','UPDATE','DELETE')` CHECK on `sync_outbox`.
                crate::infrastructure::database::sync_outbox::record_or_noop(
                    &pool, "app_kv", &key, "UPDATE", &payload,
                )
                .await?;
            }
            Ok(())
        }
    })
    .await
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
    crate::infrastructure::database::sync_registry::deny_app_kv_key(key)
}

fn serde_json_string(s: &str) -> String {
    serde_json::to_string(s).unwrap_or_else(|_| "\"\"".into())
}
