//! Pairing orchestration, registry enforcement, blocklist.

use chrono::{Duration, Utc};
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::app_kv_repo;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::cluster::crypto::{
    derive_sas_from_transcript, hash_sas, mint_seat_certificate, normalise_sas_input,
    transcript_sha_prefix, validate_sas_match, verify_sas, DeviceIdentity,
};
use crate::cluster::entities::{Device, PairingSession};
use crate::cluster::enums::{DeviceStatus, PairingStatus, SeatRole};
use crate::cluster::ports::{
    is_provisioned, mark_provisioned, reserve_seat_atomic, DeviceRepo, LicenseRepo, PairingRepo,
    SqliteClusterRepos,
};
use crate::cluster::repo;
use crate::deployment::{DeploymentMode, DeviceRole};
use crate::engine::SyncEngine;
use crate::master_keys;
use crate::pairing::{
    mint_activation_token, verify_activation_token, ActivationTokenPayload,
    DEFAULT_ALLOWED_ACTIONS, DEFAULT_REPLICA_HTTP_PORT,
};

use super::audit;
use super::license_service::require_owner_admin;
use super::provisioning_service::{apply_provisioning, ProvisionResult};
use super::staff_directory::{
    fetch_provisioning_settings_json, load_join_admin_endpoint, load_join_lan_auth,
    store_join_lan_auth,
};
use crate::net::{confirm_sas_on_admin, fetch_replica_auth, SasConfirmOutcome};

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
const ONBOARDING_SETUP_KV_KEY: &str = "onboarding.setup_complete.v1";

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
    peer_ip: Option<&str>,
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
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string),
        created_at: now,
        expires_at: now + Duration::seconds(KOPPLUNG_TTL_SECS),
    };
    repos.create_session(&session).await?;
    repo::record_join_endpoint(pool, fingerprint, session.hostname.as_deref(), peer_ip).await?;
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

    if !handshake_transcript.is_empty() {
        if let Some(license) = repos.load().await? {
            let sas = derive_sas_from_transcript(handshake_transcript);
            let sas_hash = hash_sas(&session_id, &sas, &license.signing_key_enc);
            repos
                .update_state(&session_id, PairingStatus::AwaitingSas, Some(&sas_hash))
                .await?;
            tracing::info!(
                target: "medoc::cluster",
                event = "CLUSTER_SAS_ARMED_ON_JOIN",
                session_id = %session_id,
                transcript_len = handshake_transcript.len(),
                transcript_sha = %transcript_sha_prefix(handshake_transcript),
                expected_sas = %sas
            );
        }
    }
    Ok(PairingHandle {
        session_id,
        fingerprint: fingerprint.to_string(),
    })
}

pub async fn store_join_device_pubkey(
    pool: &SqlitePool,
    session_id: &str,
    pubkey: &[u8],
) -> Result<(), AppError> {
    repo::store_slave_pubkey(pool, session_id, pubkey).await
}

