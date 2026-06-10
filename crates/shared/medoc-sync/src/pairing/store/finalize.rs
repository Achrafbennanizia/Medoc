//! Post-PIN acceptance — mint token, permissions, sync registry.

use chrono::Utc;
use ed25519_dalek::SigningKey;
use medoc_core::error::AppError;
use sqlx::SqlitePool;
use uuid::Uuid;

use super::super::policy::{peer_base_url_from_ip, sanitise_actions};
use super::super::token::mint_activation_token;
use super::super::types::{ActivationTokenPayload, PairingRequest};
use super::load_by_id;

pub(super) async fn finalize_accept(
    pool: &SqlitePool,
    master_device_id: &str,
    request_id: &str,
    request: &PairingRequest,
    replica_http_port: u16,
    signing_key: &SigningKey,
) -> Result<PairingRequest, AppError> {
    let now = Utc::now().to_rfc3339();
    let actions = sanitise_actions(&request.allowed_actions);
    let payload = ActivationTokenPayload {
        version: 2,
        device_id: request.device_id.clone(),
        slave_label: request.slave_label.clone(),
        master_device_id: master_device_id.to_string(),
        allowed_actions: actions.clone(),
        issued_at: now.clone(),
        nonce: Uuid::new_v4().to_string(),
    };
    let token = mint_activation_token(signing_key, &payload)?;

    sqlx::query(
        "UPDATE pairing_request SET status = 'ACCEPTED',
            activation_token = ?1,
            confirm_pin_hash = NULL,
            confirm_pin_expires_at = NULL,
            confirm_pin_attempts = 0
         WHERE id = ?2",
    )
    .bind(&token)
    .bind(request_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

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
        .bind(request.decided_by.as_deref().unwrap_or("master"))
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }

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
        .ok_or_else(|| AppError::Internal("pairing_request disappeared after confirm".into()))
}
