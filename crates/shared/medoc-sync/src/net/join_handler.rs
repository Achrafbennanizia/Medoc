//! Admin-side handler for inbound cluster TCP connections (pairing + cluster status + reset).

use medoc_core::error::AppError;
use sqlx::SqlitePool;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::sync::watch;

use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Duration;

use crate::cluster::crypto::{
    fingerprint_matches_pubkey, verify_channel_signature, ChannelPurpose,
};
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
pub async fn handle_cluster_connection(stream: TcpStream, pool: SqlitePool) {
    let (_tx, cancel) = watch::channel(false);
    handle_cluster_connection_until(stream, pool, cancel).await;
}

/// One connection carries exactly one request; nothing legitimate takes this
/// long. Bounds slow / silent peers (each connection owns a thread).
const CLUSTER_CONN_TIMEOUT: Duration = Duration::from_secs(60);
/// Max. concurrent inbound cluster connections (each runs on its own thread
/// with an 8 MiB stack). Further connections are closed immediately.
const MAX_CONCURRENT_CONNECTIONS: usize = 32;
static ACTIVE_CONNECTIONS: AtomicUsize = AtomicUsize::new(0);

/// Decrements the active-connection counter when the handler ends.
struct ConnectionSlot;

impl ConnectionSlot {
    fn acquire() -> Option<Self> {
        let prev = ACTIVE_CONNECTIONS.fetch_add(1, Ordering::AcqRel);
        if prev >= MAX_CONCURRENT_CONNECTIONS {
            ACTIVE_CONNECTIONS.fetch_sub(1, Ordering::AcqRel);
            None
        } else {
            Some(Self)
        }
    }
}

impl Drop for ConnectionSlot {
    fn drop(&mut self) {
        ACTIVE_CONNECTIONS.fetch_sub(1, Ordering::AcqRel);
    }
}

/// Same handler, but `cancel` becoming `true` closes the socket immediately.
pub async fn handle_cluster_connection_until(
    mut stream: TcpStream,
    pool: SqlitePool,
    cancel: watch::Receiver<bool>,
) {
    tokio::select! {
        biased;
        _ = connection_cancelled(cancel) => {
            let _ = stream.shutdown().await;
        }
        result = tokio::time::timeout(
            CLUSTER_CONN_TIMEOUT,
            handle_cluster_connection_inner(&mut stream, &pool),
        ) => {
            match result {
                Ok(Ok(())) => {}
                Ok(Err(e)) => tracing::warn!(
                    target: "medoc::cluster",
                    event = "CLUSTER_CONN_HANDLER_ERR",
                    error = %e
                ),
                Err(_) => tracing::warn!(
                    target: "medoc::cluster",
                    event = "CLUSTER_CONN_TIMEOUT"
                ),
            }
            let _ = stream.shutdown().await;
        }
    }
}

async fn connection_cancelled(mut cancel: watch::Receiver<bool>) {
    if *cancel.borrow() {
        return;
    }
    loop {
        if cancel.changed().await.is_err() {
            return;
        }
        if *cancel.borrow() {
            return;
        }
    }
}

/// Backward-compatible alias used by the listener loop.
pub async fn handle_join_connection(stream: TcpStream, pool: SqlitePool) {
    handle_cluster_connection(stream, pool).await;
}

const CLUSTER_CONN_STACK: usize = 8 * 1024 * 1024;

/// Run inbound cluster TCP on a dedicated thread with a larger stack (Noise/snow).
///
/// The app runtime is multi-thread. Drive the handler on that runtime so the
/// pairing insert and the inbox query share one SQLite pool. A private runtime
/// can leave the write invisible and stall later inbox refreshes.
pub fn spawn_cluster_connection_handler(stream: TcpStream, pool: SqlitePool) {
    let (tx, cancel) = watch::channel(false);
    // The sender must outlive the handler. Dropping it closes the watch
    // channel, and `connection_cancelled` treats that as "stop now", which
    // resets the socket before the handshake.
    spawn_cluster_connection(stream, pool, cancel, Some(tx));
}

/// Spawn a handler that closes its socket when `cancel` becomes true.
pub fn spawn_cluster_connection_handler_until(
    stream: TcpStream,
    pool: SqlitePool,
    cancel: watch::Receiver<bool>,
) {
    spawn_cluster_connection(stream, pool, cancel, None);
}

