//! Admin-side handler for inbound cluster TCP connections (pairing + cluster status + reset).

use medoc_core::error::AppError;
use sqlx::SqlitePool;
use tokio::net::TcpStream;

use crate::cluster::services::cluster_reset_service::{
    load_pending_reset, queue_verified_remote_reset,
};
use crate::cluster::services::create_join_request;
use crate::cluster::services::export_staff_directory_json;
use crate::cluster::services::issue_replica_lan_auth;
use crate::cluster::services::record_join_identity;
use crate::cluster::services::store_join_device_pubkey;
use crate::cluster::services::verify_inbound_sas;
use crate::cluster::SeatRole;

use super::channel::{recv_wire_message, send_wire_message};
use super::handshake::run_xx_responder;
use super::transport::NoiseTransport;
use super::wire::{SeatRoleWire, WireMessage};

/// Handle one inbound cluster connection on the admin or member device.
pub async fn handle_cluster_connection(mut stream: TcpStream, pool: SqlitePool) {
    if let Err(e) = handle_cluster_connection_inner(&mut stream, &pool).await {
        tracing::warn!(
            target: "medoc::cluster",
            event = "CLUSTER_CONN_HANDLER_ERR",
            error = %e
        );
    }
}

/// Backward-compatible alias used by the listener loop.
pub async fn handle_join_connection(stream: TcpStream, pool: SqlitePool) {
    handle_cluster_connection(stream, pool).await;
}

const CLUSTER_CONN_STACK: usize = 8 * 1024 * 1024;

/// Run inbound cluster TCP on a dedicated thread with a larger stack (Noise/snow).
pub fn spawn_cluster_connection_handler(stream: TcpStream, pool: SqlitePool) {
    if std::thread::Builder::new()
        .name("cluster-tcp".into())
        .stack_size(CLUSTER_CONN_STACK)
        .spawn(move || {
            let rt = match tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
            {
                Ok(rt) => rt,
                Err(e) => {
                    tracing::warn!(
                        target: "medoc::cluster",
                        event = "CLUSTER_CONN_RUNTIME_ERR",
                        error = %e
                    );
                    return;
                }
            };
            rt.block_on(handle_cluster_connection(stream, pool));
        })
        .is_err()
    {
        tracing::warn!(
            target: "medoc::cluster",
            event = "CLUSTER_CONN_THREAD_SPAWN_FAILED"
        );
    }
}

async fn handle_cluster_connection_inner(
    stream: &mut TcpStream,
    pool: &SqlitePool,
) -> Result<(), AppError> {
    let (mut transport, transcript) = run_xx_responder(stream).await?;
    let msg = recv_wire_message(stream, &mut transport).await?;

    match msg {
        WireMessage::JoinRequest {
            fingerprint,
            pubkey,
            hostname,
            ip,
            requested_role,
            ..
        } => {
            handle_join_request(
                stream,
                &mut transport,
                pool,
                &transcript,
                fingerprint,
                hostname,
                ip,
                requested_role,
                pubkey,
            )
            .await
        }
        WireMessage::ClusterStatusRequest { cluster_id, .. } => {
            handle_cluster_status_request(stream, &mut transport, pool, &cluster_id).await
        }
        WireMessage::ClusterReset {
            token_json,
            signature_b64,
        } => {
            handle_inbound_cluster_reset(stream, &mut transport, pool, &token_json, &signature_b64)
                .await
        }
        WireMessage::StaffDirectoryRequest {
            fingerprint,
            session_id,
        } => {
            handle_staff_directory_request(stream, &mut transport, pool, &fingerprint, &session_id)
                .await
        }
        WireMessage::ReplicaAuthRequest {
            fingerprint,
            session_id,
        } => {
            handle_replica_auth_request(stream, &mut transport, pool, &fingerprint, &session_id)
                .await
        }
        WireMessage::SasConfirm { session_id, digits } => {
            handle_sas_confirm(stream, &mut transport, pool, &session_id, &digits).await
        }
        other => {
            send_wire_message(
                stream,
                &mut transport,
                &WireMessage::Error {
                    code: "INVALID_MSG".into(),
                    message: format!("unexpected message: {other:?}"),
                },
            )
            .await?;
            Ok(())
        }
    }
}

