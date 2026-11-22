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
        medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, APP_KV_DEVICE_ID_KEY)
            .await?;
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
    let legacy = medoc_core::infrastructure::database::repos::admin::app_kv::get(
        pool,
        medoc_core::infrastructure::database::repos::admin::license::KEY_DEVICE_ID,
    )
    .await?;
    let id = legacy
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    medoc_core::infrastructure::database::repos::admin::app_kv::set(
        pool,
        APP_KV_DEVICE_ID_KEY,
        &id,
    )
    .await?;
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
    let raw = medoc_core::infrastructure::database::repos::admin::app_kv::get(
        pool,
        APP_KV_DEPLOYMENT_KEY,
    )
    .await?;
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
    medoc_core::infrastructure::database::repos::admin::app_kv::set(pool, APP_KV_DEPLOYMENT_KEY, &s)
        .await
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
    let replica_joined: i64 =
        medoc_core::infrastructure::database::recorded_write::count_remote_replicas(pool)
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
    let payload_json =
        crate::hlc::stamp_payload(pool, entity_table, entity_id, payload_json).await?;
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
    .bind(&payload_json)
    .bind(&created_at)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    enqueue_packet_row(pool, device_id, entity_table, seq, &id, &created_at).await?;

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

const EXCHANGE_QUEUES: &[&str] = &[
    "patients",
    "appointments",
    "charts",
    "finance",
    "parameters",
    "orders",
    "tasks",
    "work_time",
    "practice",
];

async fn enqueue_packet_row(
    pool: &SqlitePool,
    device_id: &str,
    entity_table: &str,
    seq: i64,
    outbox_id: &str,
    created_at: &str,
) -> Result<(), AppError> {
    medoc_core::infrastructure::database::migrations::ensure_packet_queue(pool).await?;
    let queue = medoc_core::infrastructure::database::sync_registry::queue_of(entity_table);
    sqlx::query(
        "INSERT INTO sync_packet_queue (id, device_id, queue_name, seq, outbox_id, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)
         ON CONFLICT(device_id, seq) DO NOTHING",
    )
    .bind(outbox_id)
    .bind(device_id)
    .bind(queue)
    .bind(seq)
    .bind(outbox_id)
    .bind(created_at)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Append one local change onto this device's packet queue.
///
/// The main device and a replica both use this. The next exchange sends the
/// packet to the other device, which applies it.
pub async fn enqueue_update_packet(
    pool: &SqlitePool,
    entity_table: &str,
    entity_id: &str,
    op: &str,
    payload_json: &str,
) -> Result<OutboxEntry, AppError> {
    if !is_synced_table(entity_table) {
        return Err(AppError::Validation(format!(
            "table {entity_table} is not on a sync queue"
        )));
    }
    let deployment = load_deployment(pool).await.unwrap_or_default();
    let local_id = ensure_local_device(pool, &deployment.device_label).await?;
    append_outbox(pool, &local_id, entity_table, entity_id, op, payload_json).await
}

/// Cursor key for one queue of a peer pair in `sync_peer_vector`.
/// A queue-filtered exchange moves only its own queues' cursors, never the
/// whole-stream cursor, so rows of the other queues are not skipped.
fn queue_target(target_device_id: &str, queue: &str) -> String {
    format!("{target_device_id}#{queue}")
}

async fn peer_cursor(pool: &SqlitePool, source: &str, target: &str) -> Result<i64, AppError> {
    Ok(sqlx::query_scalar(
        "SELECT COALESCE(through_seq, 0) FROM sync_peer_vector
         WHERE source_device_id = ?1 AND target_device_id = ?2",
    )
    .bind(source)
    .bind(target)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?
    .unwrap_or(0))
}

fn requested_queues(queues: &[String]) -> Result<Vec<&'static str>, AppError> {
    if queues.is_empty() {
        return Ok(EXCHANGE_QUEUES.to_vec());
    }
    let picked: Vec<&'static str> = EXCHANGE_QUEUES
        .iter()
        .copied()
        .filter(|known| queues.iter().any(|q| q.trim() == *known))
        .collect();
    if picked.is_empty() {
        return Err(AppError::Validation(
            "no known sync queue in the exchange request".into(),
        ));
    }
    Ok(picked)
}