fn spawn_cluster_connection(
    stream: TcpStream,
    pool: SqlitePool,
    cancel: watch::Receiver<bool>,
    keepalive: Option<watch::Sender<bool>>,
) {
    let Some(slot) = ConnectionSlot::acquire() else {
        tracing::warn!(
            target: "medoc::cluster",
            event = "CLUSTER_CONN_LIMIT",
            limit = MAX_CONCURRENT_CONNECTIONS
        );
        drop(stream);
        return;
    };
    let parent = tokio::runtime::Handle::try_current().ok();
    if std::thread::Builder::new()
        .name("cluster-tcp".into())
        .stack_size(CLUSTER_CONN_STACK)
        .spawn(move || {
            let _slot = slot;
            let _keepalive = keepalive;
            drive_cluster_connection(parent, stream, pool, cancel)
        })
        .is_err()
    {
        tracing::warn!(
            target: "medoc::cluster",
            event = "CLUSTER_CONN_THREAD_SPAWN_FAILED"
        );
    }
}

fn drive_cluster_connection(
    parent: Option<tokio::runtime::Handle>,
    stream: TcpStream,
    pool: SqlitePool,
    cancel: watch::Receiver<bool>,
) {
    if let Some(handle) = parent.as_ref() {
        if handle.runtime_flavor() == tokio::runtime::RuntimeFlavor::MultiThread {
            handle.block_on(handle_cluster_connection_until(stream, pool, cancel));
            return;
        }
    }
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
    rt.block_on(handle_cluster_connection_until(stream, pool, cancel));
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
            signature,
            ..
        } => {
            if !verify_channel_signature(&pubkey, ChannelPurpose::Join, &transcript, &signature) {
                return send_error(
                    stream,
                    &mut transport,
                    "JOIN_FAILED",
                    "Device signature missing or invalid. Update MeDoc on this device and try again.",
                )
                .await;
            }
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
            pubkey,
            signature,
        } => {
            if !proves_device_key(
                &fingerprint,
                &pubkey,
                ChannelPurpose::StaffDirectory,
                &transcript,
                &signature,
            ) {
                return send_error(
                    stream,
                    &mut transport,
                    "STAFF_DENIED",
                    "Device not authorised for staff directory.",
                )
                .await;
            }
            handle_staff_directory_request(stream, &mut transport, pool, &fingerprint, &session_id)
                .await
        }
        WireMessage::ReplicaAuthRequest {
            fingerprint,
            session_id,
            pubkey,
            signature,
        } => {
            if !proves_device_key(
                &fingerprint,
                &pubkey,
                ChannelPurpose::ReplicaAuth,
                &transcript,
                &signature,
            ) {
                return send_error(
                    stream,
                    &mut transport,
                    "STAFF_DENIED",
                    "Device not authorised for replica auth.",
                )
                .await;
            }
            handle_replica_auth_request(stream, &mut transport, pool, &fingerprint, &session_id)
                .await
        }
        WireMessage::SasConfirm {
            session_id,
            digits,
            pubkey,
            signature,
        } => {
            // The SAS may only be redeemed by the device that sent the join
            // request: its key must match the session fingerprint.
            let session_fp = session_fingerprint(pool, &session_id).await?;
            let fp_match = session_fp
                .as_deref()
                .is_some_and(|fp| fingerprint_matches_pubkey(&pubkey, fp));
            let sig_ok = fp_match
                && verify_channel_signature(
                    &pubkey,
                    ChannelPurpose::SasConfirm,
                    &transcript,
                    &signature,
                );
            if !sig_ok {
                tracing::warn!(
                    target: "medoc::cluster",
                    event = "CLUSTER_SAS_KEY_REJECTED",
                    session_id = %session_id.trim(),
                    session_fp = session_fp.as_deref().unwrap_or(""),
                    pubkey_len = pubkey.len(),
                    signature_len = signature.len(),
                    fingerprint_match = fp_match
                );
                let message = if fp_match {
                    "Device signature does not match this connection."
                } else {
                    "This confirmation was signed by a different device key than the join."
                };
                return send_error(stream, &mut transport, "SAS_MISMATCH", message).await;
            }
            handle_sas_confirm(stream, &mut transport, pool, &session_id, &digits).await
        }
        _ => send_error(stream, &mut transport, "INVALID_MSG", "unexpected message").await,
    }
}

async fn send_error(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    code: &str,
    message: &str,
) -> Result<(), AppError> {
    send_wire_message(
        stream,
        transport,
        &WireMessage::Error {
            code: code.into(),
            message: message.into(),
        },
    )
    .await
}

/// The peer owns the key behind `fingerprint` and signed this Noise session.
fn proves_device_key(
    fingerprint: &str,
    pubkey: &[u8],
    purpose: ChannelPurpose,
    transcript: &[u8],
    signature: &[u8],
) -> bool {
    let fp = fingerprint.trim();
    !fp.is_empty()
        && fingerprint_matches_pubkey(pubkey, fp)
        && verify_channel_signature(pubkey, purpose, transcript, signature)
}

