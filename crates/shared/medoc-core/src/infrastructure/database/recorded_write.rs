//! Outbox + audit writes that share the caller's transaction.

use chrono::Utc;
use sqlx::{Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::error::AppError;
use crate::infrastructure::database::sync_registry::{
    deny_app_kv_key, deny_column, is_synced_table, APP_KV_DEPLOYMENT_KEY, APP_KV_DEVICE_ID_KEY,
};

/// Devices that receive replicated writes. A database error is the caller's to handle.
pub async fn count_remote_replicas<'e, E>(executor: E) -> Result<i64, sqlx::Error>
where
    E: sqlx::Executor<'e, Database = Sqlite>,
{
    sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_device
         WHERE is_local = 0
           AND (role = 'REPLICA' OR seat_role = 'MEMBER')",
    )
    .fetch_one(executor)
    .await
}

/// RFC 3339 millis strictly after `current` (and after now). Same-millisecond
/// INSERT then UPDATE otherwise ties under D8 and the master keeps the INSERT.
pub fn next_updated_at(current: Option<&str>) -> String {
    let now = Utc::now() + chrono::Duration::milliseconds(1);
    let ts = current
        .and_then(|s| chrono::DateTime::parse_from_rfc3339(s.trim()).ok())
        .map(|p| p.with_timezone(&Utc))
        .filter(|p| *p >= now)
        .map(|p| p + chrono::Duration::milliseconds(1))
        .unwrap_or(now);
    ts.to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

/// SQL `json_object` pairs for a snapshot or live row, skipping deny-list columns.
pub fn json_object_sql(table: &str, cols: &[String]) -> String {
    let pairs: Vec<String> = cols
        .iter()
        .filter(|column| !deny_column(table, column))
        .map(|column| format!("'{column}', \"{column}\""))
        .collect();
    format!("json_object({})", pairs.join(", "))
}

/// Full current row as JSON, built in SQL so every column is included.
pub async fn row_json(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    id: &str,
) -> Result<Option<String>, AppError> {
    if !is_synced_table(table) {
        return Ok(None);
    }
    let cols: Vec<String> =
        sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
            .fetch_all(&mut **tx)
            .await
            .map_err(AppError::Database)?;
    if cols.is_empty() {
        return Ok(None);
    }
    let key = crate::infrastructure::database::sync_registry::key_expr(table);
    let expr = json_object_sql(table, &cols);
    let sql = format!("SELECT {expr} FROM \"{table}\" WHERE {key} = ?1");
    let row: Option<String> = sqlx::query_scalar(&sql)
        .bind(id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(AppError::Database)?;
    Ok(row)
}

/// Write one outbox entry inside the caller's transaction.
pub async fn record_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    id: &str,
    op: &str,
) -> Result<(), AppError> {
    if !is_synced_table(table) {
        return Ok(());
    }
    if table == "app_kv" && deny_app_kv_key(id) {
        return Ok(());
    }
    if !replication_active_tx(tx).await? {
        return Ok(());
    }
    let payload = match op {
        "DELETE" => {
            upsert_tombstone(tx, table, id).await?;
            serde_json::json!({ "id": id }).to_string()
        }
        _ => row_json(tx, table, id)
            .await?
            .unwrap_or_else(|| serde_json::json!({ "id": id }).to_string()),
    };
    let local_id = ensure_local_device_id_tx(tx).await?;
    let seq: i64 = sqlx::query_scalar(
        "INSERT INTO sync_vector (device_id, seq) VALUES (?1, 1)
         ON CONFLICT(device_id) DO UPDATE SET seq = seq + 1
         RETURNING seq",
    )
    .bind(&local_id)
    .fetch_one(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    let payload =
        crate::infrastructure::database::hlc::stamp_in_tx(tx, table, id, &payload).await?;
    let outbox_id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO sync_outbox (id, device_id, seq, entity_table, entity_id, op, payload_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&outbox_id)
    .bind(&local_id)
    .bind(seq)
    .bind(table)
    .bind(id)
    .bind(op)
    .bind(&payload)
    .bind(&created_at)
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn audit_in_tx(
    tx: &mut Transaction<'_, Sqlite>,
    user_id: &str,
    action: &str,
    entity: &str,
    entity_id: Option<&str>,
    details: Option<&str>,
) -> Result<(), AppError> {
    crate::infrastructure::database::repos::admin::audit::create_in_tx(
        tx, user_id, action, entity, entity_id, details,
    )
    .await
}

async fn upsert_tombstone(
    tx: &mut Transaction<'_, Sqlite>,
    table: &str,
    id: &str,
) -> Result<(), AppError> {
    let device_id = ensure_local_device_id_tx(tx).await?;
    let deleted_at = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    sqlx::query(
        "INSERT INTO sync_tombstone (entity_table, entity_id, deleted_at, device_id)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(entity_table, entity_id) DO UPDATE SET
            deleted_at = excluded.deleted_at,
            device_id = excluded.device_id",
    )
    .bind(table)
    .bind(id)
    .bind(deleted_at)
    .bind(device_id)
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

async fn replication_active_tx(tx: &mut Transaction<'_, Sqlite>) -> Result<bool, AppError> {
    let raw: Option<String> = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = ?1")
        .bind(APP_KV_DEPLOYMENT_KEY)
        .fetch_optional(&mut **tx)
        .await
        .map_err(AppError::Database)?;
    let Some(raw) = raw else {
        return Ok(false);
    };
    let mode = serde_json::from_str::<serde_json::Value>(&raw)
        .ok()
        .and_then(|v| v.get("mode")?.as_str().map(str::to_string))
        .unwrap_or_default();
    if mode == "serverless_peer" {
        return Ok(true);
    }
    let n: i64 = count_remote_replicas(&mut **tx).await.unwrap_or(0);
    Ok(n > 0)
}

async fn ensure_local_device_id_tx(tx: &mut Transaction<'_, Sqlite>) -> Result<String, AppError> {
    let existing: Option<String> = sqlx::query_scalar("SELECT value FROM app_kv WHERE key = ?1")
        .bind(APP_KV_DEVICE_ID_KEY)
        .fetch_optional(&mut **tx)
        .await
        .map_err(AppError::Database)?;
    let id = match existing {
        Some(id) if !id.is_empty() => id,
        _ => {
            let id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
            )
            .bind(APP_KV_DEVICE_ID_KEY)
            .bind(&id)
            .execute(&mut **tx)
            .await
            .map_err(AppError::Database)?;
            id
        }
    };
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local)
         VALUES (?1, 'This device', 'MASTER', 1)
         ON CONFLICT(device_id) DO UPDATE SET is_local = 1",
    )
    .bind(&id)
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    sqlx::query("INSERT OR IGNORE INTO sync_vector (device_id, seq) VALUES (?1, 0)")
        .bind(&id)
        .execute(&mut **tx)
        .await
        .map_err(AppError::Database)?;
    Ok(id)
}

pub async fn purge_old_tombstones(pool: &SqlitePool) -> Result<u64, AppError> {
    let cutoff = (Utc::now() - chrono::Duration::days(90)).to_rfc3339();
    let r = sqlx::query("DELETE FROM sync_tombstone WHERE deleted_at < ?1")
        .bind(cutoff)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(r.rows_affected())
}

/// Record one row written outside a transaction (command layer). Builds the
/// payload from the stored row, like `record_in_tx`.
pub async fn record_row(
    pool: &SqlitePool,
    table: &str,
    id: &str,
    op: &str,
) -> Result<(), AppError> {
    record_or_noop_in_own_tx(pool, table, id, op).await
}

/// Used by tests that still pass a payload; the payload is ignored.
pub async fn record_or_noop_in_own_tx(
    pool: &SqlitePool,
    table: &str,
    id: &str,
    op: &str,
) -> Result<(), AppError> {
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    record_in_tx(&mut tx, table, id, op).await?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(())
}
