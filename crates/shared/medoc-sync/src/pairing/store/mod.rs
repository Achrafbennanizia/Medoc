//! SQLite persistence for pairing requests and slave permissions.

mod finalize;
mod row;

use chrono::Utc;
use medoc_core::error::AppError;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::master_keys;
use crate::schema::ensure_sync_tables;

use super::pin::{
    generate_confirm_pin_random, hash_confirm_pin, normalise_pin_input, verify_confirm_pin,
    CONFIRM_PIN_MAX_ATTEMPTS, CONFIRM_PIN_TTL_SECS,
};
use super::policy::{is_pairing_enabled, sanitise_actions};
use super::types::{PairingDecideResult, PairingDecision, PairingRequest, PairingRequestSubmit};

use row::{RawRow, PAIRING_SELECT};

pub async fn submit_request(
    pool: &SqlitePool,
    submit: PairingRequestSubmit,
) -> Result<PairingRequest, AppError> {
    ensure_sync_tables(pool).await?;
    if !is_pairing_enabled(pool).await? {
        return Err(AppError::Forbidden);
    }
    if submit.device_id.trim().is_empty() {
        return Err(AppError::validation_code("error.pairing.device_id_empty"));
    }
    if submit.slave_pubkey.trim().is_empty() {
        return Err(AppError::validation_code(
            "error.pairing.slave_pubkey_empty",
        ));
    }

    let existing: Option<(String, String, Option<String>)> =
        sqlx::query_as("SELECT id, status, slave_pubkey FROM pairing_request WHERE device_id = ?1")
            .bind(&submit.device_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;

    let now = Utc::now().to_rfc3339();
    let slave_label = submit.slave_label.trim().to_string();
    let requester_ip = super::policy::canonical_ip_str(&submit.requester_ip);

    if let Some((existing_id, status, existing_key)) = existing {
        if status == "ACCEPTED" {
            return load_by_id(pool, &existing_id).await?.ok_or_else(|| {
                AppError::Internal("pairing_request disappeared during read".into())
            });
        }
        // `device_id` is not secret. Overwriting the key of an open request
        // let any LAN host swap in its own key just before the admin accepts
        // (and inherit the token). A pending request can only be refreshed
        // with the same key; other keys must wait until it is decided.
        let same_key = existing_key.as_deref().map(str::trim) == Some(submit.slave_pubkey.trim());
        if status == "PENDING" && !same_key {
            return Err(AppError::Conflict(
                "A pairing request for this device is already pending".into(),
            ));
        }
        sqlx::query(
            "UPDATE pairing_request SET
                slave_pubkey = ?1,
                slave_label = ?2,
                requester_ip = ?3,
                transport = ?4,
                status = 'PENDING',
                allowed_actions_json = '[]',
                activation_token = NULL,
                confirm_pin_hash = NULL,
                confirm_pin_expires_at = NULL,
                confirm_pin_attempts = 0,
                requested_at = ?5,
                decided_at = NULL,
                decided_by = NULL
             WHERE id = ?6",
        )
        .bind(&submit.slave_pubkey)
        .bind(&slave_label)
        .bind(&requester_ip)
        .bind(&submit.transport)
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
            id, device_id, slave_pubkey, slave_label, requester_ip, transport,
            status, allowed_actions_json, requested_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'PENDING', '[]', ?7)",
    )
    .bind(&id)
    .bind(&submit.device_id)
    .bind(&submit.slave_pubkey)
    .bind(&slave_label)
    .bind(&requester_ip)
    .bind(&submit.transport)
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
    let sql = format!("{PAIRING_SELECT} FROM pairing_request ORDER BY requested_at DESC");
    let rows: Vec<RawRow> = sqlx::query_as(&sql)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(rows.into_iter().map(Into::into).collect())
}