async fn handle_join_request(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    pool: &SqlitePool,
    transcript: &[u8],
    fingerprint: String,
    hostname: String,
    advertised_ip: String,
    requested_role: SeatRoleWire,
    pubkey: Vec<u8>,
) -> Result<(), AppError> {
    let role = match requested_role {
        SeatRoleWire::Admin => SeatRole::Admin,
        SeatRoleWire::Member => SeatRole::Member,
    };

    let peer_ip = stream.peer_addr().ok().map(|addr| crate::pairing::canonical_peer_ip(addr.ip()));
    let requester_ip = crate::pairing::choose_requester_ip(peer_ip.as_deref(), &advertised_ip);
    let requester_ip = if requester_ip.is_empty() {
        None
    } else {
        Some(requester_ip)
    };
    let hostname = {
        let trimmed = hostname.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    };
    let handle = match create_join_request(
        pool,
        &fingerprint,
        role,
        transcript,
        None,
        hostname,
        requester_ip.as_deref(),
    )
    .await
    {
        Ok(h) => h,
        Err(e) => {
            let _ = record_join_identity(pool, &fingerprint, hostname, requester_ip.as_deref()).await;
            if !pubkey.is_empty() {
                let _ = store_join_device_pubkey(pool, &fingerprint, &pubkey).await;
            }
            send_wire_message(
                stream,
                transport,
                &WireMessage::Error {
                    code: "JOIN_FAILED".into(),
                    message: e.to_string(),
                },
            )
            .await?;
            return Ok(());
        }
    };
    if !pubkey.is_empty() {
        if let Err(e) = store_join_device_pubkey(pool, &handle.session_id, &pubkey).await {
            tracing::warn!(
                target: "medoc::cluster",
                event = "CLUSTER_JOIN_PUBKEY_STORE_FAILED",
                error = %e
            );
        }
    }

    send_wire_message(
        stream,
        transport,
        &WireMessage::JoinAccept {
            session_id: handle.session_id,
            activation_token: None,
            master_pubkey: None,
            master_device_id: None,
        },
    )
    .await?;

    tracing::info!(
        target: "medoc::cluster",
        event = "CLUSTER_JOIN_ACCEPTED",
        fingerprint = %fingerprint,
    );
    Ok(())
}

async fn handle_sas_confirm(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    pool: &SqlitePool,
    session_id: &str,
    digits: &str,
) -> Result<(), AppError> {
    match verify_inbound_sas(pool, session_id, digits).await {
        Ok(()) => {
            let (activation_token, master_pubkey, master_device_id) =
                load_join_lan_credentials(pool, session_id).await;
            send_wire_message(
                stream,
                transport,
                &WireMessage::JoinAccept {
                    session_id: session_id.to_string(),
                    activation_token,
                    master_pubkey,
                    master_device_id,
                },
            )
            .await?;
        }
        Err(e) => {
            send_wire_message(
                stream,
                transport,
                &WireMessage::Error {
                    code: "SAS_MISMATCH".into(),
                    message: e.to_string(),
                },
            )
            .await?;
        }
    }
    Ok(())
}

async fn handle_cluster_status_request(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    pool: &SqlitePool,
    cluster_id: &str,
) -> Result<(), AppError> {
    let pending = load_pending_reset(pool).await?;
    let response = if let Some(p) = pending {
        WireMessage::ClusterStatusResponse {
            reset_pending: true,
            token_json: Some(p.token_json),
            signature_b64: Some(p.signature_b64),
        }
    } else {
        WireMessage::ClusterStatusResponse {
            reset_pending: false,
            token_json: None,
            signature_b64: None,
        }
    };
    let _ = cluster_id;
    send_wire_message(stream, transport, &response).await?;
    Ok(())
}

async fn handle_staff_directory_request(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    pool: &SqlitePool,
    fingerprint: &str,
    session_id: &str,
) -> Result<(), AppError> {
    let allowed = staff_directory_request_allowed(pool, fingerprint, session_id).await?;
    if !allowed {
        tracing::warn!(
            target: "medoc::cluster",
            event = "STAFF_DENIED",
            fingerprint = %fingerprint.trim(),
            session_id = %session_id.trim()
        );
        send_wire_message(
            stream,
            transport,
            &WireMessage::Error {
                code: "STAFF_DENIED".into(),
                message: "Device not authorised for staff directory.".into(),
            },
        )
        .await?;
        return Ok(());
    }

    let directory_json = export_staff_directory_json(pool).await?;
    send_wire_message(
        stream,
        transport,
        &WireMessage::StaffDirectoryResponse { directory_json },
    )
    .await?;
    Ok(())
}

