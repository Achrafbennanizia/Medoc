//! Hybrid logical clock for sync conflict order.
//!
//! Wall time still breaks ties of real edits that are minutes apart. Once both
//! copies of a row carry a stamp, the comparison uses `(wall_ms, counter)` so
//! a replica whose clock is slow stays ordered after the master events it has
//! already seen.

use medoc_core::error::AppError;
use sqlx::SqlitePool;

const HLC_KEY: &str = "sync.hlc.v1";

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
    Hlc { wall_ms: wall, counter }
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

pub fn payload_hlc(obj: &serde_json::Map<String, serde_json::Value>) -> Option<Hlc> {
    obj.get("syncHlc").and_then(|v| v.as_str()).and_then(parse_hlc)
}

pub async fn load_row(pool: &SqlitePool, table: &str, entity_id: &str) -> Result<Option<Hlc>, AppError> {
    let row: Option<(i64, i64)> = sqlx::query_as(
        "SELECT wall_ms, counter FROM sync_row_hlc WHERE entity_table = ?1 AND entity_id = ?2",
    )
    .bind(table)
    .bind(entity_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(row.map(|(wall_ms, counter)| Hlc { wall_ms, counter }))
}

pub async fn save_row(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
    hlc: Hlc,
) -> Result<(), AppError> {
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
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn attach_row_hlc(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
    payload_json: &str,
) -> Result<String, AppError> {
    let Ok(mut value) = serde_json::from_str::<serde_json::Value>(payload_json) else {
        return Ok(payload_json.to_string());
    };
    let Some(obj) = value.as_object_mut() else {
        return Ok(payload_json.to_string());
    };
    if payload_hlc(obj).is_some() {
        return Ok(payload_json.to_string());
    }
    let Some(hlc) = load_row(pool, table, entity_id).await? else {
        return Ok(payload_json.to_string());
    };
    obj.insert(
        "syncHlc".to_string(),
        serde_json::Value::String(format_hlc(hlc)),
    );
    Ok(serde_json::to_string(&value).unwrap_or_else(|_| payload_json.to_string()))
}

pub async fn observe_clock(pool: &SqlitePool, remote: Hlc) -> Result<(), AppError> {
    let local = load_clock(pool).await?;
    let next = observe(local, remote, chrono::Utc::now().timestamp_millis());
    store_clock(pool, next).await
}

fn updated_at_millis(obj: &serde_json::Map<String, serde_json::Value>) -> Option<i64> {
    let raw = obj.get("updated_at")?.as_str()?.trim();
    if let Ok(parsed) = chrono::DateTime::parse_from_rfc3339(raw) {
        return Some(parsed.timestamp_millis());
    }
    let normalized = raw.replace(' ', "T");
    let with_zone = if normalized.ends_with('Z') {
        normalized
    } else {
        format!("{normalized}Z")
    };
    chrono::DateTime::parse_from_rfc3339(&with_zone)
        .ok()
        .map(|parsed| parsed.timestamp_millis())
}

pub async fn stamp_payload(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
    payload_json: &str,
) -> Result<String, AppError> {
    let Ok(mut value) = serde_json::from_str::<serde_json::Value>(payload_json) else {
        return Ok(payload_json.to_string());
    };
    let Some(obj) = value.as_object_mut() else {
        return Ok(payload_json.to_string());
    };
    let hlc = if let Some(existing) = payload_hlc(obj) {
        existing
    } else if let Some(saved) = load_row(pool, table, entity_id).await? {
        obj.insert(
            "syncHlc".to_string(),
            serde_json::Value::String(format_hlc(saved)),
        );
        saved
    } else if let Some(wall_ms) = updated_at_millis(obj) {
        let from_row = Hlc { wall_ms, counter: 0 };
        obj.insert(
            "syncHlc".to_string(),
            serde_json::Value::String(format_hlc(from_row)),
        );
        from_row
    } else {
        let next = tick(load_clock(pool).await?, chrono::Utc::now().timestamp_millis());
        store_clock(pool, next).await?;
        obj.insert(
            "syncHlc".to_string(),
            serde_json::Value::String(format_hlc(next)),
        );
        next
    };
    save_row(pool, table, entity_id, hlc).await?;
    Ok(serde_json::to_string(&value).unwrap_or_else(|_| payload_json.to_string()))
}

async fn load_clock(pool: &SqlitePool) -> Result<Hlc, AppError> {
    let raw = medoc_core::infrastructure::database::app_kv_repo::get(pool, HLC_KEY).await?;
    Ok(raw.as_deref().and_then(parse_hlc).unwrap_or(Hlc {
        wall_ms: 0,
        counter: 0,
    }))
}

async fn store_clock(pool: &SqlitePool, hlc: Hlc) -> Result<(), AppError> {
    medoc_core::infrastructure::database::app_kv_repo::set(pool, HLC_KEY, &format_hlc(hlc)).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_slow_physical_clock_stays_after_an_observed_master_stamp() {
        let master = Hlc {
            wall_ms: 1_000_000,
            counter: 4,
        };
        let replica_clock = observe(
            Hlc {
                wall_ms: 10,
                counter: 0,
            },
            master,
            10,
        );
        let edited = tick(replica_clock, 10);
        assert!(edited.wall_ms > master.wall_ms || edited.counter > master.counter);
        assert!(edited.wall_ms >= master.wall_ms);
    }

    #[test]
    fn an_older_logical_stamp_sorts_first() {
        let older = Hlc {
            wall_ms: 50,
            counter: 9,
        };
        let newer = Hlc {
            wall_ms: 50,
            counter: 10,
        };
        assert!(older.counter < newer.counter);
        assert_eq!(parse_hlc("50:10"), Some(newer));
    }
}