async fn list_by_status(pool: &SqlitePool, status: &str) -> Result<Vec<PairingRequest>, AppError> {
    let sql = format!(
        "{PAIRING_SELECT} FROM pairing_request WHERE status = ?1 ORDER BY requested_at ASC"
    );
    let rows: Vec<RawRow> = sqlx::query_as(&sql)
        .bind(status)
        .fetch_all(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn load_by_id(pool: &SqlitePool, id: &str) -> Result<Option<PairingRequest>, AppError> {
    ensure_sync_tables(pool).await?;
    let sql = format!("{PAIRING_SELECT} FROM pairing_request WHERE id = ?1");
    let row: Option<RawRow> = sqlx::query_as(&sql)
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
    let sql = format!("{PAIRING_SELECT} FROM pairing_request WHERE device_id = ?1");
    let row: Option<RawRow> = sqlx::query_as(&sql)
        .bind(device_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
    Ok(row.map(Into::into))
}

/// Master decides on a pending request. On accept, generates a 4-digit PIN shown
/// on the master; the replica must confirm it before the activation token is minted.
pub async fn decide(
    pool: &SqlitePool,
    master_device_id: &str,
    request_id: &str,
    decision: PairingDecision,
    replica_http_port: u16,
) -> Result<PairingDecideResult, AppError> {
    let _ = (master_device_id, replica_http_port);
    let request = load_by_id(pool, request_id)
        .await?
        .ok_or_else(|| AppError::NotFound("pairing_request".into()))?;
    if request.status != "PENDING" {
        return Err(AppError::Conflict(format!(
            "pairing_request already decided (status={})",
            request.status
        )));
    }
    if request.awaiting_pin {
        return Err(AppError::Conflict(
            "pairing_request already awaiting PIN confirmation".into(),
        ));
    }

    let now = Utc::now().to_rfc3339();
    if !decision.accept {
        sqlx::query(
            "UPDATE pairing_request SET status = 'REJECTED', decided_at = ?1, decided_by = ?2,
                confirm_pin_hash = NULL, confirm_pin_expires_at = NULL, confirm_pin_attempts = 0
             WHERE id = ?3",
        )
        .bind(&now)
        .bind(&decision.decided_by)
        .bind(request_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
        let row = load_by_id(pool, request_id)
            .await?
            .ok_or_else(|| AppError::Internal("pairing_request disappeared after reject".into()))?;
        return Ok(PairingDecideResult {
            request: row,
            confirm_pin: None,
        });
    }

    let actions = sanitise_actions(&decision.allowed_actions);
    let actions_json = serde_json::to_string(&actions)
        .map_err(|e| AppError::Internal(format!("actions json: {e}")))?;

    let signing_key = master_keys::load_or_create()?;
    // Same 4 digits as cluster `expected_sas` when a Noise transcript is stored.
    // A random PIN here is a different code and the replica cannot activate with it.
    let pin = confirm_pin_matching_handshake(pool, request_id).await?;
    let pin_hash = hash_confirm_pin(request_id, &pin, &signing_key.to_bytes());
    let expires_at = (Utc::now() + chrono::Duration::seconds(CONFIRM_PIN_TTL_SECS)).to_rfc3339();

    sqlx::query(
        "UPDATE pairing_request SET
            allowed_actions_json = ?1,
            confirm_pin_hash = ?2,
            confirm_pin_expires_at = ?3,
            confirm_pin_attempts = 0,
            decided_at = ?4,
            decided_by = ?5
         WHERE id = ?6",
    )
    .bind(&actions_json)
    .bind(&pin_hash)
    .bind(&expires_at)
    .bind(&now)
    .bind(&decision.decided_by)
    .bind(request_id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;

    let row = load_by_id(pool, request_id)
        .await?
        .ok_or_else(|| AppError::Internal("pairing_request disappeared after accept".into()))?;
    Ok(PairingDecideResult {
        request: row,
        confirm_pin: Some(pin),
    })
}

async fn confirm_pin_matching_handshake(
    pool: &SqlitePool,
    request_id: &str,
) -> Result<String, AppError> {
    let row: Option<(Option<String>, Option<String>)> = sqlx::query_as(
        "SELECT handshake_transcript_b64, pairing_state FROM pairing_request WHERE id = ?1",
    )
    .bind(request_id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    let Some((b64, pairing_state)) = row else {
        return Ok(generate_confirm_pin_random());
    };
    if let Some(raw) = b64 {
        if let Some(bytes) = crate::cluster::crypto::decode_handshake_transcript(&raw) {
            if !bytes.is_empty() {
                return Ok(crate::cluster::crypto::derive_sas_from_transcript(&bytes));
            }
        }
    }
    if row::is_cluster_sas_state(pairing_state.as_deref()) {
        return Err(AppError::Validation(
            "Cluster handshake missing; send a new join request from the replica.".into(),
        ));
    }
    Ok(generate_confirm_pin_random())
}

/// Replica confirms the 4-digit PIN; master mints activation token on success.
pub async fn confirm_pin(
    pool: &SqlitePool,
    master_device_id: &str,
    request_id: &str,
    pin_raw: &str,
    replica_http_port: u16,
) -> Result<PairingRequest, AppError> {
    let pin = normalise_pin_input(pin_raw)
        .ok_or_else(|| AppError::validation_code("error.pairing.pin_format"))?;

    let request = load_by_id(pool, request_id)
        .await?
        .ok_or_else(|| AppError::NotFound("pairing_request".into()))?;
    if request.status != "PENDING" || !request.awaiting_pin {
        return Err(AppError::Conflict(
            "pairing_request is not awaiting PIN confirmation".into(),
        ));
    }

    let pin_hash: Option<String> =
        sqlx::query_scalar("SELECT confirm_pin_hash FROM pairing_request WHERE id = ?1")
            .bind(request_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?
            .flatten();

    let pin_hash = pin_hash.ok_or_else(|| {
        AppError::Internal("pairing_request awaiting_pin without confirm_pin_hash".into())
    })?;

    let expires_at: Option<String> =
        sqlx::query_scalar("SELECT confirm_pin_expires_at FROM pairing_request WHERE id = ?1")
            .bind(request_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?
            .flatten();

    if let Some(exp) = expires_at {
        if let Ok(exp_dt) = chrono::DateTime::parse_from_rfc3339(&exp) {
            if exp_dt < Utc::now() {
                sqlx::query(
                    "UPDATE pairing_request SET confirm_pin_hash = NULL, confirm_pin_expires_at = NULL
                     WHERE id = ?1",
                )
                .bind(request_id)
                .execute(pool)
                .await
                .map_err(AppError::Database)?;
                return Err(AppError::validation_code("error.pairing.code_expired"));
            }
        }
    }

    // Consume one attempt atomically *before* checking the PIN. A separate
    // read-then-increment let parallel requests all see `attempts = 0` and
    // try every 4-digit PIN within the limit window.
    let consumed = sqlx::query(
        "UPDATE pairing_request SET confirm_pin_attempts = confirm_pin_attempts + 1
         WHERE id = ?1 AND confirm_pin_attempts < ?2",
    )
    .bind(request_id)
    .bind(CONFIRM_PIN_MAX_ATTEMPTS)
    .execute(pool)
    .await
    .map_err(AppError::Database)?
    .rows_affected();
    if consumed == 0 {
        return Err(AppError::Validation(
            "Too many PIN attempts — submit a new pairing request".into(),
        ));
    }

    let signing_key = master_keys::load_or_create()?;
    if !verify_confirm_pin(request_id, &pin, &pin_hash, &signing_key.to_bytes()) {
        return Err(AppError::validation_code("error.pairing.code_wrong"));
    }

    finalize::finalize_accept(
        pool,
        master_device_id,
        request_id,
        &request,
        replica_http_port,
        &signing_key,
    )
    .await
}

/// Revoke a previously-accepted pairing.
///
/// `device_id` may be the replica device id, its fingerprint, or the
/// pairing-request id. The accepted row, its permissions, and the live
/// `sync_device` seat are all cleared. A miss is an error — a silent
/// no-op left the device paired.
pub async fn revoke(
    pool: &SqlitePool,
    master_device_id: &str,
    device_id: &str,
    decided_by: &str,
) -> Result<(), AppError> {
    let _ = master_device_id;
    ensure_sync_tables(pool).await?;
    let key = device_id.trim();
    if key.is_empty() {
        return Err(AppError::validation_code("error.pairing.device_id_empty"));
    }
    let now = Utc::now().to_rfc3339();
    let updated = sqlx::query(
        "UPDATE pairing_request SET status = 'REVOKED', activation_token = NULL,
            decided_at = ?1, decided_by = ?2
         WHERE status = 'ACCEPTED'
           AND (
                id = ?3
                OR TRIM(device_id) = ?3
                OR TRIM(IFNULL(fingerprint, '')) = ?3
           )",
    )
    .bind(&now)
    .bind(decided_by)
    .bind(key)
    .execute(pool)
    .await
    .map_err(AppError::Database)?
    .rows_affected();
    if updated == 0 {
        return Err(AppError::validation_code("error.pairing.not_accepted"));
    }
    sqlx::query(
        "DELETE FROM slave_permission
         WHERE device_id = ?1
            OR device_id IN (
                SELECT device_id FROM pairing_request
                 WHERE id = ?1 OR TRIM(device_id) = ?1 OR TRIM(IFNULL(fingerprint, '')) = ?1
            )",
    )
    .bind(key)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    // The seat stays usable while device_status is ACTIVE, even after the
    // pairing row is revoked (staff directory and join both trust it).
    sqlx::query(
        "UPDATE sync_device SET device_status = 'REVOKED'
         WHERE COALESCE(is_local, 0) = 0
           AND (
                device_id = ?1
                OR TRIM(IFNULL(fingerprint, '')) = ?1
                OR device_id IN (
                    SELECT device_id FROM pairing_request
                     WHERE id = ?1 OR TRIM(IFNULL(fingerprint, '')) = ?1
                )
                OR TRIM(IFNULL(fingerprint, '')) IN (
                    SELECT device_id FROM pairing_request
                     WHERE id = ?1 OR TRIM(IFNULL(fingerprint, '')) = ?1
                )
           )",
    )
    .bind(key)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

/// Revoke, block, and reclaim drop the live token and do not leave an ACCEPTED row to remint.
pub async fn clear_device_activation(
    pool: &SqlitePool,
    device_or_fingerprint: &str,
) -> Result<(), AppError> {
    ensure_sync_tables(pool).await?;
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE pairing_request
         SET status = 'REVOKED', activation_token = NULL, decided_at = ?2
         WHERE status = 'ACCEPTED'
           AND (device_id = ?1 OR IFNULL(fingerprint, '') = ?1)",
    )
    .bind(device_or_fingerprint)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query(
        "DELETE FROM slave_permission
         WHERE device_id = ?1
            OR device_id IN (
                SELECT device_id FROM pairing_request WHERE IFNULL(fingerprint, '') = ?1
            )",
    )
    .bind(device_or_fingerprint)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}
