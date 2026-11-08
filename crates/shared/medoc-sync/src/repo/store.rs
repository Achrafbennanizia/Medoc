use std::collections::HashMap;

use chrono::Utc;
use medoc_core::error::AppError;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::deployment::{
    DeviceRole, SyncDeploymentConfig, APP_KV_DEPLOYMENT_KEY, APP_KV_DEVICE_ID_KEY,
};
use crate::schema::ensure_sync_tables;

use super::types::{is_synced_table, synced_tables, OutboxEntry, SyncPeer, SyncStatusSnapshot};

pub async fn ensure_local_device(pool: &SqlitePool, label: &str) -> Result<String, AppError> {
    ensure_sync_tables(pool).await?;
    let display_name = if label.is_empty() {
        "This device"
    } else {
        label
    };
    let existing =
        medoc_core::infrastructure::database::app_kv_repo::get(pool, APP_KV_DEVICE_ID_KEY).await?;
    if let Some(id) = existing.filter(|s| !s.trim().is_empty()) {
        let stored_role: Option<String> =
            sqlx::query_scalar("SELECT role FROM sync_device WHERE device_id = ?1")
                .bind(&id)
                .fetch_optional(pool)
                .await
                .map_err(AppError::Database)?;
        let role = stored_role
            .as_deref()
            .and_then(DeviceRole::parse)
            .unwrap_or(DeviceRole::Master);
        register_device_row(pool, &id, display_name, role, true, None, None).await?;
        return Ok(id);
    }
    let legacy = medoc_core::infrastructure::database::app_kv_repo::get(
        pool,
        medoc_core::infrastructure::license_repo::KEY_DEVICE_ID,
    )
    .await?;
    let id = legacy
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    medoc_core::infrastructure::database::app_kv_repo::set(pool, APP_KV_DEVICE_ID_KEY, &id).await?;
    register_device_row(
        pool,
        &id,
        display_name,
        DeviceRole::Master,
        true,
        None,
        None,
    )
    .await?;
    Ok(id)
}

