//! Pairing orchestration, registry enforcement, blocklist.

use chrono::{Duration, Utc};
use medoc_core::error::AppError;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::master_keys;
use crate::cluster::crypto::{
    derive_sas_from_transcript, hash_sas, mint_seat_certificate, normalise_sas_input,
    validate_sas_match, DeviceIdentity,
};
use crate::cluster::entities::{Device, PairingSession};
use crate::cluster::enums::{DeviceStatus, PairingStatus, SeatRole};
use crate::cluster::repo;
use crate::cluster::ports::{
    reserve_seat_atomic, DeviceRepo, PairingRepo, LicenseRepo, SqliteClusterRepos,
};

use super::audit;
use super::license_service::require_owner_admin;
use super::provisioning_service::{apply_provisioning, ProvisionResult};
use super::staff_directory::fetch_provisioning_settings_json;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinRequestResult {
    pub handle: PairingHandle,
    pub handshake_transcript_b64: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingHandle {
    pub session_id: String,
    pub fingerprint: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SasCode {
    pub digits: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingRequest {
    pub id: String,
    pub fingerprint: String,
    pub hostname: Option<String>,
    pub os: Option<String>,
    pub ip: Option<String>,
    pub requested_role: SeatRole,
    pub created_at: String,
    /// Active device with same hostname — likely reinstall; admin may reclaim before accept.
    pub suggested_reclaim_fingerprint: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceView {
    pub fingerprint: String,
    pub hostname: Option<String>,
    pub last_ip: Option<String>,
    pub seat_role: SeatRole,
    pub status: DeviceStatus,
    pub last_seen: Option<String>,
}

const KOPPLUNG_TTL_SECS: i64 = 600;

fn local_hostname() -> Option<String> {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .filter(|s| !s.trim().is_empty())
}

pub async fn create_join_request(
    pool: &SqlitePool,
    fingerprint: &str,
    requested_role: SeatRole,
    handshake_transcript: &[u8],
    session_id: Option<&str>,
    hostname: Option<&str>,
) -> Result<PairingHandle, AppError> {
    let repos = SqliteClusterRepos { pool };
    if repos.is_blocklisted(fingerprint).await? {
        return Err(AppError::Forbidden);
    }

    let session_id = session_id
        .map(str::to_string)
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = Utc::now();
    let session = PairingSession {
        id: session_id.clone(),
        fingerprint: fingerprint.to_string(),
        state: PairingStatus::JoinRequested,
        sas_hash: None,
        requested_role,
        hostname: hostname
            .map(str::to_string)
            .or_else(local_hostname),
        created_at: now,
        expires_at: now + Duration::seconds(KOPPLUNG_TTL_SECS),
    };
    repos.create_session(&session).await?;
    if !handshake_transcript.is_empty() {
        repo::store_handshake_transcript(pool, &session_id, handshake_transcript).await?;
    }

    audit::log_pairing(
        pool,
        "system",
        "JOIN_REQUEST",
        Some(&session_id),
        Some(fingerprint),
    )
    .await?;

    let _sas = derive_sas_from_transcript(handshake_transcript);
    Ok(PairingHandle {
        session_id,
        fingerprint: fingerprint.to_string(),
    })
}

/// Mirror an admin-issued pairing session on the joiner device.
pub async fn mirror_join_session(
    pool: &SqlitePool,
    session_id: &str,
    fingerprint: &str,
    requested_role: SeatRole,
    handshake_transcript: &[u8],
) -> Result<PairingHandle, AppError> {
    let repos = SqliteClusterRepos { pool };
    if repos.load_session(session_id).await?.is_some() {
        return Ok(PairingHandle {
            session_id: session_id.to_string(),
            fingerprint: fingerprint.to_string(),
        });
    }
    create_join_request(
        pool,
        fingerprint,
        requested_role,
        handshake_transcript,
        Some(session_id),
        local_hostname().as_deref(),
    )
    .await
}

/// Revoke an occupied seat (e.g. after reinstall with new identity).
pub async fn reclaim_stale_seat(
    pool: &SqlitePool,
    user_id: &str,
    old_fingerprint: &str,
) -> Result<(), AppError> {
    require_owner_admin(pool).await?;
    revoke_device(pool, user_id, old_fingerprint).await?;
    audit::log_cluster(
        pool,
        user_id,
        "RECLAIM",
        Some(old_fingerprint),
        Some("reinstall seat reclaim"),
    )
    .await
}

pub async fn accept_join_request(
    pool: &SqlitePool,
    user_id: &str,
    session_id: &str,
    handshake_transcript: &[u8],
    replace_fingerprint: Option<&str>,
) -> Result<SasCode, AppError> {
    require_owner_admin(pool).await?;
    let repos = SqliteClusterRepos { pool };
    let Some(license) = repos.load().await? else {
        return Err(AppError::Validation("No cluster activated".into()));
    };

    let Some(mut session) = repos.load_session(session_id).await? else {
        return Err(AppError::NotFound("Pairing session not found".into()));
    };

    if repos.is_blocklisted(&session.fingerprint).await? {
        return Err(AppError::Forbidden);
    }

    if let Some(old_fp) = replace_fingerprint {
        if old_fp == session.fingerprint {
            return Err(AppError::Validation(
                "Replace: old and new fingerprint are identical".into(),
            ));
        }
        reclaim_stale_seat(pool, user_id, old_fp).await?;
    }

    reserve_seat_atomic(
        pool,
        &license.cluster_id,
        session.requested_role,
        license.max_total,
        license.max_admin,
        license.max_member,
    )
    .await?;

    let transcript_bytes = if handshake_transcript.is_empty() {
        repo::load_handshake_transcript(pool, session_id)
            .await?
            .unwrap_or_default()
    } else {
        handshake_transcript.to_vec()
    };
    let sas = derive_sas_from_transcript(&transcript_bytes);
    let sas_hash = hash_sas(session_id, &sas, &license.signing_key_enc);
    repos
        .update_state(session_id, PairingStatus::AwaitingSas, Some(&sas_hash))
        .await?;
    session.state = PairingStatus::AwaitingSas;

    audit::log_pairing(pool, user_id, "JOIN_ACCEPT", Some(session_id), Some(&sas)).await?;

    Ok(SasCode { digits: sas })
}

pub async fn submit_sas(
    pool: &SqlitePool,
    user_id: &str,
    handle: &PairingHandle,
    digits: &str,
    handshake_transcript: &[u8],
) -> Result<ProvisionResult, AppError> {
    let repos = SqliteClusterRepos { pool };
    let Some(session) = repos.load_session(&handle.session_id).await? else {
        return Err(AppError::NotFound("Pairing session not found".into()));
    };

    let identity = DeviceIdentity::load_or_create()?;
    let transcript_join =
        handshake_transcript.len() > 32 && handshake_transcript != identity.fingerprint.as_bytes();

    if transcript_join {
        let Some(sas) = normalise_sas_input(digits) else {
            return Err(AppError::Validation("SAS must be 4 digits".into()));
        };
        let expected = derive_sas_from_transcript(handshake_transcript);
        if sas != expected {
            return Err(AppError::Validation("SAS does not match".into()));
        }

        repos
            .update_state(&handle.session_id, PairingStatus::SasConfirmed, None)
            .await?;

        let seat_token = format!("join-provision:{}", handle.session_id);
        let settings_json = match fetch_provisioning_settings_json(pool).await {
            Ok(json) => json,
            Err(e) => {
                tracing::warn!(
                    target: "medoc::cluster",
                    event = "STAFF_DIRECTORY_PROVISION_FETCH_FAILED",
                    error = %e
                );
                "{}".to_string()
            }
        };
        let wrapped_secrets = vec![];

        let result = apply_provisioning(
            pool,
            &handle.fingerprint,
            seat_token.clone(),
            settings_json.clone(),
            wrapped_secrets.clone(),
        )
        .await?;

        if result.success {
            repos
                .update_state(&handle.session_id, PairingStatus::Provisioned, None)
                .await?;
            audit::log_pairing(pool, user_id, "PROVISION", Some(&handle.session_id), None).await?;
        } else {
            audit::log_pairing(
                pool,
                user_id,
                "PROVISION_REJECTED",
                Some(&handle.session_id),
                None,
            )
            .await?;
        }
        return Ok(result);
    }

    let Some(license) = repos.load().await? else {
        return Err(AppError::Validation("No cluster".into()));
    };

    if session.state != PairingStatus::AwaitingSas {
        return Err(AppError::Validation("Session not ready for SAS".into()));
    }

    let expected_hash = session
        .sas_hash
        .as_deref()
        .ok_or_else(|| AppError::Internal("SAS hash missing from pairing session".into()))?;
    validate_sas_match(
        &handle.session_id,
        digits,
        expected_hash,
        &license.signing_key_enc,
    )?;

    repos
        .update_state(&handle.session_id, PairingStatus::SasConfirmed, None)
        .await?;

    let signing_key = master_keys::load_or_create()?;
    let (_cert, seat_token) = mint_seat_certificate(
        &signing_key,
        &license.cluster_id,
        &identity.pubkey_bytes,
        session.requested_role,
        &license.license_ref,
    )?;

    let settings_json = "{}".to_string();
    let wrapped_secrets = vec![];

    let result = apply_provisioning(
        pool,
        &handle.fingerprint,
        seat_token.clone(),
        settings_json.clone(),
        wrapped_secrets.clone(),
    )
    .await?;

    if result.success {
        let device = Device {
            fingerprint: handle.fingerprint.clone(),
            cluster_id: license.cluster_id.clone(),
            device_id: handle.fingerprint.clone(),
            pubkey: identity.pubkey_bytes.to_vec(),
            hostname: None,
            os: Some(std::env::consts::OS.into()),
            last_ip: None,
            seat_role: session.requested_role,
            status: DeviceStatus::Active,
            seat_cert: Some(seat_token.as_bytes().to_vec()),
            last_seen: Some(Utc::now()),
            created_at: Utc::now(),
        };
        repos.upsert(&device).await?;
        repos
            .update_state(&handle.session_id, PairingStatus::Provisioned, None)
            .await?;
        audit::log_pairing(pool, user_id, "PROVISION", Some(&handle.session_id), None).await?;
    } else {
        audit::log_pairing(
            pool,
            user_id,
            "PROVISION_REJECTED",
            Some(&handle.session_id),
            None,
        )
        .await?;
    }

    Ok(result)
}

pub async fn verify_peer_connection(
    pool: &SqlitePool,
    fingerprint: &str,
    pubkey: &[u8],
) -> Result<(), AppError> {
    let repos = SqliteClusterRepos { pool };
    if repos.is_blocklisted(fingerprint).await? {
        repos.block(fingerprint, "blocklisted reconnect").await?;
        return Err(AppError::Forbidden);
    }
    let Some(device) = repos.find_by_fingerprint(fingerprint).await? else {
        repos.block(fingerprint, "unknown device").await?;
        audit::log_cluster(pool, "system", "DENY_UNKNOWN", Some(fingerprint), None).await?;
        return Err(AppError::Forbidden);
    };
    if !device.identity_complete() {
        repos
            .block(fingerprint, "incomplete identity — re-provision required")
            .await?;
        audit::log_cluster(
            pool,
            "system",
            "DENY_INCOMPLETE_IDENTITY",
            Some(fingerprint),
            None,
        )
        .await?;
        return Err(AppError::Forbidden);
    }
    if device.status != DeviceStatus::Active {
        repos.block(fingerprint, "inactive device").await?;
        return Err(AppError::Forbidden);
    }
    if device.pubkey != pubkey {
        repos.block(fingerprint, "pubkey mismatch").await?;
        audit::log_cluster(pool, "system", "DENY_MISMATCH", Some(fingerprint), None).await?;
        return Err(AppError::Forbidden);
    }
    Ok(())
}

pub async fn list_pending_requests(pool: &SqlitePool) -> Result<Vec<PendingRequest>, AppError> {
    let repos = SqliteClusterRepos { pool };
    let cluster_id = repos
        .load()
        .await?
        .map(|l| l.cluster_id)
        .unwrap_or_default();
    let sessions = repos.list_pending(&cluster_id).await?;
    let mut out = Vec::with_capacity(sessions.len());
    for s in sessions {
        let suggested_reclaim_fingerprint = if let Some(ref host) = s.hostname {
            super::super::repo::find_active_device_by_hostname(pool, &cluster_id, host)
                .await?
                .filter(|g| g.fingerprint != s.fingerprint)
                .map(|g| g.fingerprint)
        } else {
            None
        };
        out.push(PendingRequest {
            id: s.id,
            fingerprint: s.fingerprint,
            hostname: s.hostname.clone(),
            os: None,
            ip: None,
            requested_role: s.requested_role,
            created_at: s.created_at.to_rfc3339(),
            suggested_reclaim_fingerprint,
        });
    }
    Ok(out)
}

pub async fn list_devices(pool: &SqlitePool) -> Result<Vec<DeviceView>, AppError> {
    let repos = SqliteClusterRepos { pool };
    let Some(license) = repos.load().await? else {
        return Ok(vec![]);
    };
    let devices = repos.list_active(&license.cluster_id).await?;
    Ok(devices
        .into_iter()
        .map(|g| DeviceView {
            fingerprint: g.fingerprint,
            hostname: g.hostname,
            last_ip: g.last_ip,
            seat_role: g.seat_role,
            status: g.status,
            last_seen: g.last_seen.map(|t| t.to_rfc3339()),
        })
        .collect())
}

pub async fn revoke_device(
    pool: &SqlitePool,
    user_id: &str,
    fingerprint: &str,
) -> Result<(), AppError> {
    require_owner_admin(pool).await?;
    let repos = SqliteClusterRepos { pool };
    repos.set_status(fingerprint, DeviceStatus::Revoked).await?;
    audit::log_cluster(pool, user_id, "REVOKE", Some(fingerprint), None).await
}

pub async fn block_device(
    pool: &SqlitePool,
    user_id: &str,
    fingerprint: &str,
    reason: &str,
) -> Result<(), AppError> {
    require_owner_admin(pool).await?;
    let repos = SqliteClusterRepos { pool };
    repos.block(fingerprint, reason).await?;
    audit::log_cluster(pool, user_id, "BLOCK", Some(fingerprint), Some(reason)).await
}

pub async fn unblock_device(
    pool: &SqlitePool,
    user_id: &str,
    fingerprint: &str,
) -> Result<(), AppError> {
    require_owner_admin(pool).await?;
    let repos = SqliteClusterRepos { pool };
    repos.unblock(fingerprint).await?;
    audit::log_cluster(pool, user_id, "UNBLOCK", Some(fingerprint), None).await
}

pub async fn reject_join_request(
    pool: &SqlitePool,
    user_id: &str,
    session_id: &str,
) -> Result<(), AppError> {
    require_owner_admin(pool).await?;
    let repos = SqliteClusterRepos { pool };
    repos
        .update_state(session_id, PairingStatus::Rejected, None)
        .await?;
    audit::log_pairing(pool, user_id, "JOIN_REJECT", Some(session_id), None).await
}
