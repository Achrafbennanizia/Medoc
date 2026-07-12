//! Pairing orchestration, registry enforcement, blocklist.

use chrono::{Duration, Utc};
use medoc_core::error::AppError;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::master_keys;
use crate::verbund::crypto::{
    derive_sas_from_transcript, hash_sas, mint_seat_certificate, normalise_sas_input,
    validate_sas_match, DeviceIdentity,
};
use crate::verbund::entities::{Geraet, KopplungSession};
use crate::verbund::enums::{GeraetStatus, KopplungStatus, SeatRolle};
use crate::verbund::repo;
use crate::verbund::ports::{
    reserve_seat_atomic, GeraetRepo, KopplungRepo, LizenzRepo, SqliteVerbundRepos,
};

use super::audit;
use super::lizenz_service::require_owner_admin;
use super::provisioning_service::{apply_provisioning, ProvisionResult};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinRequestResult {
    pub handle: KopplungHandle,
    pub handshake_transcript_b64: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KopplungHandle {
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
    pub requested_role: SeatRolle,
    pub created_at: String,
    /// Active device with same hostname — likely reinstall; admin may reclaim before accept.
    pub suggested_reclaim_fingerprint: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeraetView {
    pub fingerprint: String,
    pub hostname: Option<String>,
    pub last_ip: Option<String>,
    pub seat_role: SeatRolle,
    pub status: GeraetStatus,
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
    requested_role: SeatRolle,
    handshake_transcript: &[u8],
    session_id: Option<&str>,
    hostname: Option<&str>,
) -> Result<KopplungHandle, AppError> {
    let repos = SqliteVerbundRepos { pool };
    if repos.is_blocklisted(fingerprint).await? {
        return Err(AppError::Forbidden);
    }

    let session_id = session_id
        .map(str::to_string)
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    let now = Utc::now();
    let session = KopplungSession {
        id: session_id.clone(),
        fingerprint: fingerprint.to_string(),
        state: KopplungStatus::JoinRequested,
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

    audit::log_kopplung(
        pool,
        "system",
        "JOIN_REQUEST",
        Some(&session_id),
        Some(fingerprint),
    )
    .await?;

    let _sas = derive_sas_from_transcript(handshake_transcript);
    Ok(KopplungHandle {
        session_id,
        fingerprint: fingerprint.to_string(),
    })
}

/// Mirror an admin-issued kopplung session on the joiner device.
pub async fn mirror_join_session(
    pool: &SqlitePool,
    session_id: &str,
    fingerprint: &str,
    requested_role: SeatRolle,
    handshake_transcript: &[u8],
) -> Result<KopplungHandle, AppError> {
    let repos = SqliteVerbundRepos { pool };
    if repos.load_session(session_id).await?.is_some() {
        return Ok(KopplungHandle {
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
    audit::log_verbund(
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
    let repos = SqliteVerbundRepos { pool };
    let Some(lizenz) = repos.load().await? else {
        return Err(AppError::Validation("Kein Verbund aktiviert".into()));
    };

    let Some(mut session) = repos.load_session(session_id).await? else {
        return Err(AppError::NotFound("Kopplungssitzung nicht gefunden".into()));
    };

    if repos.is_blocklisted(&session.fingerprint).await? {
        return Err(AppError::Forbidden);
    }

    if let Some(old_fp) = replace_fingerprint {
        if old_fp == session.fingerprint {
            return Err(AppError::Validation(
                "Ersetzen: alter und neuer Fingerprint sind identisch".into(),
            ));
        }
        reclaim_stale_seat(pool, user_id, old_fp).await?;
    }

    reserve_seat_atomic(
        pool,
        &lizenz.cluster_id,
        session.requested_role,
        lizenz.max_total,
        lizenz.max_admin,
        lizenz.max_member,
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
    let sas_hash = hash_sas(session_id, &sas, &lizenz.signing_key_enc);
    repos
        .update_state(session_id, KopplungStatus::AwaitingSas, Some(&sas_hash))
        .await?;
    session.state = KopplungStatus::AwaitingSas;

    audit::log_kopplung(pool, user_id, "JOIN_ACCEPT", Some(session_id), Some(&sas)).await?;

    Ok(SasCode { digits: sas })
}

pub async fn submit_sas(
    pool: &SqlitePool,
    user_id: &str,
    handle: &KopplungHandle,
    digits: &str,
    handshake_transcript: &[u8],
) -> Result<ProvisionResult, AppError> {
    let repos = SqliteVerbundRepos { pool };
    let Some(session) = repos.load_session(&handle.session_id).await? else {
        return Err(AppError::NotFound("Kopplungssitzung nicht gefunden".into()));
    };

    let identity = DeviceIdentity::load_or_create()?;
    let transcript_join =
        handshake_transcript.len() > 32 && handshake_transcript != identity.fingerprint.as_bytes();

    if transcript_join {
        let Some(sas) = normalise_sas_input(digits) else {
            return Err(AppError::Validation("SAS muss 4 Ziffern sein".into()));
        };
        let expected = derive_sas_from_transcript(handshake_transcript);
        if sas != expected {
            return Err(AppError::Validation("SAS stimmt nicht überein".into()));
        }

        repos
            .update_state(&handle.session_id, KopplungStatus::SasConfirmed, None)
            .await?;

        let seat_token = format!("join-provision:{}", handle.session_id);
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
            repos
                .update_state(&handle.session_id, KopplungStatus::Provisioned, None)
                .await?;
            audit::log_kopplung(pool, user_id, "PROVISION", Some(&handle.session_id), None).await?;
        } else {
            audit::log_kopplung(
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

    let Some(lizenz) = repos.load().await? else {
        return Err(AppError::Validation("Kein Verbund".into()));
    };

    if session.state != KopplungStatus::AwaitingSas {
        return Err(AppError::Validation("Sitzung nicht bereit für SAS".into()));
    }

    let expected_hash = session
        .sas_hash
        .as_deref()
        .ok_or_else(|| AppError::Internal("SAS-Hash fehlt in Kopplungssitzung".into()))?;
    validate_sas_match(
        &handle.session_id,
        digits,
        expected_hash,
        &lizenz.signing_key_enc,
    )?;

    repos
        .update_state(&handle.session_id, KopplungStatus::SasConfirmed, None)
        .await?;

    let signing_key = master_keys::load_or_create()?;
    let (_cert, seat_token) = mint_seat_certificate(
        &signing_key,
        &lizenz.cluster_id,
        &identity.pubkey_bytes,
        session.requested_role,
        &lizenz.license_ref,
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
        let geraet = Geraet {
            fingerprint: handle.fingerprint.clone(),
            cluster_id: lizenz.cluster_id.clone(),
            device_id: handle.fingerprint.clone(),
            pubkey: identity.pubkey_bytes.to_vec(),
            hostname: None,
            os: Some(std::env::consts::OS.into()),
            last_ip: None,
            seat_role: session.requested_role,
            status: GeraetStatus::Active,
            seat_cert: Some(seat_token.as_bytes().to_vec()),
            last_seen: Some(Utc::now()),
            created_at: Utc::now(),
        };
        repos.upsert(&geraet).await?;
        repos
            .update_state(&handle.session_id, KopplungStatus::Provisioned, None)
            .await?;
        audit::log_kopplung(pool, user_id, "PROVISION", Some(&handle.session_id), None).await?;
    } else {
        audit::log_kopplung(
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
    let repos = SqliteVerbundRepos { pool };
    if repos.is_blocklisted(fingerprint).await? {
        repos.block(fingerprint, "blocklisted reconnect").await?;
        return Err(AppError::Forbidden);
    }
    let Some(geraet) = repos.find_by_fingerprint(fingerprint).await? else {
        repos.block(fingerprint, "unknown device").await?;
        audit::log_verbund(pool, "system", "DENY_UNKNOWN", Some(fingerprint), None).await?;
        return Err(AppError::Forbidden);
    };
    if !geraet.identity_complete() {
        repos
            .block(fingerprint, "incomplete identity — re-provision required")
            .await?;
        audit::log_verbund(
            pool,
            "system",
            "DENY_INCOMPLETE_IDENTITY",
            Some(fingerprint),
            None,
        )
        .await?;
        return Err(AppError::Forbidden);
    }
    if geraet.status != GeraetStatus::Active {
        repos.block(fingerprint, "inactive device").await?;
        return Err(AppError::Forbidden);
    }
    if geraet.pubkey != pubkey {
        repos.block(fingerprint, "pubkey mismatch").await?;
        audit::log_verbund(pool, "system", "DENY_MISMATCH", Some(fingerprint), None).await?;
        return Err(AppError::Forbidden);
    }
    Ok(())
}

pub async fn list_pending_requests(pool: &SqlitePool) -> Result<Vec<PendingRequest>, AppError> {
    let repos = SqliteVerbundRepos { pool };
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

pub async fn list_devices(pool: &SqlitePool) -> Result<Vec<GeraetView>, AppError> {
    let repos = SqliteVerbundRepos { pool };
    let Some(lizenz) = repos.load().await? else {
        return Ok(vec![]);
    };
    let devices = repos.list_active(&lizenz.cluster_id).await?;
    Ok(devices
        .into_iter()
        .map(|g| GeraetView {
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
    let repos = SqliteVerbundRepos { pool };
    repos.set_status(fingerprint, GeraetStatus::Revoked).await?;
    audit::log_verbund(pool, user_id, "REVOKE", Some(fingerprint), None).await
}

pub async fn block_device(
    pool: &SqlitePool,
    user_id: &str,
    fingerprint: &str,
    reason: &str,
) -> Result<(), AppError> {
    require_owner_admin(pool).await?;
    let repos = SqliteVerbundRepos { pool };
    repos.block(fingerprint, reason).await?;
    audit::log_verbund(pool, user_id, "BLOCK", Some(fingerprint), Some(reason)).await
}

pub async fn unblock_device(
    pool: &SqlitePool,
    user_id: &str,
    fingerprint: &str,
) -> Result<(), AppError> {
    require_owner_admin(pool).await?;
    let repos = SqliteVerbundRepos { pool };
    repos.unblock(fingerprint).await?;
    audit::log_verbund(pool, user_id, "UNBLOCK", Some(fingerprint), None).await
}

pub async fn reject_join_request(
    pool: &SqlitePool,
    user_id: &str,
    session_id: &str,
) -> Result<(), AppError> {
    require_owner_admin(pool).await?;
    let repos = SqliteVerbundRepos { pool };
    repos
        .update_state(session_id, KopplungStatus::Rejected, None)
        .await?;
    audit::log_kopplung(pool, user_id, "JOIN_REJECT", Some(session_id), None).await
}
