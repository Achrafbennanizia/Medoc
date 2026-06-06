use medoc_core::error::AppError;
use sqlx::SqlitePool;

use crate::repo::{mark_applied, was_applied, OutboxEntry};

/// Conflict resolution when two devices edited the same row offline.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictPolicy {
    /// Newer `updated_at` wins; ties are broken in favour of the master.
    ///
    /// When **either** side lacks a parsable `updated_at` timestamp the policy
    /// falls back to legacy master-wins semantics (replica keeps its local row
    /// if the master already owns one).
    MasterWinsWithFreshness,
}

pub async fn apply_remote_entry(
    pool: &SqlitePool,
    local_is_master: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
) -> Result<bool, AppError> {
    if was_applied(pool, &entry.device_id, entry.seq).await? {
        return Ok(false);
    }

    let applied = match entry.op.as_str() {
        "INSERT" | "UPDATE" => apply_upsert(pool, local_is_master, policy, entry).await?,
        "DELETE" => apply_delete(pool, entry).await?,
        _ => {
            return Err(AppError::Validation(format!(
                "unknown sync op: {}",
                entry.op
            )))
        }
    };

    if applied {
        mark_applied(pool, &entry.device_id, entry.seq).await?;
    }
    Ok(applied)
}

async fn apply_upsert(
    pool: &SqlitePool,
    local_is_master: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
) -> Result<bool, AppError> {
    let payload: serde_json::Value = serde_json::from_str(&entry.payload_json)
        .map_err(|e| AppError::Validation(format!("sync payload json: {e}")))?;
    let Some(obj) = payload.as_object() else {
        return Err(AppError::Validation(
            "sync payload must be a JSON object".into(),
        ));
    };

    let exists: i64 = if entry.entity_table == "app_kv" {
        sqlx::query_scalar("SELECT COUNT(*) FROM app_kv WHERE key = ?1")
            .bind(&entry.entity_id)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?
    } else {
        let table = sanitize_table(&entry.entity_table)?;
        sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table} WHERE id = ?1"))
            .bind(&entry.entity_id)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?
    };

    if exists > 0 && policy == ConflictPolicy::MasterWinsWithFreshness {
        let remote_ts = obj.get("updated_at").and_then(parse_ts);
        let local_ts = load_local_updated_at(pool, &entry.entity_table, &entry.entity_id).await?;
        match (local_ts, remote_ts) {
            (Some(local), Some(remote)) => {
                if remote > local {
                    // Remote is fresher → apply, regardless of role.
                } else if remote < local {
                    tracing::debug!(
                        target: "medoc::sync",
                        event = "SKIP_STALE_REMOTE",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        local = %local,
                        remote = %remote,
                    );
                    return Ok(true);
                } else if !local_is_master {
                    // Tie → master wins (we are a replica accepting master's tie-break).
                } else {
                    // Tie → master wins. We *are* the master, keep our local row.
                    tracing::debug!(
                        target: "medoc::sync",
                        event = "MASTER_KEEPS_TIE",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                    );
                    return Ok(true);
                }
            }
            _ => {
                // Fallback: legacy master-wins (replica keeps local when master already owns).
                if !local_is_master {
                    tracing::debug!(
                        target: "medoc::sync",
                        event = "SKIP_REPLICA_COLLISION",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                    );
                    return Ok(true);
                }
            }
        }
    }

    if entry.entity_table == "app_kv" {
        apply_app_kv(pool, &entry.entity_id, obj).await?;
    } else if exists == 0 {
        insert_from_json(pool, &entry.entity_table, &entry.entity_id, obj).await?;
    } else {
        update_from_json(pool, &entry.entity_table, &entry.entity_id, obj).await?;
    }
    Ok(true)
}

/// Reads `updated_at` from the existing local row, if any. Returns `None`
/// for app_kv (no timestamp tracked per row at field level), missing rows,
/// or any parse error: the caller falls back to legacy master-wins.
async fn load_local_updated_at(
    pool: &SqlitePool,
    table: &str,
    id: &str,
) -> Result<Option<chrono::DateTime<chrono::FixedOffset>>, AppError> {
    if table == "app_kv" {
        let raw: Option<String> =
            sqlx::query_scalar("SELECT updated_at FROM app_kv WHERE key = ?1")
                .bind(id)
                .fetch_optional(pool)
                .await
                .map_err(AppError::Database)?;
        return Ok(raw.and_then(|s| parse_ts_str(&s)));
    }
    if table == "in_app_notification" {
        let raw: Option<String> = sqlx::query_scalar(
            "SELECT CAST(created_at AS TEXT) FROM in_app_notification WHERE id = ?1",
        )
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
        return Ok(raw.and_then(|s| parse_ts_str(&s)));
    }
    let safe = sanitize_table(table)?;
    let raw: Option<String> = sqlx::query_scalar(&format!(
        "SELECT CAST(updated_at AS TEXT) FROM {safe} WHERE id = ?1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(raw.and_then(|s| parse_ts_str(&s)))
}

fn parse_ts(v: &serde_json::Value) -> Option<chrono::DateTime<chrono::FixedOffset>> {
    v.as_str().and_then(parse_ts_str)
}

/// Accepts RFC 3339 (preferred) and SQLite's `YYYY-MM-DD HH:MM:SS[.fff]`
/// default form, treating naive timestamps as UTC.
fn parse_ts_str(s: &str) -> Option<chrono::DateTime<chrono::FixedOffset>> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(trimmed) {
        return Some(ts);
    }
    let normalised = trimmed.replacen(' ', "T", 1);
    if let Ok(ts) = chrono::DateTime::parse_from_rfc3339(&format!("{normalised}Z")) {
        return Some(ts);
    }
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S") {
        let utc: chrono::DateTime<chrono::Utc> =
            chrono::TimeZone::from_utc_datetime(&chrono::Utc, &naive);
        return Some(utc.fixed_offset());
    }
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S%.f") {
        let utc: chrono::DateTime<chrono::Utc> =
            chrono::TimeZone::from_utc_datetime(&chrono::Utc, &naive);
        return Some(utc.fixed_offset());
    }
    None
}