/// Record that `target` has everything from `source` through `seq`, for all
/// queues (`queues` empty) or only the named ones.
pub async fn mark_peer_delivery_for_queues(
    pool: &SqlitePool,
    source_device_id: &str,
    target_device_id: &str,
    queues: &[String],
    through_seq: i64,
) -> Result<(), AppError> {
    if queues.is_empty() {
        return mark_peer_delivery(pool, source_device_id, target_device_id, through_seq).await;
    }
    for queue in requested_queues(queues)? {
        mark_peer_delivery(
            pool,
            source_device_id,
            &queue_target(target_device_id, queue),
            through_seq,
        )
        .await?;
    }
    Ok(())
}

/// Highest seq of `remote` this device has applied, for all queues or the named ones.
pub async fn received_through(
    pool: &SqlitePool,
    remote_device_id: &str,
    local_device_id: &str,
    queues: &[String],
) -> Result<i64, AppError> {
    let global = all_vectors(pool)
        .await?
        .get(remote_device_id)
        .copied()
        .unwrap_or(0);
    if queues.is_empty() {
        return Ok(global);
    }
    let mut lowest = i64::MAX;
    for queue in requested_queues(queues)? {
        let q = peer_cursor(
            pool,
            remote_device_id,
            &queue_target(local_device_id, queue),
        )
        .await?;
        lowest = lowest.min(q.max(global));
    }
    Ok(if lowest == i64::MAX { global } else { lowest })
}

/// Remember what was applied from `remote`: the whole stream, or named queues.
pub async fn note_received(
    pool: &SqlitePool,
    remote_device_id: &str,
    local_device_id: &str,
    queues: &[String],
    seq: i64,
) -> Result<(), AppError> {
    if queues.is_empty() {
        // `set_observed_seq` registers an unknown peer as MASTER, which is
        // right on a replica. On the main device the peer is a replica: a row
        // labelled MASTER would hide it from the devices the main one dials.
        let deployment = load_deployment(pool).await.unwrap_or_default();
        if deployment.role == crate::deployment::DeviceRole::Master {
            sqlx::query(
                "INSERT INTO sync_device (device_id, display_name, role, is_local)
                 VALUES (?1, 'Replica', 'REPLICA', 0)
                 ON CONFLICT(device_id) DO NOTHING",
            )
            .bind(remote_device_id)
            .execute(pool)
            .await
            .map_err(AppError::Database)?;
        }
        return set_observed_seq(pool, remote_device_id, seq).await;
    }
    for queue in requested_queues(queues)? {
        mark_peer_delivery(
            pool,
            remote_device_id,
            &queue_target(local_device_id, queue),
            seq,
        )
        .await?;
    }
    Ok(())
}

/// Packets this device still owes `peer_device_id`, oldest first.
///
/// Read from `sync_outbox` itself. The old query joined `sync_packet_queue`,
/// which only rows written through `append_outbox` ever reached: live edits
/// recorded by the repositories (`recorded_write::record_in_tx`), rows the
/// main device relays from another replica, and initial-copy rows were never
/// sent on the exchange path.
///
/// `only_undelivered`: a replica has one target (the main device), so rows it
/// already pushed are skipped. The main device serves several replicas and
/// relies on each peer's cursor alone.
pub async fn list_exchange_packets(
    pool: &SqlitePool,
    device_id: &str,
    peer_device_id: &str,
    queues: &[String],
    limit: i64,
) -> Result<Vec<OutboxEntry>, AppError> {
    let deployment = load_deployment(pool).await.unwrap_or_default();
    let only_undelivered = deployment.role == crate::deployment::DeviceRole::Replica;
    list_exchange_packets_with(
        pool,
        device_id,
        peer_device_id,
        queues,
        limit,
        only_undelivered,
    )
    .await
}

