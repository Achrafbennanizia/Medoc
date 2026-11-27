//! Hybrid logical clock stored with each replicated write.
//!
//! The clock lives in `app_kv` under `sync.hlc.v1`. Each row's stamp lives in
//! `sync_row_hlc`. A slow wall clock still moves forward after it has seen a
//! later stamp.

use sqlx::{Sqlite, Transaction};

use crate::error::AppError;
use crate::infrastructure::database::sync_registry::APP_KV_HLC_KEY;

const ROW_TABLE_SQL: &str = "CREATE TABLE IF NOT EXISTS sync_row_hlc (
            entity_table TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            wall_ms INTEGER NOT NULL,
            counter INTEGER NOT NULL,
            PRIMARY KEY (entity_table, entity_id)
        )";

pub async fn ensure_sync_row_hlc<'e, E>(executor: E) -> Result<(), AppError>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query(ROW_TABLE_SQL)
        .execute(executor)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Hlc {
    pub wall_ms: i64,
    pub counter: i64,
}

pub fn tick(prev: Hlc, physical_ms: i64) -> Hlc {
    if physical_ms > prev.wall_ms {
        Hlc {
            wall_ms: physical_ms,
            counter: 0,
        }
    } else {
        Hlc {
            wall_ms: prev.wall_ms,
            counter: prev.counter.saturating_add(1),
        }
    }
}

pub fn observe(local: Hlc, remote: Hlc, physical_ms: i64) -> Hlc {
    let wall = local.wall_ms.max(remote.wall_ms).max(physical_ms);
    let counter = if wall == local.wall_ms && wall == remote.wall_ms {
        local.counter.max(remote.counter).saturating_add(1)
    } else if wall == local.wall_ms {
        local.counter.saturating_add(1)
    } else if wall == remote.wall_ms {
        remote.counter.saturating_add(1)
    } else {
        0
    };
    Hlc {
        wall_ms: wall,
        counter,
    }
}

pub fn format_hlc(hlc: Hlc) -> String {
    format!("{}:{}", hlc.wall_ms, hlc.counter)
}

pub fn parse_hlc(raw: &str) -> Option<Hlc> {
    let (wall, counter) = raw.trim().split_once(':')?;
    Some(Hlc {
        wall_ms: wall.parse().ok()?,
        counter: counter.parse().ok()?,
    })
}

/// Stamp a live write. Uses the stored logical clock, not the row's `updated_at`,
/// so a slow device stays ordered after events it has already seen.
pub async fn stamp_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    entity_id: &str,
    payload_json: &str,
) -> Result<String, AppError> {
    ensure_sync_row_hlc(&mut **tx).await?;
    crate::infrastructure::database::field_hlc::ensure(&mut **tx).await?;

    let Ok(mut value) = serde_json::from_str::<serde_json::Value>(payload_json) else {
        return Ok(payload_json.to_string());
    };
    let Some(obj) = value.as_object_mut() else {
        return Ok(payload_json.to_string());
    };
    let hlc = if let Some(existing) = obj
        .get("syncHlc")
        .and_then(|v| v.as_str())
        .and_then(parse_hlc)
    {
        existing
    } else {
        let prev = load_clock(tx).await?;
        let next = tick(prev, chrono::Utc::now().timestamp_millis());
        store_clock(tx, next).await?;
        obj.insert(
            "syncHlc".to_string(),
            serde_json::Value::String(format_hlc(next)),
        );
        next
    };
    crate::infrastructure::database::field_hlc::stamp(tx, table, entity_id, obj, hlc).await?;
    sqlx::query(
        "INSERT INTO sync_row_hlc (entity_table, entity_id, wall_ms, counter)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(entity_table, entity_id) DO UPDATE SET
            wall_ms = excluded.wall_ms,
            counter = excluded.counter",
    )
    .bind(table)
    .bind(entity_id)
    .bind(hlc.wall_ms)
    .bind(hlc.counter)
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    Ok(serde_json::to_string(&value).unwrap_or_else(|_| payload_json.to_string()))
}

async fn load_clock(tx: &mut Transaction<'_, Sqlite>) -> Result<Hlc, AppError> {
    let raw: Option<String> = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = ?1")
        .bind(APP_KV_HLC_KEY)
        .fetch_optional(&mut **tx)
        .await
        .map_err(AppError::Database)?;
    Ok(raw.as_deref().and_then(parse_hlc).unwrap_or(Hlc {
        wall_ms: 0,
        counter: 0,
    }))
}

async fn store_clock(tx: &mut Transaction<'_, Sqlite>, hlc: Hlc) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(APP_KV_HLC_KEY)
    .bind(format_hlc(hlc))
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}
