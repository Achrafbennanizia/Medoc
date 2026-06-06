//! Peer replication + pairing DDL (serverless mode).
//!
//! Kept in medoc-core so migrations do not depend on medoc-sync.

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

pub(super) async fn ensure_sync_replication_tables(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_device (
            device_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL DEFAULT '',
            role TEXT NOT NULL DEFAULT 'MASTER' CHECK (role IN ('MASTER','REPLICA')),
            is_local INTEGER NOT NULL DEFAULT 0 CHECK (is_local IN (0, 1)),
            peer_base_url TEXT,
            peer_cert_sha256 TEXT,
            last_seen_at TEXT,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_vector (
            device_id TEXT PRIMARY KEY REFERENCES sync_device(device_id) ON DELETE CASCADE,
            seq INTEGER NOT NULL DEFAULT 0
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_outbox (
            id TEXT PRIMARY KEY,
            device_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            entity_table TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            op TEXT NOT NULL CHECK (op IN ('INSERT','UPDATE','DELETE')),
            payload_json TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            delivered_at TEXT,
            UNIQUE(device_id, seq)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending ON sync_outbox(device_id, delivered_at)",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_applied (
            source_device_id TEXT NOT NULL,
            source_seq INTEGER NOT NULL,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (source_device_id, source_seq)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sync_peer_vector (
            source_device_id TEXT NOT NULL,
            target_device_id TEXT NOT NULL,
            through_seq INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (source_device_id, target_device_id)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    // Pairing inbox + per-slave RBAC (NFA-NET-09).
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS pairing_request (
            id TEXT PRIMARY KEY,
            device_id TEXT NOT NULL,
            slave_pubkey TEXT NOT NULL,
            slave_label TEXT NOT NULL DEFAULT '',
            requester_ip TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL CHECK (status IN ('PENDING','ACCEPTED','REJECTED','REVOKED')) DEFAULT 'PENDING',
            allowed_actions_json TEXT NOT NULL DEFAULT '[]',
            activation_token TEXT,
            requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            decided_at TEXT,
            decided_by TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_pairing_request_status ON pairing_request(status, requested_at)",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_pairing_request_device ON pairing_request(device_id)",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS slave_permission (
            device_id TEXT NOT NULL,
            action TEXT NOT NULL,
            granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            granted_by TEXT,
            PRIMARY KEY (device_id, action)
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}