pub async fn list_exchange_packets_with(
    pool: &SqlitePool,
    device_id: &str,
    peer_device_id: &str,
    queues: &[String],
    limit: i64,
    only_undelivered: bool,
) -> Result<Vec<OutboxEntry>, AppError> {
    let Ok(wanted) = requested_queues(queues) else {
        return Ok(Vec::new());
    };
    let global = peer_cursor(pool, device_id, peer_device_id).await?;
    let mut clauses = Vec::new();
    for queue in wanted {
        let tables: Vec<String> = synced_tables()
            .filter(|t| medoc_core::infrastructure::database::sync_registry::queue_of(t) == queue)
            .map(|t| format!("'{t}'"))
            .collect();
        if tables.is_empty() {
            continue;
        }
        let since = peer_cursor(pool, device_id, &queue_target(peer_device_id, queue))
            .await?
            .max(global);
        clauses.push(format!(
            "(entity_table IN ({}) AND seq > {since})",
            tables.join(", ")
        ));
    }
    if clauses.is_empty() {
        return Ok(Vec::new());
    }
    let delivered = if only_undelivered {
        " AND delivered_at IS NULL"
    } else {
        ""
    };
    let sql = format!(
        "SELECT id, device_id, seq, entity_table, entity_id, op, payload_json, created_at
         FROM sync_outbox
         WHERE device_id = ?1 AND seq > ?2
           AND (fail_reason IS NULL OR fail_reason = '')
           AND (snapshot_for IS NULL OR snapshot_for = ?3)
           {delivered}
           AND ({})
         ORDER BY seq ASC
         LIMIT ?4",
        clauses.join(" OR ")
    );
    let rows =
        sqlx::query_as::<_, (String, String, i64, String, String, String, String, String)>(&sql)
            .bind(device_id)
            .bind(global)
            .bind(peer_device_id)
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

/// Pending rows a joined device may send while the first snapshot is still
/// copying. Practice settings (`app_kv`, absences) stay queued so this
/// device's seed copy does not overwrite the main device.
/// Pending rows for one page queue. A blocked queue does not hide the others.
pub async fn list_pending_outbox_tables(
    pool: &SqlitePool,
    device_id: &str,
    tables: &[&str],
    limit: i64,
) -> Result<Vec<OutboxEntry>, AppError> {
    let list = tables
        .iter()
        .filter(|table| is_synced_table(table))
        .map(|table| format!("'{table}'"))
        .collect::<Vec<_>>()
        .join(", ");
    if list.is_empty() {
        return Ok(Vec::new());
    }
    let sql = format!(
        "SELECT id, device_id, seq, entity_table, entity_id, op, payload_json, created_at
         FROM sync_outbox
         WHERE device_id = ?1 AND delivered_at IS NULL
           AND (fail_reason IS NULL OR fail_reason = '')
           AND entity_table IN ({list})
         ORDER BY seq ASC
         LIMIT ?2"
    );
    let rows =
        sqlx::query_as::<_, (String, String, i64, String, String, String, String, String)>(&sql)
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

pub async fn list_pending_member_outbox(
    pool: &SqlitePool,
    device_id: &str,
    limit: i64,
) -> Result<Vec<OutboxEntry>, AppError> {
    let tables = member_table_sql_list();
    let sql = format!(
        "SELECT id, device_id, seq, entity_table, entity_id, op, payload_json, created_at
         FROM sync_outbox
         WHERE device_id = ?1 AND delivered_at IS NULL
           AND (fail_reason IS NULL OR fail_reason = '')
           AND entity_table IN ({tables})
         ORDER BY seq ASC
         LIMIT ?2"
    );
    let rows =
        sqlx::query_as::<_, (String, String, i64, String, String, String, String, String)>(&sql)
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

fn member_table_sql_list() -> String {
    use medoc_core::infrastructure::database::sync_registry::{class_of, SyncClass};
    synced_tables()
        .filter(|table| {
            matches!(
                class_of(table),
                Some(SyncClass::Shared | SyncClass::Numbered | SyncClass::Files)
            )
        })
        .map(|table| format!("'{table}'"))
        .collect::<Vec<_>>()
        .join(", ")
}

pub async fn mark_outbox_ids_delivered(pool: &SqlitePool, ids: &[String]) -> Result<(), AppError> {
    if ids.is_empty() {
        return Ok(());
    }
    let now = Utc::now().to_rfc3339();
    for id in ids {
        sqlx::query(
            "UPDATE sync_outbox SET delivered_at = ?1 WHERE id = ?2 AND delivered_at IS NULL",
        )
        .bind(&now)
        .bind(id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }
    Ok(())
}

pub async fn mark_outbox_delivered(
    pool: &SqlitePool,
    device_id: &str,
    through_seq: i64,
) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE sync_outbox SET delivered_at = ?1
         WHERE device_id = ?2 AND seq <= ?3 AND delivered_at IS NULL
           AND (fail_reason IS NULL OR fail_reason = '')",
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
    // A change that will not be sent is listed for the admin, not just logged.
    let row = sqlx::query_as::<_, (String, String, i64, String, String, String, String, String)>(
        "SELECT id, device_id, seq, entity_table, entity_id, op, payload_json, created_at
         FROM sync_outbox WHERE id = ?1",
    )
    .bind(entry_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    if let Some((id, device_id, seq, entity_table, entity_id, op, payload_json, created_at)) = row {
        let entry = OutboxEntry {
            id,
            device_id,
            seq,
            entity_table,
            entity_id,
            op,
            payload_json,
            created_at,
        };
        crate::problems::record_outgoing(pool, &entry, reason).await;
    }
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
           AND (snapshot_for IS NULL OR snapshot_for = ?3)
         ORDER BY seq ASC
         LIMIT 500",
    )
    .bind(source_device_id)
    .bind(since)
    .bind(target_device_id)
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
    list_entries_since_for(pool, device_id, since_seq, None).await
}

/// Outbox page for one reader. Initial-copy rows queued for another device
/// are skipped (`snapshot_for`), so a second replica joining does not make
/// every other replica download the whole practice again.
pub async fn list_entries_since_for(
    pool: &SqlitePool,
    device_id: &str,
    since_seq: i64,
    reader: Option<&str>,
) -> Result<Vec<OutboxEntry>, AppError> {
    let rows = sqlx::query_as::<_, (String, String, i64, String, String, String, String, String)>(
        "SELECT id, device_id, seq, entity_table, entity_id, op, payload_json, created_at
         FROM sync_outbox
         WHERE device_id = ?1 AND seq > ?2
           AND (snapshot_for IS NULL OR snapshot_for = ?3)
         ORDER BY seq ASC
         LIMIT 500",
    )
    .bind(device_id)
    .bind(since_seq)
    .bind(reader)
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
///
/// Kept for callers that do not know the joining device; the rows are then
/// visible to every peer. Prefer [`enqueue_snapshot_for`].
pub async fn enqueue_full_snapshot(pool: &SqlitePool) -> Result<u32, AppError> {
    enqueue_snapshot_for(pool, None).await
}

/// Queue one full copy of every synced table for `requester` (the joining
/// replica's device id).
///
/// - The whole copy is written in one `BEGIN IMMEDIATE` transaction. Before,
///   each table was counted, the sequence was reserved, and the rows were
///   inserted in separate statements: a live write in between took a reserved
///   sequence number, the `INSERT … SELECT` hit `UNIQUE(device_id, seq)`, and
///   that whole table was missing from the replica's copy.
/// - Each row carries its `syncHlc`, so a replica that already holds a newer
///   edit of the row keeps it instead of being overwritten by the copy.
/// - Rows are tagged `snapshot_for = requester`: other replicas skip them
///   instead of downloading the whole practice every time a device joins.
///   A previous, unfinished copy for the same requester is replaced.
pub async fn enqueue_snapshot_for(
    pool: &SqlitePool,
    requester: Option<&str>,
) -> Result<u32, AppError> {
    ensure_sync_tables(pool).await?;
    let deployment = load_deployment(pool).await?;
    let local_id = ensure_local_device(pool, &deployment.device_label).await?;
    let requester = requester.map(str::trim).filter(|r| !r.is_empty());
    let mut tx = pool
        .begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(AppError::Database)?;
    if let Some(requester) = requester {
        sqlx::query("DELETE FROM sync_outbox WHERE device_id = ?1 AND snapshot_for = ?2")
            .bind(&local_id)
            .bind(requester)
            .execute(&mut *tx)
            .await
            .map_err(AppError::Database)?;
    }
    let mut queued = 0u32;
    for table in synced_tables() {
        queued += snapshot_table_in(&mut tx, &local_id, table, requester).await?;
    }
    tx.commit().await.map_err(AppError::Database)?;
    tracing::info!(
        target: "medoc::sync",
        event = "SYNC_SNAPSHOT_QUEUED",
        rows = queued,
        requester = requester.unwrap_or("")
    );
    Ok(queued)
}

/// Highest sequence of a copy already queued for `requester` within the last
/// day, so a second request (pairing, then the first pull) reuses it.
pub async fn recent_snapshot_end(
    pool: &SqlitePool,
    local_id: &str,
    requester: &str,
) -> Result<Option<i64>, AppError> {
    let cutoff = (Utc::now() - chrono::Duration::hours(24)).to_rfc3339();
    let end: Option<i64> = sqlx::query_scalar(
        "SELECT MAX(seq) FROM sync_outbox
         WHERE device_id = ?1 AND snapshot_for = ?2 AND created_at >= ?3",
    )
    .bind(local_id)
    .bind(requester)
    .bind(cutoff)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(end)
}

async fn snapshot_table(pool: &SqlitePool, device_id: &str, table: &str) -> Result<u32, AppError> {
    let mut tx = pool
        .begin_with("BEGIN IMMEDIATE")
        .await
        .map_err(AppError::Database)?;
    let n = snapshot_table_in(&mut tx, device_id, table, None).await?;
    tx.commit().await.map_err(AppError::Database)?;
    Ok(n)
}

async fn snapshot_table_in(
    tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    device_id: &str,
    table: &str,
    requester: Option<&str>,
) -> Result<u32, AppError> {
    let cols: Vec<String> =
        sqlx::query_scalar(&format!("SELECT name FROM pragma_table_info('{table}')"))
            .fetch_all(&mut **tx)
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
    } else if !(cols.iter().any(|c| c == "patient_id")
        && cols.iter().any(|c| c == "section_or_item"))
    {
        return Ok(0);
    }
    let mut from_sql = format!("\"{table}\"");
    if table == "app_kv" {
        let predicate =
            medoc_core::infrastructure::database::sync_registry::synced_app_kv_predicate("key");
        from_sql.push_str(" WHERE ");
        from_sql.push_str(&predicate);
    }
    let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {from_sql}"))
        .fetch_one(&mut **tx)
        .await
        .map_err(AppError::Database)?;
    if count <= 0 {
        return Ok(0);
    }
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local)
         VALUES (?1, 'This device', 'MASTER', 1)
         ON CONFLICT(device_id) DO NOTHING",
    )
    .bind(device_id)
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "INSERT INTO sync_vector (device_id, seq) VALUES (?1, 0)
         ON CONFLICT(device_id) DO NOTHING",
    )
    .bind(device_id)
    .execute(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    let new_max: i64 = sqlx::query_scalar(
        "UPDATE sync_vector SET seq = seq + ?2 WHERE device_id = ?1 RETURNING seq",
    )
    .bind(device_id)
    .bind(count)
    .fetch_one(&mut **tx)
    .await
    .map_err(AppError::Database)?;
    let seq_base = new_max - count;
    // The row's stored clock stamp travels with the copy (NULL when none).
    let json_expr = format!(
        "json_set({}, '$.syncHlc',
            (SELECT h.wall_ms || ':' || h.counter FROM sync_row_hlc h
              WHERE h.entity_table = ?3 AND h.entity_id = CAST({key} AS TEXT)))",
        snapshot_pairs(table, &cols)
    );
    let created_at = chrono::Utc::now().to_rfc3339();
    let insert_sql = format!(
        "INSERT INTO sync_outbox
            (id, device_id, seq, entity_table, entity_id, op, payload_json, created_at, snapshot_for)
         SELECT lower(hex(randomblob(16))), ?1, ?2 + ROW_NUMBER() OVER (ORDER BY {key}),
                ?3, CAST({key} AS TEXT), 'UPDATE', {json_expr}, ?4, ?5
         FROM {from_sql}"
    );
    let inserted = sqlx::query(&insert_sql)
        .bind(device_id)
        .bind(seq_base)
        .bind(table)
        .bind(&created_at)
        .bind(requester)
        .execute(&mut **tx)
        .await
        .map_err(AppError::Database)?
        .rows_affected();
    if inserted as i64 != count {
        return Err(AppError::Internal(format!(
            "snapshot of {table}: counted {count} rows, copied {inserted}"
        )));
    }
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

/// Keep a foreign-key miss so a later page can apply it after the parent arrives.
/// Attempts stay put until the caller decides the snapshot is no longer moving.
pub async fn save_deferred_pull(pool: &SqlitePool, entry: &OutboxEntry) -> Result<(), AppError> {
    ensure_sync_tables(pool).await?;
    sqlx::query(
        "INSERT INTO sync_pull_failure (
            source_device_id, source_seq, attempts, payload_json, entity_table, entity_id, op,
            entry_created_at, entry_id
         ) VALUES (?1, ?2, 0, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(source_device_id, source_seq) DO UPDATE SET
            payload_json = excluded.payload_json,
            entity_table = excluded.entity_table,
            entity_id = excluded.entity_id,
            op = excluded.op,
            entry_created_at = excluded.entry_created_at,
            entry_id = excluded.entry_id",
    )
    .bind(&entry.device_id)
    .bind(entry.seq)
    .bind(&entry.payload_json)
    .bind(&entry.entity_table)
    .bind(&entry.entity_id)
    .bind(&entry.op)
    .bind(&entry.created_at)
    .bind(&entry.id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

pub async fn list_deferred_pulls(pool: &SqlitePool) -> Result<Vec<OutboxEntry>, AppError> {
    ensure_sync_tables(pool).await?;
    let rows = sqlx::query_as::<_, (String, String, i64, String, String, String, String, String)>(
        "SELECT entry_id, source_device_id, source_seq, entity_table, entity_id, op,
                payload_json, entry_created_at
         FROM sync_pull_failure
         WHERE payload_json IS NOT NULL AND TRIM(payload_json) != ''
         ORDER BY source_seq ASC",
    )
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

pub async fn bump_deferred_pull(
    pool: &SqlitePool,
    source_device_id: &str,
    source_seq: i64,
) -> Result<i64, AppError> {
    ensure_sync_tables(pool).await?;
    let attempts: i64 = sqlx::query_scalar(
        "UPDATE sync_pull_failure SET attempts = attempts + 1
         WHERE source_device_id = ?1 AND source_seq = ?2
         RETURNING attempts",
    )
    .bind(source_device_id)
    .bind(source_seq)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(attempts)
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
    let open_problems = crate::problems::open_count(pool).await.unwrap_or(0);
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
        initial_copy: None,
        open_problems,
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

// ---------------------------------------------------------------------------
// Outbox retention
// ---------------------------------------------------------------------------

/// Highest main-device sequence that pruning removed. A replica whose cursor
/// is below it cannot catch up from the outbox and receives a fresh copy.
pub const APP_KV_PRUNED_THROUGH: &str = "sync.outbox.pruned_through.v1";
/// Rows stay at least this long, whatever the cursors say.
const KEEP_DAYS: i64 = 7;
/// A replica not seen for this long no longer holds pruning back.
const STALE_REPLICA_DAYS: i64 = 180;

pub async fn pruned_through(pool: &SqlitePool) -> i64 {
    medoc_core::infrastructure::database::repos::admin::app_kv::get(pool, APP_KV_PRUNED_THROUGH)
        .await
        .ok()
        .flatten()
        .and_then(|v| v.parse().ok())
        .unwrap_or(0)
}

/// Delete outbox rows every reader has already received. Returns rows removed.
///
/// Main device: an untagged row goes once every active replica's cursor has
/// passed it; an initial-copy row once its own replica has passed it (or that
/// replica is gone). Replica: rows the main device confirmed, after
/// [`KEEP_DAYS`]. Mesh mode keeps everything (peers keep their own cursors).
pub async fn prune_outbox(pool: &SqlitePool) -> Result<u64, AppError> {
    ensure_sync_tables(pool).await?;
    let deployment = load_deployment(pool).await?;
    if deployment.unstable_mesh {
        return Ok(0);
    }
    let local_id = ensure_local_device(pool, &deployment.device_label).await?;
    let keep_after = (Utc::now() - chrono::Duration::days(KEEP_DAYS)).to_rfc3339();
    let mut removed = 0u64;
    if deployment.role == crate::deployment::DeviceRole::Replica {
        removed += sqlx::query(
            "DELETE FROM sync_outbox
             WHERE device_id = ?1 AND delivered_at IS NOT NULL AND delivered_at < ?2",
        )
        .bind(&local_id)
        .bind(&keep_after)
        .execute(pool)
        .await
        .map_err(AppError::Database)?
        .rows_affected();
    } else {
        // `last_seen_at` is written as SQLite CURRENT_TIMESTAMP; compare alike.
        let stale = (Utc::now() - chrono::Duration::days(STALE_REPLICA_DAYS))
            .format("%Y-%m-%d %H:%M:%S")
            .to_string();
        let cursors: Vec<(String, i64)> = sqlx::query_as(
            "SELECT d.device_id, COALESCE(v.through_seq, 0)
             FROM sync_device d
             LEFT JOIN sync_peer_vector v
               ON v.source_device_id = ?1 AND v.target_device_id = d.device_id
             WHERE d.is_local = 0 AND d.role = 'REPLICA'
               AND (d.last_seen_at IS NULL OR d.last_seen_at >= ?2)",
        )
        .bind(&local_id)
        .bind(&stale)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        let floor = match cursors.iter().map(|(_, c)| *c).min() {
            Some(min) => min,
            // Nobody reads this outbox: everything older than the window may go.
            None => i64::MAX,
        };
        let deleted_max: Option<i64> = sqlx::query_scalar(
            "SELECT MAX(seq) FROM sync_outbox
             WHERE device_id = ?1 AND snapshot_for IS NULL AND seq <= ?2 AND created_at < ?3",
        )
        .bind(&local_id)
        .bind(floor)
        .bind(&keep_after)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        removed += sqlx::query(
            "DELETE FROM sync_outbox
             WHERE device_id = ?1 AND snapshot_for IS NULL AND seq <= ?2 AND created_at < ?3",
        )
        .bind(&local_id)
        .bind(floor)
        .bind(&keep_after)
        .execute(pool)
        .await
        .map_err(AppError::Database)?
        .rows_affected();
        // Copy rows: gone once their replica passed them, or the replica is gone.
        let active: Vec<String> = cursors.iter().map(|(id, _)| id.clone()).collect();
        let tagged: Vec<(String, i64)> = sqlx::query_as(
            "SELECT snapshot_for, MAX(seq) FROM sync_outbox
             WHERE device_id = ?1 AND snapshot_for IS NOT NULL AND created_at < ?2
             GROUP BY snapshot_for",
        )
        .bind(&local_id)
        .bind(&keep_after)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
        for (reader, _) in tagged {
            let through = if active.contains(&reader) {
                cursors
                    .iter()
                    .find(|(id, _)| *id == reader)
                    .map(|(_, c)| *c)
                    .unwrap_or(0)
            } else {
                i64::MAX
            };
            removed += sqlx::query(
                "DELETE FROM sync_outbox
                 WHERE device_id = ?1 AND snapshot_for = ?2 AND seq <= ?3 AND created_at < ?4",
            )
            .bind(&local_id)
            .bind(&reader)
            .bind(through)
            .bind(&keep_after)
            .execute(pool)
            .await
            .map_err(AppError::Database)?
            .rows_affected();
        }
        if let Some(max) = deleted_max {
            if max > pruned_through(pool).await {
                medoc_core::infrastructure::database::repos::admin::app_kv::set(
                    pool,
                    APP_KV_PRUNED_THROUGH,
                    &max.to_string(),
                )
                .await?;
            }
        }
    }
    medoc_core::infrastructure::database::migrations::ensure_packet_queue(pool).await?;
    sqlx::query(
        "DELETE FROM sync_packet_queue WHERE outbox_id NOT IN (SELECT id FROM sync_outbox)",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    // Dedupe marks far behind every cursor are no longer consulted.
    sqlx::query("DELETE FROM sync_applied WHERE applied_at < datetime('now', '-180 days')")
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    if removed > 0 {
        tracing::info!(target: "medoc::sync", event = "SYNC_OUTBOX_PRUNED", rows = removed);
    }
    Ok(removed)
}

/// Run [`prune_outbox`] at most once an hour per process. Never fails the caller.
pub async fn maybe_prune_outbox(pool: &SqlitePool) {
    static LAST: std::sync::Mutex<Option<std::time::Instant>> = std::sync::Mutex::new(None);
    {
        let mut last = match LAST.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        if last.is_some_and(|t| t.elapsed() < std::time::Duration::from_secs(3600)) {
            return;
        }
        *last = Some(std::time::Instant::now());
    }
    if let Err(e) = prune_outbox(pool).await {
        tracing::warn!(target: "medoc::sync", event = "SYNC_OUTBOX_PRUNE_FAILED", error = %e);
    }
}