async fn apply_app_kv(
    pool: &SqlitePool,
    key: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), AppError> {
    let value = obj
        .get("value")
        .map(json_to_sql_literal)
        .transpose()?
        .unwrap_or_default();
    let row_key = obj.get("key").and_then(|v| v.as_str()).unwrap_or(key);
    sqlx::query("INSERT OR REPLACE INTO app_kv (key, value) VALUES (?1, ?2)")
        .bind(row_key)
        .bind(value)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

async fn apply_delete(pool: &SqlitePool, entry: &OutboxEntry) -> Result<bool, AppError> {
    let table = sanitize_table(&entry.entity_table)?;
    if table == "app_kv" {
        sqlx::query("DELETE FROM app_kv WHERE key = ?1")
            .bind(&entry.entity_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        return Ok(true);
    }
    sqlx::query(&format!("DELETE FROM {table} WHERE id = ?1"))
        .bind(&entry.entity_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(true)
}

async fn insert_from_json(
    pool: &SqlitePool,
    table: &str,
    id: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), AppError> {
    let table = sanitize_table(table)?;
    let mut cols = vec!["id".to_string()];
    let mut binds: Vec<String> = vec![id.to_string()];
    for (k, v) in obj {
        if k == "id" {
            continue;
        }
        cols.push(k.clone());
        binds.push(json_to_sql_literal(v)?);
    }
    let placeholders: Vec<String> = (1..=binds.len()).map(|i| format!("?{i}")).collect();
    let sql = format!(
        "INSERT OR REPLACE INTO {table} ({}) VALUES ({})",
        cols.join(", "),
        placeholders.join(", ")
    );
    let mut q = sqlx::query(&sql);
    for b in binds {
        q = q.bind(b);
    }
    q.execute(pool).await.map_err(AppError::Database)?;
    Ok(())
}

async fn update_from_json(
    pool: &SqlitePool,
    table: &str,
    id: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), AppError> {
    let table = sanitize_table(table)?;
    let mut sets = Vec::new();
    let mut binds = Vec::new();
    let mut idx = 1;
    for (k, v) in obj {
        if k == "id" {
            continue;
        }
        sets.push(format!("{k} = ?{idx}"));
        binds.push(json_to_sql_literal(v)?);
        idx += 1;
    }
    if sets.is_empty() {
        return Ok(());
    }
    let sql = format!("UPDATE {table} SET {} WHERE id = ?{idx}", sets.join(", "));
    let mut q = sqlx::query(&sql);
    for b in binds {
        q = q.bind(b);
    }
    q = q.bind(id);
    q.execute(pool).await.map_err(AppError::Database)?;
    Ok(())
}

fn sanitize_table(table: &str) -> Result<&str, AppError> {
    const ALLOWED: &[&str] = &[
        "patient",
        "patientenakte",
        "termin",
        "behandlung",
        "untersuchung",
        "zahlung",
        "app_kv",
        "praxis_aufgabe",
        "anamnesebogen",
        "zahnbefund",
        "rezept",
        "attest",
        "leistung",
        "in_app_notification",
        "praxis_ticket",
    ];
    if ALLOWED.contains(&table) {
        Ok(table)
    } else {
        Err(AppError::Validation(format!(
            "sync entity_table not allow-listed: {table}"
        )))
    }
}

fn json_to_sql_literal(v: &serde_json::Value) -> Result<String, AppError> {
    match v {
        serde_json::Value::Null => Ok(String::new()),
        serde_json::Value::Bool(b) => Ok(if *b { "1".into() } else { "0".into() }),
        serde_json::Value::Number(n) => Ok(n.to_string()),
        serde_json::Value::String(s) => Ok(s.clone()),
        other => Ok(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_table;

    #[test]
    fn allow_list_rejects_unknown_tables() {
        assert!(sanitize_table("personal").is_err());
        assert!(sanitize_table("patient").is_ok());
    }

    #[test]
    fn tier1_tables_are_allow_listed() {
        for table in [
            "anamnesebogen",
            "zahnbefund",
            "rezept",
            "attest",
            "leistung",
            "in_app_notification",
            "praxis_ticket",
        ] {
            assert!(sanitize_table(table).is_ok(), "{table}");
        }
    }
}
