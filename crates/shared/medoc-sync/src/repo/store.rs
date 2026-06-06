use std::collections::HashMap;

use chrono::Utc;
use medoc_core::error::AppError;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::deployment::{
    DeviceRole, SyncDeploymentConfig, APP_KV_DEPLOYMENT_KEY, APP_KV_DEVICE_ID_KEY,
};
use crate::schema::ensure_sync_tables;

use super::types::{OutboxEntry, SyncPeer, SyncStatusSnapshot, SYNCED_TABLES};

pub async fn ensure_local_device(pool: &SqlitePool, label: &str) -> Result<String, AppError> {
    ensure_sync_tables(pool).await?;
    let existing =
        medoc_core::infrastructure::database::app_kv_repo::get(pool, APP_KV_DEVICE_ID_KEY).await?;
    if let Some(id) = existing.filter(|s| !s.is_empty()) {
        register_device_row(pool, &id, label, DeviceRole::Master, true, None, None).await?;
        return Ok(id);
    }
    let id = Uuid::new_v4().to_string();
    medoc_core::infrastructure::database::app_kv_repo::set(pool, APP_KV_DEVICE_ID_KEY, &id).await?;
    register_device_row(pool, &id, label, DeviceRole::Master, true, None, None).await?;
    Ok(id)
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
    if !SYNCED_TABLES.contains(&entity_table) {
        return Ok(());
    }
    let deployment = load_deployment(pool).await.unwrap_or_default();
    if deployment.mode != crate::deployment::DeploymentMode::ServerlessPeer {
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
) -> Result<Vec<OutboxEntry>, AppError> {
    let rows = sqlx::query_as::<_, (String, String, i64, String, String, String, String, String)>(
        "SELECT id, device_id, seq, entity_table, entity_id, op, payload_json, created_at
         FROM sync_outbox
         WHERE device_id = ?1 AND delivered_at IS NULL
         ORDER BY seq ASC",
    )
    .bind(device_id)
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
         ORDER BY seq ASC",
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
