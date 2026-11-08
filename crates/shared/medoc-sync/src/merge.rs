use medoc_core::error::AppError;
use medoc_core::infrastructure::database::patient_repo;
use sqlx::SqlitePool;

use crate::repo::{mark_applied, was_applied, OutboxEntry};

/// Conflict resolution when two devices edited the same row offline.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictPolicy {
    /// Newer `updated_at` wins. Equal timestamps: the main device wins.
    /// Between two replicas (mesh) an equal timestamp keeps the local row.
    ///
    /// Missing remote `updated_at`: accept only on admin pull (sender is main).
    /// Missing local `updated_at` with a remote timestamp: apply remote.
    LastWriteWins,
}

pub async fn apply_remote_entry(
    pool: &SqlitePool,
    local_device_id: &str,
    local_is_master: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
) -> Result<bool, AppError> {
    apply_remote_entry_phased(pool, local_device_id, local_is_master, false, policy, entry).await
}

/// Same as [`apply_remote_entry_phased`], but does not write `sync_applied`.
/// The caller marks the row in the same transaction as the master relay.
pub async fn apply_remote_entry_defer_mark(
    pool: &SqlitePool,
    local_device_id: &str,
    local_is_master: bool,
    admin_pull: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
) -> Result<bool, AppError> {
    apply_remote_entry_inner(
        pool,
        local_device_id,
        local_is_master,
        admin_pull,
        policy,
        entry,
        false,
    )
    .await
}

/// `admin_pull`: replica applying master rows after push-then-pull — admin
/// authoritative when timestamps are missing (product: merge member, then admin).
pub async fn apply_remote_entry_phased(
    pool: &SqlitePool,
    local_device_id: &str,
    local_is_master: bool,
    admin_pull: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
) -> Result<bool, AppError> {
    apply_remote_entry_inner(
        pool,
        local_device_id,
        local_is_master,
        admin_pull,
        policy,
        entry,
        true,
    )
    .await
}

async fn apply_remote_entry_inner(
    pool: &SqlitePool,
    local_device_id: &str,
    local_is_master: bool,
    admin_pull: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
    mark: bool,
) -> Result<bool, AppError> {
    if was_applied(pool, &entry.device_id, entry.seq).await? {
        return Ok(false);
    }

    let applied = match entry.op.as_str() {
        "INSERT" | "UPDATE" => {
            apply_upsert(
                pool,
                local_device_id,
                local_is_master,
                admin_pull,
                policy,
                entry,
                false,
            )
            .await?
        }
        "DELETE" => apply_delete(pool, entry).await?,
        _ => {
            return Err(AppError::Validation(format!(
                "unknown sync op: {}",
                entry.op
            )))
        }
    };

    if applied && mark {
        mark_applied(pool, &entry.device_id, entry.seq).await?;
        if let Err(e) =
            crate::watch::note_remote_applied(pool, &entry.entity_table, &entry.entity_id).await
        {
            tracing::warn!(
                target: "medoc::sync",
                event = "SHARED_SYNC_SEEN_FAILED",
                table = %entry.entity_table,
                id = %entry.entity_id,
                error = %e
            );
        }
    }
    Ok(applied)
}

/// Apply a reconcile row from the main device, ignoring last-write-wins.
pub async fn force_apply_payload(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
    op: &str,
    payload_json: &str,
) -> Result<(), AppError> {
    let entry = OutboxEntry {
        id: format!("reconcile-{entity_id}"),
        device_id: "reconcile".into(),
        seq: 0,
        entity_table: table.to_string(),
        entity_id: entity_id.to_string(),
        op: op.to_string(),
        payload_json: payload_json.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };
    match op {
        "DELETE" => {
            apply_delete(pool, &entry).await?;
        }
        _ => {
            apply_upsert(
                pool,
                "reconcile",
                false,
                true,
                ConflictPolicy::LastWriteWins,
                &entry,
                true,
            )
            .await?;
        }
    }
    Ok(())
}

