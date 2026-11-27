//! Per-field clocks for the tables that merge field by field (T3.2, editions plan §5).
//!
//! Row-level last-writer-wins drops a whole offline edit when another device edited a
//! different field of the same row. For [`FIELD_LWW_TABLES`] each field carries its own
//! stamp: a local write bumps only the fields whose value changed, the change carries the
//! map as `syncFieldHlc`, and the receiver decides every field on its own (newer stamp wins).
//!
//! `sync_field_hlc` keeps, per field, the stamp and a fingerprint of the value it was
//! stamped with, so an unchanged field keeps its older stamp on the next write.

use std::collections::HashMap;

use sha2::{Digest, Sha256};
use sqlx::SqliteConnection;

use crate::error::AppError;
use crate::infrastructure::database::hlc::{format_hlc, parse_hlc, Hlc};

/// Tables merged field by field. Every other synced table keeps row-level LWW.
pub const FIELD_LWW_TABLES: &[&str] = &["patient", "appointment", "practice_task"];

/// Payload key holding `{ field: "wall:counter" }`.
pub const PAYLOAD_KEY: &str = "syncFieldHlc";

/// Payload key holding, for each field this write changed, the stamp the field had before
/// (`"0:0"` when it had none). The main device uses it to tell a concurrent edit (the
/// writer had not seen the main device's latest value) from an ordinary later edit (T3.3).
pub const BASE_KEY: &str = "syncFieldBase";

/// Fields that change on every write; never reported as a conflict.
pub fn is_bookkeeping_field(key: &str) -> bool {
    matches!(
        key,
        "updated_at" | "updated_by" | "created_at" | "created_by" | "device_id"
    )
}

pub fn is_field_lww(table: &str) -> bool {
    FIELD_LWW_TABLES.contains(&table)
}

const TABLE_SQL: &str = "CREATE TABLE IF NOT EXISTS sync_field_hlc (
            entity_table TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            field TEXT NOT NULL,
            wall_ms INTEGER NOT NULL,
            counter INTEGER NOT NULL,
            value_hash TEXT NOT NULL,
            PRIMARY KEY (entity_table, entity_id, field)
        )";