/// Point this install's sync identity at `to_id` and move the local outbox
/// with it. The activation token's `device_id` is what the master compares
/// to `fromDeviceId`; a newer local fingerprint must not keep its own id.
pub async fn adopt_local_device_id(
    pool: &SqlitePool,
    from_id: &str,
    to_id: &str,
    label: &str,
    role: DeviceRole,
) -> Result<(), AppError> {
    if to_id.is_empty() || from_id == to_id {
        return Ok(());
    }
    ensure_sync_tables(pool).await?;
    let display = if label.is_empty() {
        "This device"
    } else {
        label
    };
    let mut tx = pool.begin().await.map_err(AppError::Database)?;
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local, last_seen_at)
         VALUES (?1, ?2, ?3, 1, CURRENT_TIMESTAMP)
         ON CONFLICT(device_id) DO UPDATE SET
           display_name = excluded.display_name,
           role = excluded.role,
           is_local = 1,
           last_seen_at = CURRENT_TIMESTAMP",
    )
    .bind(to_id)
    .bind(display)
    .bind(role.as_str())
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    let max_to: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(seq), 0) FROM sync_outbox WHERE device_id = ?1")
            .bind(to_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(AppError::Database)?;
    if max_to > 0 {
        sqlx::query("UPDATE sync_outbox SET seq = seq + ?1 WHERE device_id = ?2")
            .bind(max_to)
            .bind(from_id)
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
    }
    sqlx::query("UPDATE sync_outbox SET device_id = ?1 WHERE device_id = ?2")
        .bind(to_id)
        .bind(from_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;

    let from_seq: i64 = sqlx::query_scalar(
        "SELECT COALESCE((SELECT seq FROM sync_vector WHERE device_id = ?1), 0)",
    )
    .bind(from_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    let to_seq: i64 = sqlx::query_scalar(
        "SELECT COALESCE((SELECT seq FROM sync_vector WHERE device_id = ?1), 0)",
    )
    .bind(to_id)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    let max_out: i64 =
        sqlx::query_scalar("SELECT COALESCE(MAX(seq), 0) FROM sync_outbox WHERE device_id = ?1")
            .bind(to_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(AppError::Database)?;
    let merged = from_seq.max(to_seq).max(max_out);
    sqlx::query("DELETE FROM sync_vector WHERE device_id = ?1")
        .bind(from_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    sqlx::query(
        "INSERT INTO sync_vector (device_id, seq) VALUES (?1, ?2)
         ON CONFLICT(device_id) DO UPDATE SET seq = excluded.seq",
    )
    .bind(to_id)
    .bind(merged)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;

    let occupied: Vec<String> = sqlx::query_scalar(
        "SELECT target_device_id FROM sync_peer_vector WHERE source_device_id = ?1",
    )
    .bind(to_id)
    .fetch_all(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    for target in occupied {
        sqlx::query(
            "DELETE FROM sync_peer_vector WHERE source_device_id = ?1 AND target_device_id = ?2",
        )
        .bind(from_id)
        .bind(&target)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    }
    sqlx::query("UPDATE sync_peer_vector SET source_device_id = ?1 WHERE source_device_id = ?2")
        .bind(to_id)
        .bind(from_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;

    sqlx::query("UPDATE sync_device SET is_local = 0 WHERE is_local = 1 AND device_id != ?1")
        .bind(to_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::Database)?;
    sqlx::query(
        "INSERT INTO app_kv (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(APP_KV_DEVICE_ID_KEY)
    .bind(to_id)
    .execute(&mut *tx)
    .await
    .map_err(AppError::Database)?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(())
}

pub async fn load_deployment(pool: &SqlitePool) -> Result<SyncDeploymentConfig, AppError> {
    let raw =
        medoc_core::infrastructure::database::app_kv_repo::get(pool, APP_KV_DEPLOYMENT_KEY).await?;
    match raw {
        Some(s) => serde_json::from_str(&s)
            .map_err(|e| AppError::Validation(format!("sync.deployment.v1: {e}"))),
        None => Ok(SyncDeploymentConfig::default()),
    }
}

pub async fn save_deployment(
    pool: &SqlitePool,
    cfg: &SyncDeploymentConfig,
) -> Result<(), AppError> {
    let s = serde_json::to_string(cfg)
        .map_err(|e| AppError::Internal(format!("sync deployment serialise: {e}")))?;
    medoc_core::infrastructure::database::app_kv_repo::set(pool, APP_KV_DEPLOYMENT_KEY, &s).await
}

/// Recorder helper for repository write paths.
///
/// Semantics:
///
/// 1. Looks up the current deployment. If it is not `serverless_peer`,
///    the call is a no-op (master-only practices stay on the simpler path).
/// 2. Drops any write whose table is not in [`SYNCED_TABLES`].
/// 3. Otherwise appends one row to `sync_outbox` and bumps the local vector.
///
/// Returns `Ok(())` in all cases so callers can `?` it from their write
/// paths without changing return types.
pub async fn sync_record_or_noop(
    pool: &SqlitePool,
    entity_table: &str,
    entity_id: &str,
    op: &str,
    payload_json: &str,
) -> Result<(), AppError> {
    if !is_synced_table(entity_table) {
        return Ok(());
    }
    let deployment = load_deployment(pool).await.unwrap_or_default();
    let peer_mode = deployment.mode == crate::deployment::DeploymentMode::ServerlessPeer;
    let replica_joined: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_device
         WHERE is_local = 0
           AND (role = 'REPLICA' OR seat_role = 'MEMBER')",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(0);
    if !peer_mode && replica_joined == 0 {
        return Ok(());
    }
    let local_id = ensure_local_device(pool, &deployment.device_label).await?;
    append_outbox(pool, &local_id, entity_table, entity_id, op, payload_json).await?;
    Ok(())
}

pub async fn append_outbox(
    pool: &SqlitePool,
    device_id: &str,
    entity_table: &str,
    entity_id: &str,
    op: &str,
    payload_json: &str,
) -> Result<OutboxEntry, AppError> {
    ensure_sync_tables(pool).await?;
    let seq: i64 = sqlx::query_scalar(
        "INSERT INTO sync_vector (device_id, seq) VALUES (?1, 1)
         ON CONFLICT(device_id) DO UPDATE SET seq = seq + 1
         RETURNING seq",
    )
    .bind(device_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;

    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO sync_outbox (id, device_id, seq, entity_table, entity_id, op, payload_json, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
    )
    .bind(&id)
    .bind(device_id)
    .bind(seq)
    .bind(entity_table)
    .bind(entity_id)
    .bind(op)
    .bind(payload_json)
    .bind(&created_at)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(OutboxEntry {
        id,
        device_id: device_id.to_string(),
        seq,
        entity_table: entity_table.to_string(),
        entity_id: entity_id.to_string(),
        op: op.to_string(),
        payload_json: payload_json.to_string(),
        created_at,
    })
}

pub async fn list_pending_outbox(
    pool: &SqlitePool,
    device_id: &str,
    limit: i64,
) -> Result<Vec<OutboxEntry>, AppError> {
    let rows = sqlx::query_as::<_, (String, String, i64, String, String, String, String, String)>(
        "SELECT id, device_id, seq, entity_table, entity_id, op, payload_json, created_at
         FROM sync_outbox
         WHERE device_id = ?1 AND delivered_at IS NULL
           AND (fail_reason IS NULL OR fail_reason = '')
         ORDER BY seq ASC
         LIMIT ?2",
    )
    .bind(device_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(rows
        .into_iter()
        .map(
            |(id, device_id, seq, entity_table, entity_id, op, payload_json, created_at)| {
                OutboxEntry {
                    id,
                    device_id,
                    seq,
                    entity_table,
                    entity_id,
                    op,
                    payload_json,
                    created_at,
                }
            },
        )
        .collect())
}

pub async fn mark_outbox_delivered(
    pool: &SqlitePool,
    device_id: &str,
    through_seq: i64,
) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE sync_outbox SET delivered_at = ?1
         WHERE device_id = ?2 AND seq <= ?3 AND delivered_at IS NULL",
    )
    .bind(&now)
    .bind(device_id)
    .bind(through_seq)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn mark_outbox_failed(
    pool: &SqlitePool,
    entry_id: &str,
    reason: &str,
) -> Result<(), AppError> {
    sqlx::query("UPDATE sync_outbox SET fail_reason = ?1 WHERE id = ?2")
        .bind(reason)
        .bind(entry_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

/// Outbox rows from `source_device_id` not yet pushed to `target_device_id` (mesh).
pub async fn list_pending_outbox_for_peer(
    pool: &SqlitePool,
    source_device_id: &str,
    target_device_id: &str,
) -> Result<Vec<OutboxEntry>, AppError> {
    let since: i64 = sqlx::query_scalar(
        "SELECT COALESCE(through_seq, 0) FROM sync_peer_vector
         WHERE source_device_id = ?1 AND target_device_id = ?2",
    )
    .bind(source_device_id)
    .bind(target_device_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?
    .unwrap_or(0);

    let rows = sqlx::query_as::<_, (String, String, i64, String, String, String, String, String)>(
        "SELECT id, device_id, seq, entity_table, entity_id, op, payload_json, created_at
         FROM sync_outbox
         WHERE device_id = ?1 AND seq > ?2
           AND (fail_reason IS NULL OR fail_reason = '')
         ORDER BY seq ASC"
    )
    .bind(source_device_id)
    .bind(since)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(rows
        .into_iter()
        .map(
            |(id, device_id, seq, entity_table, entity_id, op, payload_json, created_at)| {
                OutboxEntry {
                    id,
                    device_id,
                    seq,
                    entity_table,
                    entity_id,
                    op,
                    payload_json,
                    created_at,
                }
            },
        )
        .collect())
}

pub async fn mark_peer_delivery(
    pool: &SqlitePool,
    source_device_id: &str,
    target_device_id: &str,
    through_seq: i64,
) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "INSERT INTO sync_peer_vector (source_device_id, target_device_id, through_seq, updated_at)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(source_device_id, target_device_id) DO UPDATE SET
           through_seq = MAX(sync_peer_vector.through_seq, excluded.through_seq),
           updated_at = excluded.updated_at",
    )
    .bind(source_device_id)
    .bind(target_device_id)
    .bind(through_seq)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn list_entries_since(
    pool: &SqlitePool,
    device_id: &str,
    since_seq: i64,
) -> Result<Vec<OutboxEntry>, AppError> {
    let rows = sqlx::query_as::<_, (String, String, i64, String, String, String, String, String)>(
        "SELECT id, device_id, seq, entity_table, entity_id, op, payload_json, created_at
         FROM sync_outbox
         WHERE device_id = ?1 AND seq > ?2
         ORDER BY seq ASC
         LIMIT 500",
    )
    .bind(device_id)
    .bind(since_seq)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(rows
        .into_iter()
        .map(
            |(id, device_id, seq, entity_table, entity_id, op, payload_json, created_at)| {
                OutboxEntry {
                    id,
                    device_id,
                    seq,
                    entity_table,
                    entity_id,
                    op,
                    payload_json,
                    created_at,
                }
            },
        )
        .collect())
}

/// Keys that decide how the appointment calendar is drawn: hours, closures,
/// blocked times, and appointment preferences (buffer, colours, reminders).
const CALENDAR_CONTROL_KV_KEYS: &[&str] = &[
    "practice.work_hours.v1",
    "practice.blockedTimes.v1",
    "practice.preferences.v1",
    "practice.preferences-appointment.v1",
    "practice.calendar-workflows.v1",
];

/// Queue the current calendar controls so the other device can apply the
/// newer copy. Safe to call once per launch; later edits are recorded on write.
pub async fn enqueue_calendar_controls(pool: &SqlitePool) -> Result<u32, AppError> {
    let deployment = load_deployment(pool).await?;
    if deployment.mode != crate::deployment::DeploymentMode::ServerlessPeer {
        return Ok(0);
    }
    let local_id = ensure_local_device(pool, &deployment.device_label).await?;
    let mut queued = 0u32;
    for key in CALENDAR_CONTROL_KV_KEYS {
        let row: Option<(String, String)> =
            sqlx::query_as("SELECT value, updated_at FROM app_kv WHERE key = ?1")
                .bind(key)
                .fetch_optional(pool)
                .await
                .map_err(AppError::Database)?;
        let Some((value, updated_at)) = row else {
            continue;
        };
        let payload = serde_json::json!({
            "key": key,
            "value": value,
            "updated_at": updated_at,
        });
        append_outbox(
            pool,
            &local_id,
            "app_kv",
            key,
            "UPDATE",
            &payload.to_string(),
        )
        .await?;
        queued += 1;
    }
    queued += snapshot_table(pool, &local_id, "absence").await?;
    Ok(queued)
}

/// Dump current practice rows into the outbox so a replica can pull a full initial package.
pub async fn enqueue_full_snapshot(pool: &SqlitePool) -> Result<u32, AppError> {
    ensure_sync_tables(pool).await?;
    let deployment = load_deployment(pool).await?;
    let local_id = ensure_local_device(pool, &deployment.device_label).await?;
    let mut queued = 0u32;
    for table in synced_tables() {
        queued += snapshot_table(pool, &local_id, table).await?;
    }
    tracing::info!(
        target: "medoc::sync",
        event = "SYNC_SNAPSHOT_QUEUED",
        rows = queued
    );
    Ok(queued)
}

async fn snapshot_table(pool: &SqlitePool, device_id: &str, table: &str) -> Result<u32, AppError> {
    let cols: Vec<String> =
        sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;
    if cols.is_empty() {
        return Ok(0);
    }
    // F146/F147: entity id is not always column `id` (hint, preference, chart_validation).
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
    if medoc_core::infrastructure::database::sync_registry::key_is_column(table) {
        let id_col = medoc_core::infrastructure::database::sync_registry::id_column(table);
        if !cols.iter().any(|c| c == id_col) {
            return Ok(0);
        }
    } else if !(cols.iter().any(|c| c == "patient_id") && cols.iter().any(|c| c == "section_or_item"))
    {
        return Ok(0);
    }
    let mut from_sql = table.to_string();
    if table == "app_kv" {
        from_sql.push_str(
            " WHERE key NOT LIKE 'sync.%'
               AND key NOT LIKE 'license.%'
               AND key NOT LIKE 'pairing.%'
               AND key NOT LIKE 'onboarding.%'
               AND key NOT LIKE 'cluster.%'
               AND key NOT LIKE 'company.portal.%'",
        );
    }
    let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {from_sql}"))
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
    if count <= 0 {
        return Ok(0);
    }
    sqlx::query(
        "INSERT INTO sync_vector (device_id, seq) VALUES (?1, 0)
         ON CONFLICT(device_id) DO NOTHING",
    )
    .bind(device_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    let new_max: i64 = sqlx::query_scalar(
        "UPDATE sync_vector SET seq = seq + ?2 WHERE device_id = ?1 RETURNING seq",
    )
    .bind(device_id)
    .bind(count)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    let seq_base = new_max - count;
    let json_expr = snapshot_pairs(table, &cols);
    let created_at = chrono::Utc::now().to_rfc3339();
    let insert_sql = format!(
        "INSERT INTO sync_outbox (id, device_id, seq, entity_table, entity_id, op, payload_json, created_at)
         SELECT lower(hex(randomblob(16))), ?1, ?2 + ROW_NUMBER() OVER (ORDER BY {key}),
                ?3, CAST({key} AS TEXT), 'UPDATE', {json_expr}, ?4
         FROM {from_sql}"
    );
    sqlx::query(&insert_sql)
        .bind(device_id)
        .bind(seq_base)
        .bind(table)
        .bind(&created_at)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(count as u32)
}

fn snapshot_pairs(table: &str, cols: &[String]) -> String {
    medoc_core::infrastructure::database::recorded_write::json_object_sql(table, cols)
}

fn is_private_app_kv_key(key: &str) -> bool {
    medoc_core::infrastructure::database::sync_registry::deny_app_kv_key(key)
}

/// JSON object for one live row, using the same `json_object` shape as a snapshot.
/// `None` when the table is not synced or the row is gone.
pub async fn load_row_payload_json(
    pool: &SqlitePool,
    table: &str,
    entity_id: &str,
) -> Result<Option<String>, AppError> {
    if !is_synced_table(table) {
        return Ok(None);
    }
    let key = medoc_core::infrastructure::database::sync_registry::key_expr(table);
    let cols: Vec<String> =
        sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
            .fetch_all(pool)
            .await
            .map_err(AppError::Database)?;
    if cols.is_empty() {
        return Ok(None);
    }
    if table == "app_kv" && is_private_app_kv_key(entity_id) {
        return Ok(None);
    }
    let json_expr = snapshot_pairs(table, &cols);
    let sql = format!("SELECT {json_expr} FROM \"{table}\" WHERE {key} = ?1");
    let json: Option<String> = sqlx::query_scalar(&sql)
        .bind(entity_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(json.filter(|s| !s.is_empty()))
}

/// Remember the highest seq observed from a remote device (replica pull cursor).
pub async fn set_observed_seq(
    pool: &SqlitePool,
    device_id: &str,
    seq: i64,
) -> Result<(), AppError> {
    ensure_sync_tables(pool).await?;
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local)
         VALUES (?1, 'Main', 'MASTER', 0)
         ON CONFLICT(device_id) DO NOTHING",
    )
    .bind(device_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "INSERT INTO sync_vector (device_id, seq) VALUES (?1, ?2)
         ON CONFLICT(device_id) DO UPDATE SET
           seq = CASE WHEN excluded.seq > sync_vector.seq THEN excluded.seq ELSE sync_vector.seq END",
    )
    .bind(device_id)
    .bind(seq)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// How many times this pulled row has failed to apply. Starts at 1.
pub async fn record_pull_failure(
    pool: &SqlitePool,
    source_device_id: &str,
    source_seq: i64,
) -> Result<i64, AppError> {
    ensure_sync_tables(pool).await?;
    let attempts: i64 = sqlx::query_scalar(
        "INSERT INTO sync_pull_failure (source_device_id, source_seq, attempts)
         VALUES (?1, ?2, 1)
         ON CONFLICT(source_device_id, source_seq) DO UPDATE SET
           attempts = attempts + 1
         RETURNING attempts",
    )
    .bind(source_device_id)
    .bind(source_seq)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(attempts)
}

pub async fn clear_pull_failure(
    pool: &SqlitePool,
    source_device_id: &str,
    source_seq: i64,
) -> Result<(), AppError> {
    ensure_sync_tables(pool).await?;
    sqlx::query("DELETE FROM sync_pull_failure WHERE source_device_id = ?1 AND source_seq = ?2")
        .bind(source_device_id)
        .bind(source_seq)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

pub async fn was_applied(
    pool: &SqlitePool,
    source_device_id: &str,
    source_seq: i64,
) -> Result<bool, AppError> {
    let n: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_applied WHERE source_device_id = ?1 AND source_seq = ?2",
    )
    .bind(source_device_id)
    .bind(source_seq)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(n > 0)
}

pub async fn mark_applied(
    pool: &SqlitePool,
    source_device_id: &str,
    source_seq: i64,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT OR IGNORE INTO sync_applied (source_device_id, source_seq) VALUES (?1, ?2)",
    )
    .bind(source_device_id)
    .bind(source_seq)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn all_vectors(pool: &SqlitePool) -> Result<HashMap<String, i64>, AppError> {
    let rows = sqlx::query_as::<_, (String, i64)>(
        "SELECT device_id, seq FROM sync_vector ORDER BY device_id",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows.into_iter().collect())
}

pub async fn status_snapshot(pool: &SqlitePool) -> Result<SyncStatusSnapshot, AppError> {
    ensure_sync_tables(pool).await?;
    let deployment = load_deployment(pool).await?;
    let local_device_id = ensure_local_device(pool, &deployment.device_label).await?;
    let local_seq: i64 = sqlx::query_scalar(
        "SELECT COALESCE((SELECT seq FROM sync_vector WHERE device_id = ?1), 0)",
    )
    .bind(&local_device_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    let pending_outbox: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_outbox WHERE device_id = ?1 AND delivered_at IS NULL",
    )
    .bind(&local_device_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    let peers = list_peers(pool).await?;
    let vectors = all_vectors(pool).await?;
    Ok(SyncStatusSnapshot {
        local_device_id,
        deployment,
        local_seq,
        pending_outbox,
        peers,
        vectors,
    })
}

/// Refresh replica `last_seen_at` and LAN base URL after a successful push.
pub async fn touch_replica_seen(
    pool: &SqlitePool,
    device_id: &str,
    peer_ip: &str,
    http_port: u16,
) -> Result<(), AppError> {
    ensure_sync_tables(pool).await?;
    let peer_base_url = crate::pairing::peer_base_url_from_ip(peer_ip, http_port);
    sqlx::query(
        "UPDATE sync_device SET last_seen_at = CURRENT_TIMESTAMP,
            peer_base_url = COALESCE(?1, peer_base_url)
         WHERE device_id = ?2",
    )
    .bind(peer_base_url)
    .bind(device_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn register_peer(
    pool: &SqlitePool,
    device_id: &str,
    display_name: &str,
    role: DeviceRole,
    peer_base_url: Option<&str>,
    peer_cert_sha256: Option<&str>,
) -> Result<(), AppError> {
    register_device_row(
        pool,
        device_id,
        display_name,
        role,
        false,
        peer_base_url,
        peer_cert_sha256,
    )
    .await
}

pub async fn register_local_device(
    pool: &SqlitePool,
    device_id: &str,
    display_name: &str,
    role: DeviceRole,
    peer_base_url: Option<&str>,
    peer_cert_sha256: Option<&str>,
) -> Result<(), AppError> {
    register_device_row(
        pool,
        device_id,
        display_name,
        role,
        true,
        peer_base_url,
        peer_cert_sha256,
    )
    .await
}

async fn register_device_row(
    pool: &SqlitePool,
    device_id: &str,
    display_name: &str,
    role: DeviceRole,
    is_local: bool,
    peer_base_url: Option<&str>,
    peer_cert_sha256: Option<&str>,
) -> Result<(), AppError> {
    ensure_sync_tables(pool).await?;
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local, peer_base_url, peer_cert_sha256, last_seen_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, CURRENT_TIMESTAMP)
         ON CONFLICT(device_id) DO UPDATE SET
           display_name = excluded.display_name,
           role = excluded.role,
           is_local = excluded.is_local,
           peer_base_url = COALESCE(excluded.peer_base_url, sync_device.peer_base_url),
           peer_cert_sha256 = COALESCE(excluded.peer_cert_sha256, sync_device.peer_cert_sha256),
           last_seen_at = CURRENT_TIMESTAMP",
    )
    .bind(device_id)
    .bind(display_name)
    .bind(role.as_str())
    .bind(if is_local { 1 } else { 0 })
    .bind(peer_base_url)
    .bind(peer_cert_sha256)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query("INSERT OR IGNORE INTO sync_vector (device_id, seq) VALUES (?1, 0)")
        .bind(device_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}

async fn list_peers(pool: &SqlitePool) -> Result<Vec<SyncPeer>, AppError> {
    let rows = sqlx::query_as::<_, (String, String, String, Option<String>, Option<String>)>(
        "SELECT device_id, display_name, role, peer_base_url, last_seen_at
         FROM sync_device ORDER BY is_local DESC, display_name ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows
        .into_iter()
        .map(
            |(device_id, display_name, role, peer_base_url, last_seen_at)| SyncPeer {
                device_id,
                display_name,
                role,
                peer_base_url,
                last_seen_at,
            },
        )
        .collect())
}
