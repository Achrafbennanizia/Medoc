//! Device-cluster (Geräteverbund) DDL — cluster license, device registry extensions, blocklist, provisioning.

use sqlx::sqlite::SqlitePool;

use crate::error::AppError;

/// Idempotent schema for the device cluster / Geräteverbund (evolution of sync/pairing tables).
pub async fn ensure_verbund_tables(pool: &SqlitePool) -> Result<(), AppError> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS lizenz (
            cluster_id      TEXT PRIMARY KEY,
            license_ref     TEXT NOT NULL,
            signing_key_enc BLOB NOT NULL,
            max_total       INTEGER NOT NULL DEFAULT 10,
            max_admin       INTEGER NOT NULL DEFAULT 3,
            max_member      INTEGER NOT NULL DEFAULT 7,
            activated_at    TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS geraet_blocklist (
            fingerprint   TEXT PRIMARY KEY,
            reason        TEXT NOT NULL,
            blocked_at    TEXT NOT NULL
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS provisioning_state (
            fingerprint   TEXT PRIMARY KEY,
            provisioned   INTEGER NOT NULL DEFAULT 0,
            counter       INTEGER NOT NULL DEFAULT 0,
            provisioned_at TEXT
        )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    // Extend sync_device → geraet registry (additive columns).
    for (table, col, ddl) in [
        (
            "sync_device",
            "fingerprint",
            "ALTER TABLE sync_device ADD COLUMN fingerprint TEXT",
        ),
        (
            "sync_device",
            "pubkey",
            "ALTER TABLE sync_device ADD COLUMN pubkey BLOB",
        ),
        (
            "sync_device",
            "hostname",
            "ALTER TABLE sync_device ADD COLUMN hostname TEXT",
        ),
        (
            "sync_device",
            "os",
            "ALTER TABLE sync_device ADD COLUMN os TEXT",
        ),
        (
            "sync_device",
            "last_ip",
            "ALTER TABLE sync_device ADD COLUMN last_ip TEXT",
        ),
        (
            "sync_device",
            "seat_role",
            "ALTER TABLE sync_device ADD COLUMN seat_role TEXT CHECK (seat_role IN ('ADMIN','MEMBER'))",
        ),
        (
            "sync_device",
            "geraet_status",
            "ALTER TABLE sync_device ADD COLUMN geraet_status TEXT CHECK (geraet_status IN ('PENDING','ACTIVE','REVOKED','BLOCKED'))",
        ),
        (
            "sync_device",
            "seat_cert",
            "ALTER TABLE sync_device ADD COLUMN seat_cert BLOB",
        ),
        (
            "sync_device",
            "cluster_id",
            "ALTER TABLE sync_device ADD COLUMN cluster_id TEXT",
        ),
        (
            "pairing_request",
            "kopplung_state",
            "ALTER TABLE pairing_request ADD COLUMN kopplung_state TEXT",
        ),
        (
            "pairing_request",
            "sas_hash",
            "ALTER TABLE pairing_request ADD COLUMN sas_hash BLOB",
        ),
        (
            "pairing_request",
            "requested_role",
            "ALTER TABLE pairing_request ADD COLUMN requested_role TEXT CHECK (requested_role IN ('ADMIN','MEMBER'))",
        ),
        (
            "pairing_request",
            "expires_at",
            "ALTER TABLE pairing_request ADD COLUMN expires_at TEXT",
        ),
        (
            "pairing_request",
            "fingerprint",
            "ALTER TABLE pairing_request ADD COLUMN fingerprint TEXT",
        ),
        (
            "pairing_request",
            "hostname",
            "ALTER TABLE pairing_request ADD COLUMN hostname TEXT",
        ),
        (
            "pairing_request",
            "os_name",
            "ALTER TABLE pairing_request ADD COLUMN os_name TEXT",
        ),
        (
            "pairing_request",
            "app_version",
            "ALTER TABLE pairing_request ADD COLUMN app_version TEXT",
        ),
        (
            "pairing_request",
            "handshake_transcript_b64",
            "ALTER TABLE pairing_request ADD COLUMN handshake_transcript_b64 TEXT",
        ),
    ] {
        if let Err(e) = sqlx::query(ddl).execute(pool).await {
            let msg = e.to_string();
            if msg.contains("duplicate column") {
                tracing::debug!(
                    target: "medoc::system",
                    event = "MIGRATION_COLUMN_EXISTS",
                    table,
                    column = col
                );
            } else {
                return Err(AppError::Database(e));
            }
        }
    }

    // Backfill seat_role from legacy role column.
    sqlx::query(
        "UPDATE sync_device SET seat_role = CASE role
            WHEN 'MASTER' THEN 'ADMIN'
            WHEN 'REPLICA' THEN 'MEMBER'
            ELSE seat_role END
         WHERE seat_role IS NULL",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    sqlx::query(
        "UPDATE sync_device SET geraet_status = 'ACTIVE'
         WHERE geraet_status IS NULL AND is_local = 1",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    // Legacy rows without Geräteverbund identity must re-provision (forced re-pair).
    sqlx::query(
        "UPDATE sync_device SET geraet_status = 'PENDING'
         WHERE geraet_status IN ('ACTIVE', 'PENDING')
           AND (
             fingerprint IS NULL OR TRIM(fingerprint) = ''
             OR pubkey IS NULL OR length(pubkey) != 32
             OR pubkey = X'0000000000000000000000000000000000000000000000000000000000000000'
           )",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    Ok(())
}