async fn apply_upsert(
    pool: &SqlitePool,
    local_device_id: &str,
    local_is_master: bool,
    admin_pull: bool,
    policy: ConflictPolicy,
    entry: &OutboxEntry,
    force: bool,
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
        // F146: tables keyed by something other than `id` (hint, preference).
        let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
        sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table} WHERE {key} = ?1"))
            .bind(&entry.entity_id)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?
    };

    if !force && exists > 0 && policy == ConflictPolicy::LastWriteWins {
        let remote_ts = obj.get("updated_at").and_then(parse_ts);
        let local_ts = load_local_updated_at(pool, &entry.entity_table, &entry.entity_id).await?;
        match (local_ts, remote_ts) {
            (Some(local), Some(remote)) => {
                if remote > local {
                    // Remote is fresher → apply.
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
                } else if !admin_pull {
                    tracing::debug!(
                        target: "medoc::sync",
                        event = "SKIP_TIE_MAIN_OR_LOCAL",
                        table = %entry.entity_table,
                        id = %entry.entity_id,
                        remote_device = %entry.device_id,
                        local_device = %local_device_id,
                        local_is_master,
                    );
                    return Ok(true);
                }
            }
            (None, Some(_)) => {}
            (_, None) => {
                if !admin_pull {
                    tracing::debug!(
                        target: "medoc::sync",
                        event = "SKIP_MISSING_REMOTE_UPDATED_AT",
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
    let safe = sanitize_table(table)?;
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(safe);
    let raw: Option<String> = sqlx::query_scalar(&format!(
        "SELECT CAST(updated_at AS TEXT) FROM {safe} WHERE {key} = ?1"
    ))
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(raw.and_then(|s| parse_ts_str(&s)))
}

fn parse_ts(version: &serde_json::Value) -> Option<chrono::DateTime<chrono::FixedOffset>> {
    version.as_str().and_then(parse_ts_str)
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
    // chrono's `NaiveDateTime` JSON is `YYYY-MM-DDTHH:MM:SS[.fff]` with no offset.
    let with_space = trimmed.replacen('T', " ", 1);
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(trimmed, "%Y-%m-%d %H:%M:%S") {
        let utc: chrono::DateTime<chrono::Utc> =
            chrono::TimeZone::from_utc_datetime(&chrono::Utc, &naive);
        return Some(utc.fixed_offset());
    }
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(&with_space, "%Y-%m-%d %H:%M:%S%.f") {
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
        .and_then(json_to_sql_value)
        .unwrap_or_default();
    let row_key = obj
        .get("key")
        .and_then(|version| version.as_str())
        .unwrap_or(key);
    let updated_at = obj
        .get("updated_at")
        .and_then(|version| version.as_str())
        .filter(|s| !s.trim().is_empty());
    if let Some(ts) = updated_at {
        sqlx::query(
            "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        )
        .bind(row_key)
        .bind(value)
        .bind(ts)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    } else {
        sqlx::query(
            "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        )
        .bind(row_key)
        .bind(value)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }
    Ok(())
}

async fn apply_delete(pool: &SqlitePool, entry: &OutboxEntry) -> Result<bool, AppError> {
    let table = sanitize_table(&entry.entity_table)?;
    let deleted_at = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    sqlx::query(
        "INSERT INTO sync_tombstone (entity_table, entity_id, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(entity_table, entity_id) DO UPDATE SET
            deleted_at = excluded.deleted_at,
            device_id = excluded.device_id",
    )
    .bind(table)
    .bind(&entry.entity_id)
    .bind(deleted_at)
    .bind(&entry.device_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    if table == "app_kv" {
        sqlx::query("DELETE FROM app_kv WHERE key = ?1")
            .bind(&entry.entity_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        return Ok(true);
    }
    if table == "patient" {
        patient_repo::delete_row(pool, &entry.entity_id).await?;
        return Ok(true);
    }
    if table == "patient_chart" {
        for sql in [
            "DELETE FROM treatment WHERE chart_id = ?1",
            "DELETE FROM examination WHERE chart_id = ?1",
            "DELETE FROM dental_finding WHERE chart_id = ?1",
            "DELETE FROM chart_attachment WHERE chart_id = ?1",
        ] {
            sqlx::query(sql)
                .bind(&entry.entity_id)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
        }
        sqlx::query("DELETE FROM patient_chart WHERE id = ?1")
            .bind(&entry.entity_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        return Ok(true);
    }
    if table == "service_item" {
        sqlx::query("UPDATE payment SET service_item_id = NULL WHERE service_item_id = ?1")
            .bind(&entry.entity_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        sqlx::query("DELETE FROM service_item WHERE id = ?1")
            .bind(&entry.entity_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        return Ok(true);
    }
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
    sqlx::query(&format!("DELETE FROM {table} WHERE {key} = ?1"))
        .bind(&entry.entity_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(true)
}

async fn table_column_names(pool: &SqlitePool, table: &str) -> Result<Vec<String>, AppError> {
    sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)
}

fn keep_known_column(known: &[String], name: &str) -> bool {
    known.iter().any(|c| c == name)
}

async fn insert_from_json(
    pool: &SqlitePool,
    table: &str,
    id: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), AppError> {
    let table = sanitize_table(table)?;
    if table == "staff" {
        return apply_staff_without_secrets(pool, id, obj).await;
    }
    let known = table_column_names(pool, table).await?;
    // F146/F147: the key column is not always `id` (hint, preference) and
    // `chart_validation` has a composite key carried in the payload itself.
    let id_col = medoc_core::infrastructure::database::sync_registry::id_column(table);
    let (mut cols, mut binds): (Vec<String>, Vec<Option<String>>) =
        if medoc_core::infrastructure::database::sync_registry::key_is_column(table) {
            (vec![id_col.to_string()], vec![Some(id.to_string())])
        } else {
            (Vec::new(), Vec::new())
        };
    for (k, version) in obj {
        if (k == "id" && known.iter().any(|c| c == "id") && id_col == "id")
            || k == id_col
            || !keep_known_column(&known, k)
            || crate::repo::snapshot_denied_column(table, k)
        {
            continue;
        }
        cols.push(k.clone());
        binds.push(json_to_sql_value(version));
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

/// A staff snapshot never carries `password_hash` or `totp_secret`. A new row
/// gets a hash that cannot log in. An existing row is updated by the normal
/// path, which also ignores those columns.
async fn apply_staff_without_secrets(
    pool: &SqlitePool,
    id: &str,
    obj: &serde_json::Map<String, serde_json::Value>,
) -> Result<(), AppError> {
    let known = table_column_names(pool, "staff").await?;
    let mut cols = vec!["id".to_string(), "password_hash".to_string()];
    let mut binds: Vec<Option<String>> = vec![Some(id.to_string()), Some("!".to_string())];
    for (k, version) in obj {
        if k == "id"
            || k == "password_hash"
            || crate::repo::snapshot_denied_column("staff", k)
            || !keep_known_column(&known, k)
        {
            continue;
        }
        cols.push(k.clone());
        binds.push(json_to_sql_value(version));
    }
    let placeholders: Vec<String> = (1..=binds.len()).map(|i| format!("?{i}")).collect();
    let sql = format!(
        "INSERT INTO staff ({}) VALUES ({})",
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
    let id_col = medoc_core::infrastructure::database::sync_registry::id_column(table);
    let known = table_column_names(pool, table).await?;
    let mut sets = Vec::new();
    let mut binds: Vec<Option<String>> = Vec::new();
    let mut idx = 1;
    for (k, version) in obj {
        if k == "id"
            || k == id_col
            || !keep_known_column(&known, k)
            || crate::repo::snapshot_denied_column(table, k)
        {
            continue;
        }
        sets.push(format!("{k} = ?{idx}"));
        binds.push(json_to_sql_value(version));
        idx += 1;
    }
    if sets.is_empty() {
        return Ok(());
    }
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
    let sql = format!("UPDATE {table} SET {} WHERE {key} = ?{idx}", sets.join(", "));
    let mut q = sqlx::query(&sql);
    for b in binds {
        q = q.bind(b);
    }
    q = q.bind(id);
    q.execute(pool).await.map_err(AppError::Database)?;
    Ok(())
}

fn sanitize_table(table: &str) -> Result<&str, AppError> {
    if crate::repo::is_synced_table(table) {
        Ok(table)
    } else {
        Err(AppError::Validation(format!(
            "sync entity_table not allow-listed: {table}"
        )))
    }
}

/// `None` binds as SQL NULL. An empty string is a real value and must not
/// stand in for JSON null: foreign keys reject `''`, and `IS NULL` filters
/// (unread notifications) stop matching.
fn json_to_sql_value(version: &serde_json::Value) -> Option<String> {
    match version {
        serde_json::Value::Null => None,
        serde_json::Value::Bool(b) => Some(if *b { "1" } else { "0" }.into()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::String(s) => Some(s.clone()),
        other => Some(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::sanitize_table;

    #[test]
    fn allow_list_rejects_unknown_tables() {
        assert!(sanitize_table("staff").is_err());
        assert!(sanitize_table("license").is_err());
        assert!(sanitize_table("patient").is_ok());
        assert!(sanitize_table("absence").is_ok());
    }

    #[test]
    fn tier1_tables_are_allow_listed() {
        for table in [
            "anamnesis_form",
            "dental_finding",
            "prescription",
            "certificate",
            "service_item",
            "in_app_notification",
            "practice_ticket",
        ] {
            assert!(sanitize_table(table).is_ok(), "{table}");
        }
    }

    #[test]
    fn parse_ts_str_handles_rfc3339_and_sqlite_naive() {
        use super::parse_ts_str;
        assert!(parse_ts_str("2099-01-01T00:00:00Z").is_some());
        assert!(parse_ts_str("2099-01-01 00:00:00").is_some());
        assert!(parse_ts_str("2099-01-01 00:00:00.123").is_some());
        assert!(parse_ts_str("").is_none());
        assert!(parse_ts_str("   ").is_none());
        assert!(parse_ts_str("not-a-date").is_none());
    }
}
