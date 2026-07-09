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
    generate_confirm_pin, hash_confirm_pin, normalise_pin_input, verify_confirm_pin,
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

    let existing: Option<(String, String)> =
        sqlx::query_as("SELECT id, status FROM pairing_request WHERE device_id = ?1")
            .bind(&submit.device_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;

    let now = Utc::now().to_rfc3339();

    if let Some((existing_id, status)) = existing {
        if status == "ACCEPTED" {
            return load_by_id(pool, &existing_id).await?.ok_or_else(|| {
                AppError::Internal("pairing_request disappeared during read".into())
            });
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
        .bind(&submit.slave_label)
        .bind(&submit.requester_ip)
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
    .bind(&submit.slave_label)
    .bind(&submit.requester_ip)
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
            "pairing_request bereits entschieden (status={})",
            request.status
        )));
    }
    if request.awaiting_pin {
        return Err(AppError::Conflict(
            "pairing_request wartet bereits auf PIN-Bestätigung".into(),
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
    let pin = generate_confirm_pin();
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
            "pairing_request erwartet keine PIN-Bestätigung".into(),
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
        AppError::Internal("pairing_request awaiting_pin ohne confirm_pin_hash".into())
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

    let attempts: i32 =
        sqlx::query_scalar("SELECT confirm_pin_attempts FROM pairing_request WHERE id = ?1")
            .bind(request_id)
            .fetch_one(pool)
            .await
            .map_err(AppError::Database)?;

    if attempts >= CONFIRM_PIN_MAX_ATTEMPTS {
        return Err(AppError::Validation(
            "Zu viele PIN-Versuche — Pairing-Anfrage erneut stellen".into(),
        ));
    }

    let signing_key = master_keys::load_or_create()?;
    if !verify_confirm_pin(request_id, &pin, &pin_hash, &signing_key.to_bytes()) {
        sqlx::query(
            "UPDATE pairing_request SET confirm_pin_attempts = confirm_pin_attempts + 1 WHERE id = ?1",
        )
        .bind(request_id)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
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
