//! Master/replica pairing flow.
//!
//! A new replica:
//!
//! 1. Discovers candidate masters via UDP broadcast (`medoc_core::discovery`).
//! 2. Generates its own Ed25519 keypair (private stays on the replica).
//! 3. Sends `{device_id, slave_pubkey, slave_label}` to the master's
//!    `POST /api/v1/pairing/request` — **unauthenticated**, but rate-limited.
//! 4. Polls `GET /api/v1/pairing/status/:id` until status moves to
//!    `ACCEPTED` (token attached) or `REJECTED`.
//!
//! The master operator inspects pending requests in the Einstellungen UI
//! (`einstellungen-pairing-inbox.tsx`) and clicks Accept / Reject. Accept
//! emits an **activation token**:
//!
//! ```text
//! mt2.<base64-no-pad payload>.<base64-no-pad ed25519 signature>
//! ```
//!
//! where `payload` is canonical JSON:
//!
//! ```json
//! {
//!   "v": 2,
//!   "device_id": "...",
//!   "slave_label": "...",
//!   "master_device_id": "...",
//!   "allowed_actions": ["sync.push", "sync.pull"],
//!   "issued_at": "2026-05-26T10:00:00Z",
//!   "nonce": "<uuid v4>"
//! }
//! ```
//!
//! The signature is Ed25519 over the canonical JSON payload bytes using the
//! master device's signing key (`master_keys::load_or_create`). Replicas
//! present the token in `Authorization: Bearer mt2.<...>` for sync calls.

use base64::{engine::general_purpose::STANDARD_NO_PAD, Engine};
use chrono::Utc;
use medoc_core::error::AppError;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::master_keys;
use crate::schema::ensure_sync_tables;

pub const ACTIVATION_TOKEN_PREFIX: &str = "mt2.";
pub const APP_KV_PAIRING_ENABLED: &str = "pairing.enabled.v1";
pub const DEFAULT_REPLICA_HTTP_PORT: u16 = 8787;

/// Build HTTPS base URL for a replica from its LAN IP (mesh + peer discovery).
pub fn peer_base_url_from_ip(ip: &str, http_port: u16) -> Option<String> {
    let ip = ip.trim();
    if ip.is_empty() {
        return None;
    }
    Some(format!("https://{ip}:{http_port}"))
}

/// Prefer `sync_device.peer_base_url` (updated on sync push); fall back to request IP.
pub async fn peer_advertised_url(
    pool: &SqlitePool,
    device_id: &str,
    requester_ip: &str,
    http_port: u16,
) -> Result<Option<String>, AppError> {
    let stored: Option<String> =
        sqlx::query_scalar("SELECT peer_base_url FROM sync_device WHERE device_id = ?1")
            .bind(device_id)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?
            .flatten()
            .filter(|s: &String| !s.trim().is_empty());
    Ok(stored.or_else(|| peer_base_url_from_ip(requester_ip, http_port)))
}

/// Master-side toggle — defaults to enabled when unset.
pub async fn is_pairing_enabled(pool: &SqlitePool) -> Result<bool, AppError> {
    let raw = medoc_core::infrastructure::database::app_kv_repo::get(pool, APP_KV_PAIRING_ENABLED)
        .await?;
    Ok(!matches!(raw.as_deref(), Some("0") | Some("false")))
}