pub async fn record_join_identity(
    pool: &SqlitePool,
    device_id: &str,
    hostname: Option<&str>,
    peer_ip: Option<&str>,
) -> Result<(), AppError> {
    repo::record_join_endpoint(pool, device_id, hostname, peer_ip).await
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
        if !handshake_transcript.is_empty() {
            repo::store_handshake_transcript(pool, session_id, handshake_transcript).await?;
        }
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
        None,
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

    // Prefer the transcript persisted at JOIN (same bytes the joiner stored).
    // IPC used to pass UTF-8 of a base64 string and produced a different SAS.
    let db_transcript = repo::load_handshake_transcript(pool, session_id)
        .await?
        .unwrap_or_default();
    let transcript_source = if db_transcript.is_empty() {
        "ipc"
    } else {
        "db"
    };
    let transcript_bytes = if !db_transcript.is_empty() {
        db_transcript
    } else {
        handshake_transcript.to_vec()
    };
    if transcript_bytes.is_empty() {
        return Err(AppError::Validation(
            "Handshake transcript missing. The joining device must send a new join request, then accept it again."
                .into(),
        ));
    }
    let sas = derive_sas_from_transcript(&transcript_bytes);
    tracing::info!(
        target: "medoc::cluster",
        event = "CLUSTER_SAS_ACCEPT",
        session_id,
        transcript_source,
        transcript_len = transcript_bytes.len(),
        transcript_sha = %transcript_sha_prefix(&transcript_bytes),
        expected_sas = %sas
    );
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
    let db_transcript = repo::load_handshake_transcript(pool, &handle.session_id)
        .await?
        .unwrap_or_default();
    let transcript_source = if db_transcript.is_empty() {
        "ipc"
    } else {
        "db"
    };
    let transcript_bytes = if !db_transcript.is_empty() {
        db_transcript
    } else {
        handshake_transcript.to_vec()
    };

    let transcript_join = transcript_bytes.len() > 32
        && transcript_bytes.as_slice() != identity.fingerprint.as_bytes();
    let entered = normalise_sas_input(digits);
    let local_expected = if transcript_bytes.is_empty() {
        None
    } else {
        Some(derive_sas_from_transcript(&transcript_bytes))
    };
    let local_match = matches!(
        (&entered, &local_expected),
        (Some(a), Some(b)) if a == b
    );
    tracing::info!(
        target: "medoc::cluster",
        event = "CLUSTER_SAS_SUBMIT",
        session_id = %handle.session_id,
        transcript_source,
        transcript_len = transcript_bytes.len(),
        transcript_sha = %transcript_sha_prefix(&transcript_bytes),
        expected_sas = %local_expected.as_deref().unwrap_or(""),
        entered_sas = %entered.as_deref().unwrap_or(""),
        sas_match = local_match
    );

    let Some(sas_digits) = entered.clone() else {
        return Err(AppError::Validation("SAS must be 4 digits".into()));
    };
    let mut remote_err: Option<AppError> = None;
    for (host, port) in resolve_sas_admin_endpoints(pool).await? {
        match confirm_sas_on_admin(&host, port, &handle.session_id, &sas_digits).await {
            Ok(lan) => {
                if !local_match {
                    tracing::warn!(
                        target: "medoc::cluster",
                        event = "CLUSTER_SAS_TRANSCRIPT_DIVERGE",
                        session_id = %handle.session_id,
                        expected_sas = %local_expected.as_deref().unwrap_or(""),
                        entered_sas = %sas_digits
                    );
                }
                if let Err(e) = store_join_lan_auth(
                    pool,
                    lan.activation_token.as_deref(),
                    lan.master_pubkey.as_deref(),
                    lan.master_device_id.as_deref(),
                )
                .await
                {
                    tracing::warn!(
                        target: "medoc::cluster",
                        event = "CLUSTER_JOIN_LAN_AUTH_STORE_FAILED",
                        error = %e
                    );
                }
                return provision_joiner_after_sas(pool, user_id, handle).await;
            }
            Err(e) => {
                tracing::warn!(
                    target: "medoc::cluster",
                    event = "CLUSTER_SAS_REMOTE_FAILED",
                    host = %host,
                    port,
                    error = %e
                );
                remote_err = Some(e);
            }
        }
    }
    if local_match {
        if let Some(e) = remote_err.as_ref() {
            tracing::warn!(
                target: "medoc::cluster",
                event = "CLUSTER_SAS_REMOTE_BYPASS_LOCAL_MATCH",
                session_id = %handle.session_id,
                expected_sas = %sas_digits,
                error = %e
            );
        }
        return provision_joiner_after_sas(pool, user_id, handle).await;
    }

    if transcript_join {
        return Err(remote_err.unwrap_or_else(|| AppError::Validation("SAS does not match".into())));
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

async fn provision_joiner_after_sas(
    pool: &SqlitePool,
    user_id: &str,
    handle: &PairingHandle,
) -> Result<ProvisionResult, AppError> {
    let repos = SqliteClusterRepos { pool };
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
        if let Err(e) = activate_replica_after_sas_confirm(pool).await {
            tracing::warn!(
                target: "medoc::cluster",
                event = "REPLICA_ACTIVATION_FAILED",
                error = %e
            );
        }
        match SyncEngine::run_replica_sync_until_caught_up(pool).await {
            Ok(report) => {
                tracing::info!(
                    target: "medoc::sync",
                    event = "REPLICA_INITIAL_SYNC",
                    pull_applied = report.pull.as_ref().map(|p| p.applied).unwrap_or(0),
                    push_accepted = report.push.as_ref().map(|p| p.accepted).unwrap_or(0),
                    error = report.error.as_deref().unwrap_or("")
                );
            }
            Err(e) => tracing::warn!(
                target: "medoc::sync",
                event = "REPLICA_INITIAL_SYNC_FAILED",
                error = %e
            ),
        }
        if let Err(e) =
            audit::log_pairing(pool, user_id, "PROVISION", Some(&handle.session_id), None).await
        {
            tracing::warn!(
                target: "medoc::cluster",
                event = "CLUSTER_SAS_AUDIT_FAILED",
                error = %e
            );
        }
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

/// Replica-facing check: digits must match the SAS derived from the stored handshake
/// (same value the admin UI shows). HMAC is only a fallback when no transcript exists.
pub async fn verify_inbound_sas(
    pool: &SqlitePool,
    session_id: &str,
    digits: &str,
) -> Result<(), AppError> {
    let repos = SqliteClusterRepos { pool };
    let Some(license) = repos.load().await? else {
        return Err(AppError::Validation("No cluster".into()));
    };
    let Some(session) = repos.load_session(session_id).await? else {
        return Err(AppError::NotFound("Pairing session not found".into()));
    };
    let Some(entered) = normalise_sas_input(digits) else {
        return Err(AppError::Validation("SAS must be 4 digits".into()));
    };
    let transcript = repo::load_handshake_transcript(pool, session_id)
        .await?
        .unwrap_or_default();
    let from_transcript = if transcript.is_empty() {
        None
    } else {
        Some(derive_sas_from_transcript(&transcript))
    };
    tracing::info!(
        target: "medoc::cluster",
        event = "CLUSTER_SAS_REMOTE",
        session_id,
        pairing_state = session.state.as_str(),
        has_sas_hash = session.sas_hash.is_some(),
        transcript_len = transcript.len(),
        transcript_sha = %transcript_sha_prefix(&transcript),
        expected_sas = %from_transcript.as_deref().unwrap_or(""),
        entered_sas = %entered
    );

    let transcript_ok = from_transcript.as_deref() == Some(entered.as_str());
    let hmac_ok = session
        .sas_hash
        .as_deref()
        .map(|expected_hash| {
            verify_sas(
                session_id,
                &entered,
                expected_hash,
                &license.signing_key_enc,
            )
        })
        .unwrap_or(false);
    tracing::info!(
        target: "medoc::cluster",
        event = "CLUSTER_SAS_REMOTE_CHECK",
        session_id,
        transcript_ok,
        hmac_ok
    );
    if !transcript_ok && !hmac_ok {
        return Err(AppError::Validation("SAS does not match".into()));
    }

    let sas_hash = hash_sas(session_id, &entered, &license.signing_key_enc);
    if session.state != PairingStatus::AwaitingSas
        || session.sas_hash.as_deref() != Some(sas_hash.as_slice())
    {
        repos
            .update_state(session_id, PairingStatus::AwaitingSas, Some(&sas_hash))
            .await?;
    }
    tracing::info!(
        target: "medoc::cluster",
        event = "CLUSTER_SAS_REMOTE_OK",
        session_id,
        expected_sas = %entered
    );
    enroll_joiner_after_sas(pool, &session, &license).await?;
    if let Err(e) = mint_join_activation_token(pool, &session).await {
        tracing::warn!(
            target: "medoc::cluster",
            event = "CLUSTER_JOIN_ACTIVATION_TOKEN_FAILED",
            error = %e
        );
    }
    if let Err(e) = crate::repo::enqueue_full_snapshot(pool).await {
        tracing::warn!(
            target: "medoc::sync",
            event = "SYNC_SNAPSHOT_AFTER_SAS_FAILED",
            error = %e
        );
    }
    Ok(())
}

async fn enroll_joiner_after_sas(
    pool: &SqlitePool,
    session: &PairingSession,
    license: &crate::cluster::entities::License,
) -> Result<(), AppError> {
    if let Ok(Some(local)) = DeviceIdentity::try_load() {
        if local.fingerprint == session.fingerprint {
            tracing::warn!(
                target: "medoc::cluster",
                event = "CLUSTER_JOIN_IDENTITY_COLLISION",
                fingerprint = %session.fingerprint
            );
            return Ok(());
        }
    }
    let pubkey = repo::load_slave_pubkey(pool, &session.id).await?;
    if pubkey.len() != 32 {
        tracing::warn!(
            target: "medoc::cluster",
            event = "CLUSTER_JOIN_ENROLL_SKIP_NO_PUBKEY",
            session_id = %session.id,
            pubkey_len = pubkey.len()
        );
        return Ok(());
    }
    let repos = SqliteClusterRepos { pool };
    let device = Device {
        fingerprint: session.fingerprint.clone(),
        cluster_id: license.cluster_id.clone(),
        device_id: session.fingerprint.clone(),
        pubkey,
        hostname: session.hostname.clone(),
        os: Some(std::env::consts::OS.into()),
        last_ip: None,
        seat_role: session.requested_role,
        status: DeviceStatus::Active,
        seat_cert: None,
        last_seen: Some(Utc::now()),
        created_at: Utc::now(),
    };
    repos.upsert(&device).await?;
    repos
        .update_state(&session.id, PairingStatus::SasConfirmed, None)
        .await?;
    tracing::info!(
        target: "medoc::cluster",
        event = "CLUSTER_JOINER_ENROLLED_AFTER_SAS",
        fingerprint = %session.fingerprint,
        seat_role = %session.requested_role.as_str()
    );
    Ok(())
}

/// Mint (if needed) and return LAN credentials for a replica that already
/// completed join/SAS. Lets the 5s sync loop recover when SAS never stored
/// the mt2 token on the replica.
pub async fn issue_replica_lan_auth(
    pool: &SqlitePool,
    fingerprint: &str,
    session_id: &str,
) -> Result<SasConfirmOutcome, AppError> {
    let mut sid = session_id.trim().to_string();
    if sid.is_empty() {
        let found: Option<String> = sqlx::query_scalar(
            "SELECT id FROM pairing_request
             WHERE TRIM(fingerprint) = ?1 OR TRIM(device_id) = ?1
             ORDER BY requested_at DESC LIMIT 1",
        )
        .bind(fingerprint.trim())
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
        sid = found.unwrap_or_default();
    }
    if sid.is_empty() {
        return Err(AppError::Forbidden);
    }
    let existing: String = sqlx::query_scalar(
        "SELECT COALESCE(activation_token, '') FROM pairing_request WHERE id = ?1",
    )
    .bind(&sid)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?
    .unwrap_or_default();
    let signing_key = master_keys::load_or_create()?;
    let token_ok = {
        let t = existing.trim();
        !t.is_empty() && verify_activation_token(t, &signing_key.verifying_key()).is_ok()
    };
    if !token_ok {
        let repos = SqliteClusterRepos { pool };
        let Some(session) = repos.load_session(&sid).await? else {
            return Err(AppError::NotFound("Pairing session not found".into()));
        };
        mint_join_activation_token(pool, &session).await?;
    }
    let token: Option<String> = sqlx::query_scalar::<_, Option<String>>(
        "SELECT activation_token FROM pairing_request WHERE id = ?1",
    )
    .bind(&sid)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?
    .flatten()
    .filter(|s: &String| !s.trim().is_empty());
    let master_pubkey = crate::master_keys::load_or_create()
        .ok()
        .map(|sk| crate::master_keys::pubkey_b64(&sk));
    let master_device_id = crate::repo::ensure_local_device(pool, "Main")
        .await
        .ok()
        .filter(|s| !s.trim().is_empty());
    tracing::info!(
        target: "medoc::cluster",
        event = "REPLICA_LAN_AUTH_ISSUED",
        session_id = %sid,
        has_token = token.is_some()
    );
    Ok(SasConfirmOutcome {
        activation_token: token,
        master_pubkey,
        master_device_id,
    })
}

/// Replica: pull mt2 + master device id from the stored admin endpoint and
/// write them into deployment so HTTPS sync can run without a new SAS.
pub async fn refresh_replica_lan_auth(pool: &SqlitePool) -> Result<bool, AppError> {
    let Some((host, port)) = load_join_admin_endpoint(pool).await? else {
        return Ok(false);
    };
    let identity = DeviceIdentity::load_or_create()?;
    let session_id = super::staff_directory::load_join_session_id(pool).await?;
    let lan = fetch_replica_auth(&host, port, &identity, &session_id).await?;
    store_join_lan_auth(
        pool,
        lan.activation_token.as_deref(),
        lan.master_pubkey.as_deref(),
        lan.master_device_id.as_deref(),
    )
    .await?;
    apply_replica_deployment_from_join(pool).await?;
    Ok(lan.activation_token.is_some())
}

async fn mint_join_activation_token(
    pool: &SqlitePool,
    session: &PairingSession,
) -> Result<(), AppError> {
    crate::schema::ensure_sync_tables(pool).await?;
    let signing_key = master_keys::load_or_create()?;
    let master_device_id = crate::repo::ensure_local_device(pool, "Main").await?;
    let now = Utc::now().to_rfc3339();
    let actions: Vec<String> = DEFAULT_ALLOWED_ACTIONS
        .iter()
        .map(|s| (*s).to_string())
        .collect();
    let payload = ActivationTokenPayload {
        version: 2,
        device_id: session.fingerprint.clone(),
        slave_label: session.hostname.clone().unwrap_or_default(),
        master_device_id,
        allowed_actions: actions.clone(),
        issued_at: now.clone(),
        nonce: Uuid::new_v4().to_string(),
    };
    let token = mint_activation_token(&signing_key, &payload)?;
    sqlx::query(
        "UPDATE pairing_request SET
            status = 'ACCEPTED',
            activation_token = ?1,
            decided_at = ?2,
            decided_by = 'cluster-sas'
         WHERE id = ?3",
    )
    .bind(&token)
    .bind(&now)
    .bind(&session.id)
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    sqlx::query("DELETE FROM slave_permission WHERE device_id = ?1")
        .bind(&session.fingerprint)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    for action in &actions {
        sqlx::query(
            "INSERT INTO slave_permission (device_id, action, granted_at, granted_by)
             VALUES (?1, ?2, ?3, 'cluster-sas')",
        )
        .bind(&session.fingerprint)
        .bind(action)
        .bind(&now)
        .execute(pool)
        .await
        .map_err(AppError::Database)?;
    }
    tracing::info!(
        target: "medoc::cluster",
        event = "CLUSTER_JOIN_ACTIVATION_TOKEN_MINTED",
        session_id = %session.id
    );
    Ok(())
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

/// After SAS matches: this install is a replica of the practice it joined.
/// Does not change handshake/SAS; it only sets local seat, deployment, and onboarding
/// so the signed-in staff account can use the app without owner/practice-setup conflicts.
pub async fn activate_replica_after_sas_confirm(pool: &SqlitePool) -> Result<(), AppError> {
    let identity = DeviceIdentity::load_or_create()?;
    if !is_provisioned(pool, &identity.fingerprint).await? {
        mark_provisioned(pool, &identity.fingerprint).await?;
    }
    demote_local_cluster_seat_to_member(pool).await?;
    apply_replica_deployment_from_join(pool).await?;
    app_kv_repo::set(pool, ONBOARDING_SETUP_KV_KEY, "1").await?;
    tracing::info!(
        target: "medoc::cluster",
        event = "REPLICA_ACTIVATED_AFTER_SAS"
    );
    Ok(())
}

async fn demote_local_cluster_seat_to_member(pool: &SqlitePool) -> Result<(), AppError> {
    let identity = DeviceIdentity::load_or_create()?;
    let repos = SqliteClusterRepos { pool };
    let Some(license) = repos.load().await? else {
        return Ok(());
    };
    let mut keys = vec![identity.fingerprint.clone()];
    if let Ok(device_id) = medoc_core::infrastructure::license_repo::ensure_device_id(pool).await {
        if !keys.iter().any(|k| k == &device_id) {
            keys.push(device_id);
        }
    }
    for key in keys {
        if let Some(mut device) = repos.find_by_fingerprint(&key).await? {
            device.seat_role = SeatRole::Member;
            device.status = DeviceStatus::Active;
            repos.upsert(&device).await?;
        }
        if let Some(mut device) = repo::find_by_device_id(pool, &key, &license.cluster_id).await? {
            device.seat_role = SeatRole::Member;
            device.status = DeviceStatus::Active;
            repos.upsert(&device).await?;
        }
    }
    sqlx::query(
        "UPDATE sync_device
         SET seat_role = 'MEMBER', role = 'REPLICA'
         WHERE is_local = 1
           AND (seat_role = 'ADMIN' OR role = 'MASTER')",
    )
    .execute(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(())
}

async fn apply_replica_deployment_from_join(pool: &SqlitePool) -> Result<(), AppError> {
    let snap = SyncEngine::status(pool).await?;
    let mut cfg = snap.deployment;
    cfg.mode = DeploymentMode::ServerlessPeer;
    cfg.role = DeviceRole::Replica;
    cfg.unstable_mesh = false;
    if cfg.device_label.trim().is_empty() {
        cfg.device_label = "Replica".into();
    }
    if cfg.master_base_url.trim().is_empty() {
        if let Some((host, _)) = load_join_admin_endpoint(pool).await? {
            cfg.master_base_url = format!("https://{host}:{DEFAULT_REPLICA_HTTP_PORT}");
        }
    }
    if let Ok(Some(auth)) = load_join_lan_auth(pool).await {
        cfg.activation_token = auth.activation_token;
        if !auth.master_pubkey.trim().is_empty() {
            cfg.master_pubkey = auth.master_pubkey;
        }
        if !auth.master_device_id.trim().is_empty() {
            cfg.master_device_id = auth.master_device_id;
        }
    }
    SyncEngine::set_deployment(pool, cfg).await
}

async fn resolve_sas_admin_endpoints(pool: &SqlitePool) -> Result<Vec<(String, u16)>, AppError> {
    let port = crate::net::DEFAULT_CLUSTER_PORT;
    let mut out = Vec::new();
    let mut push = |host: String, p: u16| {
        if !out.iter().any(|(h, q)| h == &host && *q == p) {
            out.push((host, p));
        }
    };
    if let Some((host, p)) = load_join_admin_endpoint(pool).await? {
        push(host, p);
    }
    push("127.0.0.1".into(), port);
    if let Some(ip) = medoc_core::discovery::pick_private_lan_ipv4() {
        let s = ip.to_string();
        if s != "127.0.0.1" {
            push(s, port);
        }
    }
    Ok(out)
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