pub async fn ensure<'e, E: sqlx::Executor<'e, Database = sqlx::Sqlite>>(
    executor: E,
) -> Result<(), AppError> {
    sqlx::query(TABLE_SQL)
        .execute(executor)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

/// Payload keys that are not row columns, or not merged (the key).
pub fn is_merged_field(key: &str) -> bool {
    !matches!(key, "id" | "syncHlc" | PAYLOAD_KEY | BASE_KEY)
}

/// Fingerprint of a field value (only compared on this device).
pub fn value_hash(value: &serde_json::Value) -> String {
    let digest = Sha256::digest(value.to_string().as_bytes());
    digest[..12].iter().map(|b| format!("{b:02x}")).collect()
}

/// The field stamps a payload carries.
pub fn payload_fields(obj: &serde_json::Map<String, serde_json::Value>) -> HashMap<String, Hlc> {
    stamp_map(obj, PAYLOAD_KEY)
}

/// For each field the write changed, the stamp it replaced.
pub fn payload_bases(obj: &serde_json::Map<String, serde_json::Value>) -> HashMap<String, Hlc> {
    stamp_map(obj, BASE_KEY)
}

fn stamp_map(obj: &serde_json::Map<String, serde_json::Value>, key: &str) -> HashMap<String, Hlc> {
    obj.get(key)
        .and_then(|v| v.as_object())
        .map(|m| {
            m.iter()
                .filter_map(|(k, v)| Some((k.clone(), parse_hlc(v.as_str()?)?)))
                .collect()
        })
        .unwrap_or_default()
}

/// Stored stamp and value fingerprint of each field of one row.
pub async fn load<'e, E: sqlx::Executor<'e, Database = sqlx::Sqlite>>(
    conn: E,
    table: &str,
    id: &str,
) -> Result<HashMap<String, (Hlc, String)>, AppError> {
    let rows: Vec<(String, i64, i64, String)> = sqlx::query_as(
        "SELECT field, wall_ms, counter, value_hash FROM sync_field_hlc
         WHERE entity_table = ?1 AND entity_id = ?2",
    )
    .bind(table)
    .bind(id)
    .fetch_all(conn)
    .await
    .map_err(AppError::Database)?;
    Ok(rows
        .into_iter()
        .map(|(f, wall_ms, counter, hash)| (f, (Hlc { wall_ms, counter }, hash)))
        .collect())
}

pub async fn save<'e, E: sqlx::Executor<'e, Database = sqlx::Sqlite>>(
    conn: E,
    table: &str,
    id: &str,
    field: &str,
    hlc: Hlc,
    hash: &str,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO sync_field_hlc (entity_table, entity_id, field, wall_ms, counter, value_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(entity_table, entity_id, field) DO UPDATE SET
            wall_ms = excluded.wall_ms, counter = excluded.counter, value_hash = excluded.value_hash",
    )
    .bind(table)
    .bind(id)
    .bind(field)
    .bind(hlc.wall_ms)
    .bind(hlc.counter)
    .bind(hash)
    .execute(conn)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Local write: fields whose value changed since their last stamp get `row_hlc`; the others
/// keep their stamp. Adds the map to the payload. A payload that already carries one (a relay)
/// is left as it is.
pub async fn stamp(
    conn: &mut SqliteConnection,
    table: &str,
    id: &str,
    obj: &mut serde_json::Map<String, serde_json::Value>,
    row_hlc: Hlc,
) -> Result<(), AppError> {
    if !is_field_lww(table) || obj.contains_key(PAYLOAD_KEY) {
        return Ok(());
    }
    let stored = load(&mut *conn, table, id).await?;
    let mut map = serde_json::Map::new();
    let mut bases = serde_json::Map::new();
    for (field, value) in obj.iter() {
        if !is_merged_field(field) {
            continue;
        }
        let hash = value_hash(value);
        let hlc = match stored.get(field) {
            Some((hlc, old)) if *old == hash => *hlc,
            prev => {
                let base = prev.map(|(h, _)| *h).unwrap_or(Hlc {
                    wall_ms: 0,
                    counter: 0,
                });
                bases.insert(field.clone(), serde_json::Value::String(format_hlc(base)));
                save(&mut *conn, table, id, field, row_hlc, &hash).await?;
                row_hlc
            }
        };
        map.insert(field.clone(), serde_json::Value::String(format_hlc(hlc)));
    }
    obj.insert(PAYLOAD_KEY.to_string(), serde_json::Value::Object(map));
    obj.insert(BASE_KEY.to_string(), serde_json::Value::Object(bases));
    Ok(())
}

/// Caps every field stamp at `cap` (the main device's one-time rewrite of a future stamp).
pub fn clamp(obj: &mut serde_json::Map<String, serde_json::Value>, cap: Hlc) {
    let Some(map) = obj.get_mut(PAYLOAD_KEY).and_then(|v| v.as_object_mut()) else {
        return;
    };
    for v in map.values_mut() {
        if let Some(h) = v.as_str().and_then(parse_hlc) {
            if (h.wall_ms, h.counter) > (cap.wall_ms, cap.counter) {
                *v = serde_json::Value::String(format_hlc(cap));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_caps_only_future_field_stamps() {
        let mut obj = serde_json::json!({
            "syncFieldHlc": { "a": "100:0", "b": "500:3" }
        })
        .as_object()
        .cloned()
        .unwrap();
        clamp(
            &mut obj,
            Hlc {
                wall_ms: 200,
                counter: 1,
            },
        );
        let f = payload_fields(&obj);
        assert_eq!(f["a"].wall_ms, 100);
        assert_eq!((f["b"].wall_ms, f["b"].counter), (200, 1));
    }

    #[test]
    fn value_hash_tells_values_apart() {
        assert_eq!(
            value_hash(&serde_json::json!("x")),
            value_hash(&serde_json::json!("x"))
        );
        assert_ne!(
            value_hash(&serde_json::json!("x")),
            value_hash(&serde_json::json!(null))
        );
    }
}