/// Canonical default actions granted to a freshly accepted replica.
pub const DEFAULT_ALLOWED_ACTIONS: &[&str] =
    &["sync.push", "sync.pull", "sync.status", "pairing.peers"];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingRequest {
    pub id: String,
    pub device_id: String,
    pub slave_pubkey: String,
    pub slave_label: String,
    pub requester_ip: String,
    pub status: String,
    pub allowed_actions: Vec<String>,
    pub activation_token: Option<String>,
    pub requested_at: String,
    pub decided_at: Option<String>,
    pub decided_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingRequestSubmit {
    pub device_id: String,
    pub slave_pubkey: String,
    pub slave_label: String,
    pub requester_ip: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingDecision {
    pub accept: bool,
    pub allowed_actions: Vec<String>,
    pub decided_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivationTokenPayload {
    #[serde(rename = "v")]
    pub version: u32,
    pub device_id: String,
    pub slave_label: String,
    pub master_device_id: String,
    pub allowed_actions: Vec<String>,
    pub issued_at: String,
    pub nonce: String,
}

/// Replica → master: create a fresh pairing request (or refresh an existing
/// PENDING / REJECTED one). Idempotent on `device_id`: a re-submitted request
/// from the same device replaces any non-ACCEPTED row.
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

/// Build & sign an activation token from a payload. Public so vendor/test
/// utilities can mint tokens without going through the database.
pub fn mint_activation_token(
    signing_key: &ed25519_dalek::SigningKey,
    payload: &ActivationTokenPayload,
) -> Result<String, AppError> {
    let body = serde_json::to_vec(payload)
        .map_err(|e| AppError::Internal(format!("token serialise: {e}")))?;
    let body_b64 = STANDARD_NO_PAD.encode(&body);
    let sig = master_keys::sign(signing_key, body_b64.as_bytes());
    Ok(format!("{ACTIVATION_TOKEN_PREFIX}{body_b64}.{sig}"))
}

/// Parse + verify an activation token presented by a replica.
///
/// Returns the decoded payload when the signature checks out against
/// `master_pubkey`. **Does not** check `allowed_actions` against a target
/// action — that's the LAN middleware's job.
pub fn verify_activation_token(
    token: &str,
    master_pubkey: &ed25519_dalek::VerifyingKey,
) -> Result<ActivationTokenPayload, AppError> {
    let rest = token.strip_prefix(ACTIVATION_TOKEN_PREFIX).ok_or_else(|| {
        AppError::Validation(format!(
            "Aktivierungstoken: erwartet Präfix `{ACTIVATION_TOKEN_PREFIX}`"
        ))
    })?;
    let (body_b64, sig_b64) = rest
        .split_once('.')
        .ok_or_else(|| AppError::Validation("Aktivierungstoken: Trennzeichen fehlt".into()))?;
    master_keys::verify(master_pubkey, body_b64.as_bytes(), sig_b64)?;
    let body_bytes = STANDARD_NO_PAD
        .decode(body_b64)
        .map_err(|e| AppError::Validation(format!("Aktivierungstoken decode: {e}")))?;
    let payload: ActivationTokenPayload = serde_json::from_slice(&body_bytes)
        .map_err(|e| AppError::Validation(format!("Aktivierungstoken JSON: {e}")))?;
    if payload.version != 2 {
        return Err(AppError::Validation(format!(
            "Aktivierungstoken Version {} (erwartet 2)",
            payload.version
        )));
    }
    Ok(payload)
}

/// Authorised actions for a slave device (master-side check).
pub async fn slave_actions(pool: &SqlitePool, device_id: &str) -> Result<Vec<String>, AppError> {
    ensure_sync_tables(pool).await?;
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT action FROM slave_permission WHERE device_id = ?1 ORDER BY action ASC",
    )
    .bind(device_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(rows.into_iter().map(|(a,)| a).collect())
}

fn sanitise_actions(input: &[String]) -> Vec<String> {
    if input.is_empty() {
        return DEFAULT_ALLOWED_ACTIONS
            .iter()
            .map(|s| (*s).to_string())
            .collect();
    }
    let mut out: Vec<String> = input
        .iter()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    out.sort();
    out.dedup();
    out
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

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use medoc_core::infrastructure::database::connection::{run_migrations, test_memory_pool};
    use rand::rngs::OsRng;

    async fn fresh_pool() -> SqlitePool {
        std::env::set_var(
            "MEDOC_PAIRING_MASTER_SECRET",
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        );
        let pool = test_memory_pool().await.expect("pool");
        run_migrations(&pool).await.expect("migrate");
        crate::schema::ensure_sync_tables(&pool)
            .await
            .expect("schema");
        pool
    }

    #[tokio::test]
    async fn submit_then_accept_round_trip_issues_token() {
        let pool = fresh_pool().await;
        let slave_sk = SigningKey::generate(&mut OsRng);
        let slave_pubkey_b64 = STANDARD_NO_PAD.encode(slave_sk.verifying_key().to_bytes());

        let req = submit_request(
            &pool,
            PairingRequestSubmit {
                device_id: "slave-1".into(),
                slave_pubkey: slave_pubkey_b64,
                slave_label: "Empfang iPad".into(),
                requester_ip: "192.168.1.20".into(),
            },
        )
        .await
        .expect("submit ok");
        assert_eq!(req.status, "PENDING");
        assert!(req.activation_token.is_none());

        let decided = decide(
            &pool,
            "master-1",
            &req.id,
            PairingDecision {
                accept: true,
                allowed_actions: vec!["sync.push".into(), "sync.pull".into()],
                decided_by: "admin@praxis".into(),
            },
            DEFAULT_REPLICA_HTTP_PORT,
        )
        .await
        .expect("decide ok");
        assert_eq!(decided.status, "ACCEPTED");
        let token = decided.activation_token.expect("token attached");
        assert!(token.starts_with(ACTIVATION_TOKEN_PREFIX));

        // The matching master pubkey must verify the token.
        let master_sk = master_keys::load_or_create().expect("master key");
        let payload = verify_activation_token(&token, &master_sk.verifying_key()).expect("verify");
        assert_eq!(payload.device_id, "slave-1");
        assert_eq!(payload.master_device_id, "master-1");
        assert_eq!(
            payload.allowed_actions,
            vec!["sync.pull".to_string(), "sync.push".to_string()] // sorted
        );

        let actions = slave_actions(&pool, "slave-1").await.unwrap();
        assert_eq!(
            actions,
            vec!["sync.pull".to_string(), "sync.push".to_string()]
        );

        let peer_url: Option<String> =
            sqlx::query_scalar("SELECT peer_base_url FROM sync_device WHERE device_id = ?1")
                .bind("slave-1")
                .fetch_one(&pool)
                .await
                .expect("sync_device row");
        assert_eq!(peer_url.as_deref(), Some("https://192.168.1.20:8787"));
    }

    #[tokio::test]
    async fn second_submit_replaces_pending_row() {
        let pool = fresh_pool().await;
        let req1 = submit_request(
            &pool,
            PairingRequestSubmit {
                device_id: "slave-2".into(),
                slave_pubkey: "AAAA".into(),
                slave_label: "Lab".into(),
                requester_ip: "10.0.0.5".into(),
            },
        )
        .await
        .unwrap();
        let req2 = submit_request(
            &pool,
            PairingRequestSubmit {
                device_id: "slave-2".into(),
                slave_pubkey: "BBBB".into(),
                slave_label: "Lab (renamed)".into(),
                requester_ip: "10.0.0.5".into(),
            },
        )
        .await
        .unwrap();
        assert_eq!(req1.id, req2.id, "same row reused for same device_id");
        assert_eq!(req2.slave_pubkey, "BBBB");
        assert_eq!(req2.status, "PENDING");
    }

    #[tokio::test]
    async fn reject_keeps_no_token_and_no_permissions() {
        let pool = fresh_pool().await;
        let req = submit_request(
            &pool,
            PairingRequestSubmit {
                device_id: "slave-3".into(),
                slave_pubkey: "CCCC".into(),
                slave_label: "Test".into(),
                requester_ip: "1.2.3.4".into(),
            },
        )
        .await
        .unwrap();
        let decided = decide(
            &pool,
            "master-1",
            &req.id,
            PairingDecision {
                accept: false,
                allowed_actions: vec![],
                decided_by: "admin".into(),
            },
            DEFAULT_REPLICA_HTTP_PORT,
        )
        .await
        .unwrap();
        assert_eq!(decided.status, "REJECTED");
        assert!(decided.activation_token.is_none());
        assert!(slave_actions(&pool, "slave-3").await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn revoke_clears_permissions_and_marks_revoked() {
        let pool = fresh_pool().await;
        let req = submit_request(
            &pool,
            PairingRequestSubmit {
                device_id: "slave-4".into(),
                slave_pubkey: "DDDD".into(),
                slave_label: "Tablet".into(),
                requester_ip: "1.1.1.1".into(),
            },
        )
        .await
        .unwrap();
        decide(
            &pool,
            "m",
            &req.id,
            PairingDecision {
                accept: true,
                allowed_actions: vec!["sync.push".into()],
                decided_by: "admin".into(),
            },
            DEFAULT_REPLICA_HTTP_PORT,
        )
        .await
        .unwrap();
        revoke(&pool, "m", "slave-4", "admin").await.unwrap();
        let after = load_by_device(&pool, "slave-4").await.unwrap().unwrap();
        assert_eq!(after.status, "REVOKED");
        assert!(after.activation_token.is_none());
        assert!(slave_actions(&pool, "slave-4").await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn verify_token_rejects_wrong_master_pubkey() {
        let pool = fresh_pool().await;
        let req = submit_request(
            &pool,
            PairingRequestSubmit {
                device_id: "slave-5".into(),
                slave_pubkey: "EEEE".into(),
                slave_label: "X".into(),
                requester_ip: "".into(),
            },
        )
        .await
        .unwrap();
        let decided = decide(
            &pool,
            "m",
            &req.id,
            PairingDecision {
                accept: true,
                allowed_actions: vec!["sync.push".into()],
                decided_by: "a".into(),
            },
            DEFAULT_REPLICA_HTTP_PORT,
        )
        .await
        .unwrap();
        let other = SigningKey::generate(&mut OsRng).verifying_key();
        let err = verify_activation_token(decided.activation_token.as_ref().unwrap(), &other)
            .expect_err("must fail for wrong pubkey");
        assert!(matches!(err, AppError::Validation(_)));
    }
}