async fn session_fingerprint(
    pool: &SqlitePool,
    session_id: &str,
) -> Result<Option<String>, AppError> {
    let sid = session_id.trim();
    if sid.is_empty() {
        return Ok(None);
    }
    let fp: Option<Option<String>> =
        sqlx::query_scalar("SELECT fingerprint FROM pairing_request WHERE id = ?1")
            .bind(sid)
            .fetch_optional(pool)
            .await
            .map_err(AppError::Database)?;
    Ok(fp
        .flatten()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty()))
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

    if !crate::pairing::is_pairing_enabled(pool)
        .await
        .unwrap_or(true)
    {
        send_wire_message(
            stream,
            transport,
            &WireMessage::Error {
                code: "NEW_REPLICAS_DISABLED".into(),
                message: "New replica requests are closed. Already paired devices stay connected."
                    .into(),
            },
        )
        .await?;
        return Ok(());
    }
    if !fingerprint_matches_pubkey(&pubkey, fingerprint.trim()) {
        send_wire_message(
            stream,
            transport,
            &WireMessage::Error {
                code: "JOIN_FAILED".into(),
                message: "Fingerprint does not match the device key.".into(),
            },
        )
        .await?;
        return Ok(());
    }
    let peer_ip = stream
        .peer_addr()
        .ok()
        .map(|addr| crate::pairing::canonical_peer_ip(addr.ip()));
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
            let _ =
                record_join_identity(pool, &fingerprint, hostname, requester_ip.as_deref()).await;
            tracing::warn!(
                target: "medoc::cluster",
                event = "CLUSTER_JOIN_REJECTED",
                fingerprint = %fingerprint,
                error = %e
            );
            // Generic text for the peer; details stay in the admin log.
            let message = match e {
                AppError::Forbidden => "This device is blocked on the main device.".to_string(),
                AppError::Conflict(m) => m,
                _ => "Join request could not be stored.".to_string(),
            };
            return send_error(stream, transport, "JOIN_FAILED", &message).await;
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
            master_cert_sha256: None,
            master_http_port: None,
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
            let (activation_token, master_pubkey, master_device_id, master_cert_sha256) =
                load_join_lan_credentials(pool, session_id).await;
            let master_http_port = Some(crate::cluster::services::local_lan_http_port(pool).await);
            send_wire_message(
                stream,
                transport,
                &WireMessage::JoinAccept {
                    session_id: session_id.to_string(),
                    activation_token,
                    master_pubkey,
                    master_device_id,
                    master_cert_sha256,
                    master_http_port,
                },
            )
            .await?;
        }
        Err(e) => {
            tracing::warn!(
                target: "medoc::cluster",
                event = "CLUSTER_SAS_REJECTED",
                session_id = %session_id,
                error = %e
            );
            send_error(stream, transport, "SAS_MISMATCH", &e.to_string()).await?;
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
                    master_cert_sha256: lan.master_cert_sha256,
                    master_http_port: lan.master_http_port,
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
    // Callers have already verified that the peer owns the key behind `fp`.
    // A session id alone is not a credential: it used to unlock the staff
    // directory for any session row, including requests the admin never
    // accepted or explicitly rejected.
    let fp = fingerprint.trim();
    let sid = session_id.trim();
    if fp.is_empty() {
        return Ok(false);
    }
    if crate::cluster::services::is_fingerprint_blocklisted(pool, fp).await? {
        return Ok(false);
    }
    if !sid.is_empty() {
        let by_session: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM pairing_request
             WHERE id = ?1 AND status = 'ACCEPTED'
               AND (TRIM(fingerprint) = ?2 OR TRIM(device_id) = ?2)",
        )
        .bind(sid)
        .bind(fp)
        .fetch_one(pool)
        .await
        .map_err(AppError::Database)?;
        if by_session > 0 {
            return Ok(true);
        }
    }
    let device: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sync_device
         WHERE TRIM(fingerprint) = ?1
           AND device_status = 'ACTIVE'",
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
         WHERE status = 'ACCEPTED'
           AND (TRIM(fingerprint) = ?1 OR TRIM(device_id) = ?1)",
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
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
) {
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
    let master_cert_sha256 = crate::tls_pin::load_local_pin(pool).await;
    (token, master_pubkey, master_device_id, master_cert_sha256)
}

async fn handle_inbound_cluster_reset(
    stream: &mut TcpStream,
    transport: &mut NoiseTransport,
    pool: &SqlitePool,
    token_json: &str,
    signature_b64: &str,
) -> Result<(), AppError> {
    if let Err(e) = queue_verified_remote_reset(pool, token_json, signature_b64).await {
        tracing::warn!(
            target: "medoc::cluster",
            event = "CLUSTER_RESET_REJECTED_INBOUND",
            error = %e
        );
        return send_error(
            stream,
            transport,
            "RESET_REJECTED",
            "Cluster reset rejected",
        )
        .await;
    }
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
