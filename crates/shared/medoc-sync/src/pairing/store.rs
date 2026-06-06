//! SQLite persistence for pairing requests and slave permissions.

use chrono::Utc;
use medoc_core::error::AppError;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::master_keys;
use crate::schema::ensure_sync_tables;

use super::policy::{is_pairing_enabled, peer_base_url_from_ip, sanitise_actions};
use super::token::mint_activation_token;
use super::types::{ActivationTokenPayload, PairingDecision, PairingRequest, PairingRequestSubmit};

pub async fn submit_request(
    pool: &SqlitePool,
    submit: PairingRequestSubmit,
) -> Result<PairingRequest, AppError> {
    ensure_sync_tables(pool).await?;
    if !is_pairing_enabled(pool).await? {
        return Err(AppError::Forbidden);
    }
    if submit.device_id.trim().is_empty() {
        return Err(AppError::Validation("device_id leer".into()));
    }
    if submit.slave_pubkey.trim().is_empty() {
        return Err(AppError::Validation("slave_pubkey leer".into()));
    }

    let existing: Option<(String, String)> =
        sqlx::query_as("SELECT id, status FROM pairing_request WHERE device_id = ?1")
            .bind(&submit.device_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;

    let now = Utc::now().to_rfc3339();

    if let Some((existing_id, status)) = existing {
        if status == "ACCEPTED" {
            // Already paired — return the existing row unchanged.
            return load_by_id(pool, &existing_id).await?.ok_or_else(|| {
                AppError::Internal("pairing_request disappeared during read".into())
            });
        }
        // Reset to PENDING with the latest pubkey/label.
        sqlx::query(
            "UPDATE pairing_request SET
                slave_pubkey = ?1,
                slave_label = ?2,
                requester_ip = ?3,
                status = 'PENDING',
                allowed_actions_json = '[]',
                activation_token = NULL,
                requested_at = ?4,
                decided_at = NULL,
                decided_by = NULL
             WHERE id = ?5",
        )
        .bind(&submit.slave_pubkey)
        .bind(&submit.slave_label)
        .bind(&submit.requester_ip)
        .bind(&now)
        .bind(&existing_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        return load_by_id(pool, &existing_id)
            .await?
            .ok_or_else(|| AppError::Internal("pairing_request disappeared after update".into()));
    }

    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO pairing_request (
            id, device_id, slave_pubkey, slave_label, requester_ip,
            status, allowed_actions_json, requested_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, 'PENDING', '[]', ?6)",
    )
    .bind(&id)
    .bind(&submit.device_id)
    .bind(&submit.slave_pubkey)
    .bind(&submit.slave_label)
    .bind(&submit.requester_ip)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    load_by_id(pool, &id).await?.ok_or_else(|| {
        AppError::Internal("pairing_request lookup after insert returned None".into())
    })
}

pub async fn list_pending(pool: &SqlitePool) -> Result<Vec<PairingRequest>, AppError> {
    ensure_sync_tables(pool).await?;
    list_by_status(pool, "PENDING").await
}

pub async fn list_all(pool: &SqlitePool) -> Result<Vec<PairingRequest>, AppError> {
    ensure_sync_tables(pool).await?;
    let rows: Vec<RawRow> = sqlx::query_as(
        "SELECT id, device_id, slave_pubkey, slave_label, requester_ip, status,
                allowed_actions_json, activation_token, requested_at, decided_at, decided_by
         FROM pairing_request ORDER BY requested_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows.into_iter().map(Into::into).collect())
}

async fn list_by_status(pool: &SqlitePool, status: &str) -> Result<Vec<PairingRequest>, AppError> {
    let rows: Vec<RawRow> = sqlx::query_as(
        "SELECT id, device_id, slave_pubkey, slave_label, requester_ip, status,
                allowed_actions_json, activation_token, requested_at, decided_at, decided_by
         FROM pairing_request WHERE status = ?1 ORDER BY requested_at ASC",
    )
    .bind(status)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn load_by_id(pool: &SqlitePool, id: &str) -> Result<Option<PairingRequest>, AppError> {
    ensure_sync_tables(pool).await?;
    let row: Option<RawRow> = sqlx::query_as(
        "SELECT id, device_id, slave_pubkey, slave_label, requester_ip, status,
                allowed_actions_json, activation_token, requested_at, decided_at, decided_by
         FROM pairing_request WHERE id = ?1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(row.map(Into::into))
}

pub async fn load_by_device(
    pool: &SqlitePool,
    device_id: &str,
) -> Result<Option<PairingRequest>, AppError> {
    ensure_sync_tables(pool).await?;
    let row: Option<RawRow> = sqlx::query_as(
        "SELECT id, device_id, slave_pubkey, slave_label, requester_ip, status,
                allowed_actions_json, activation_token, requested_at, decided_at, decided_by
         FROM pairing_request WHERE device_id = ?1",
    )
    .bind(device_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(row.map(Into::into))
}

/// Master decides on a pending request. On accept, mints an activation
/// token signed by the master Ed25519 key and writes per-slave permissions.
pub async fn decide(
    pool: &SqlitePool,
    master_device_id: &str,
    request_id: &str,
    decision: PairingDecision,
    replica_http_port: u16,
) -> Result<PairingRequest, AppError> {
    let request = load_by_id(pool, request_id)
        .await?
        .ok_or_else(|| AppError::NotFound("pairing_request".into()))?;
    if request.status != "PENDING" {
        return Err(AppError::Conflict(format!(
            "pairing_request bereits entschieden (status={})",
            request.status
        )));
    }

    let now = Utc::now().to_rfc3339();
    if !decision.accept {
        sqlx::query(
            "UPDATE pairing_request SET status = 'REJECTED', decided_at = ?1, decided_by = ?2 WHERE id = ?3",
        )
        .bind(&now)
        .bind(&decision.decided_by)
        .bind(request_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        return load_by_id(pool, request_id)
            .await?
            .ok_or_else(|| AppError::Internal("pairing_request disappeared after reject".into()));
    }

    let actions = sanitise_actions(&decision.allowed_actions);
    let actions_json = serde_json::to_string(&actions)
        .map_err(|e| AppError::Internal(format!("actions json: {e}")))?;

    let signing_key = master_keys::load_or_create()?;
    let payload = ActivationTokenPayload {
        version: 2,
        device_id: request.device_id.clone(),
        slave_label: request.slave_label.clone(),
        master_device_id: master_device_id.to_string(),
        allowed_actions: actions.clone(),
        issued_at: now.clone(),
        nonce: Uuid::new_v4().to_string(),
    };
    let token = mint_activation_token(&signing_key, &payload)?;

    sqlx::query(
        "UPDATE pairing_request SET status = 'ACCEPTED',
            allowed_actions_json = ?1,
            activation_token = ?2,
            decided_at = ?3,
            decided_by = ?4
         WHERE id = ?5",
    )
    .bind(&actions_json)
    .bind(&token)
    .bind(&now)
    .bind(&decision.decided_by)
    .bind(request_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    // Replace existing permissions for this slave.
    sqlx::query("DELETE FROM slave_permission WHERE device_id = ?1")
        .bind(&request.device_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    for action in &actions {
        sqlx::query(
            "INSERT INTO slave_permission (device_id, action, granted_at, granted_by)
             VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(&request.device_id)
        .bind(action)
        .bind(&now)
        .bind(&decision.decided_by)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

    // Register the slave in the sync_device registry so master/replica pull
    // can discover it. The slave updates its own row on first contact too.
    let peer_base_url = peer_base_url_from_ip(&request.requester_ip, replica_http_port);
    sqlx::query(
        "INSERT INTO sync_device (device_id, display_name, role, is_local, peer_base_url, last_seen_at)
         VALUES (?1, ?2, 'REPLICA', 0, ?3, ?4)
         ON CONFLICT(device_id) DO UPDATE SET
             display_name = excluded.display_name,
             role = 'REPLICA',
             is_local = 0,
             peer_base_url = COALESCE(excluded.peer_base_url, sync_device.peer_base_url),
             last_seen_at = excluded.last_seen_at",
    )
    .bind(&request.device_id)
    .bind(&request.slave_label)
    .bind(&peer_base_url)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query("INSERT OR IGNORE INTO sync_vector (device_id, seq) VALUES (?1, 0)")
        .bind(&request.device_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;

    load_by_id(pool, request_id)
        .await?
        .ok_or_else(|| AppError::Internal("pairing_request disappeared after accept".into()))
}

/// Revoke a previously-accepted pairing.
pub async fn revoke(
    pool: &SqlitePool,
    master_device_id: &str,
    device_id: &str,
    decided_by: &str,
) -> Result<(), AppError> {
    let _ = master_device_id;
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE pairing_request SET status = 'REVOKED', activation_token = NULL,
            decided_at = ?1, decided_by = ?2
         WHERE device_id = ?3 AND status = 'ACCEPTED'",
    )
    .bind(&now)
    .bind(decided_by)
    .bind(device_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query("DELETE FROM slave_permission WHERE device_id = ?1")
        .bind(device_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(())
}
#[derive(sqlx::FromRow)]
struct RawRow {
    id: String,
    device_id: String,
    slave_pubkey: String,
    slave_label: String,
    requester_ip: String,
    status: String,
    allowed_actions_json: String,
    activation_token: Option<String>,
    requested_at: String,
    decided_at: Option<String>,
    decided_by: Option<String>,
}

impl From<RawRow> for PairingRequest {
    fn from(r: RawRow) -> Self {
        let actions: Vec<String> =
            serde_json::from_str(&r.allowed_actions_json).unwrap_or_default();
        Self {
            id: r.id,
            device_id: r.device_id,
            slave_pubkey: r.slave_pubkey,
            slave_label: r.slave_label,
            requester_ip: r.requester_ip,
            status: r.status,
            allowed_actions: actions,
            activation_token: r.activation_token,
            requested_at: r.requested_at,
            decided_at: r.decided_at,
            decided_by: r.decided_by,
        }
    }
}