async fn handle_replica_auth_request(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    pool: &SqlitePool,
    fingerprint: &str,
    session_id: &str,
) -> Result<(), AppError> {
    let allowed = staff_directory_request_allowed(pool, fingerprint, session_id).await?;
    if !allowed {
        tracing::warn!(
            target: "medoc::cluster",
            event = "REPLICA_AUTH_DENIED",
            fingerprint = %fingerprint.trim(),
            session_id = %session_id.trim()
        );
        send_wire_message(
            stream,
            transport,
            &WireMessage::Error {
                code: "STAFF_DENIED".into(),
                message: "Device not authorised for replica auth.".into(),
            },
        )
        .await?;
        return Ok(());
    }
    match issue_replica_lan_auth(pool, fingerprint, session_id).await {
        Ok(lan) => {
            send_wire_message(
                stream,
                transport,
                &WireMessage::JoinAccept {
                    session_id: session_id.trim().to_string(),
                    activation_token: lan.activation_token,
                    master_pubkey: lan.master_pubkey,
                    master_device_id: lan.master_device_id,
                },
            )
            .await?;
        }
        Err(e) => {
            tracing::warn!(
                target: "medoc::cluster",
                event = "REPLICA_AUTH_FAILED",
                error = %e
            );
            send_wire_message(
                stream,
                transport,
                &WireMessage::Error {
                    code: "AUTH_FAILED".into(),
                    message: e.to_string(),
                },
            )
            .await?;
        }
    }
    Ok(())
}

async fn staff_directory_request_allowed(
    pool: &SqlitePool,
    fingerprint: &str,
    session_id: &str,
) -> Result<bool, AppError> {
    let fp = fingerprint.trim();
    let sid = session_id.trim();
    if fp.is_empty() && sid.is_empty() {
        return Ok(false);
    }
    if !sid.is_empty() {
        let by_session: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM pairing_request WHERE id = ?1")
                .bind(sid)
                .fetch_one(pool)
                .await
                .map_err(AppError::Database)?;
        if by_session > 0 {
            return Ok(true);
        }
    }
    if fp.is_empty() {
        return Ok(false);
    }
    let device: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_device
         WHERE TRIM(fingerprint) = ?1
           AND device_status IN ('ACTIVE', 'PENDING')",
    )
    .bind(fp)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    if device > 0 {
        return Ok(true);
    }
    let session: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM pairing_request
         WHERE TRIM(fingerprint) = ?1 OR TRIM(device_id) = ?1",
    )
    .bind(fp)
    .fetch_one(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(session > 0)
}

async fn load_join_lan_credentials(
    pool: &SqlitePool,
    session_id: &str,
) -> (Option<String>, Option<String>, Option<String>) {
    let token: Option<String> =
        sqlx::query_scalar("SELECT activation_token FROM pairing_request WHERE id = ?1")
            .bind(session_id)
            .fetch_optional(pool)
            .await
            .ok()
            .flatten()
            .filter(|s: &String| !s.trim().is_empty());
    let master_pubkey = crate::master_keys::load_or_create()
        .ok()
        .map(|sk| crate::master_keys::pubkey_b64(&sk));
    let master_device_id = crate::repo::ensure_local_device(pool, "Main")
        .await
        .ok()
        .filter(|s| !s.trim().is_empty());
    (token, master_pubkey, master_device_id)
}

async fn handle_inbound_cluster_reset(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    pool: &SqlitePool,
    token_json: &str,
    signature_b64: &str,
) -> Result<(), AppError> {
    queue_verified_remote_reset(pool, token_json, signature_b64).await?;
    send_wire_message(
        stream,
        transport,
        &WireMessage::Error {
            code: "RESET_QUEUED".into(),
            message: "Cluster reset queued".into(),
        },
    )
    .await?;
    tracing::warn!(
        target: "medoc::cluster",
        event = "CLUSTER_RESET_QUEUED_INBOUND",
    );
    Ok(())
}
