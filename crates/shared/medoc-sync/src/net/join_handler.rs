//! Admin-side handler for inbound verbund TCP connections (pairing + cluster status + reset).

use medoc_core::error::AppError;
use sqlx::SqlitePool;
use tokio::net::TcpStream;

use crate::verbund::SeatRolle;
use crate::verbund::services::cluster_reset_service::{load_pending_reset, queue_verified_remote_reset};
use crate::verbund::services::create_join_request;
use crate::verbund::services::export_staff_directory_json;

use super::channel::{recv_wire_message, send_wire_message};
use super::handshake::run_xx_responder;
use super::transport::NoiseTransport;
use super::wire::{SeatRolleWire, WireMessage};

/// Handle one inbound verbund connection on the admin or member device.
pub async fn handle_verbund_connection(mut stream: TcpStream, pool: SqlitePool) {
    if let Err(e) = handle_verbund_connection_inner(&mut stream, &pool).await {
        tracing::warn!(
            target: "medoc::verbund",
            event = "VERBUND_CONN_HANDLER_ERR",
            error = %e
        );
    }
}

/// Backward-compatible alias used by the listener loop.
pub async fn handle_join_connection(stream: TcpStream, pool: SqlitePool) {
    handle_verbund_connection(stream, pool).await;
}

const VERBUND_CONN_STACK: usize = 8 * 1024 * 1024;

/// Run inbound verbund TCP on a dedicated thread with a larger stack (Noise/snow).
pub fn spawn_verbund_connection_handler(stream: TcpStream, pool: SqlitePool) {
    if std::thread::Builder::new()
        .name("verbund-tcp".into())
        .stack_size(VERBUND_CONN_STACK)
        .spawn(move || {
            let rt = match tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
            {
                Ok(rt) => rt,
                Err(e) => {
                    tracing::warn!(
                        target: "medoc::verbund",
                        event = "VERBUND_CONN_RUNTIME_ERR",
                        error = %e
                    );
                    return;
                }
            };
            rt.block_on(handle_verbund_connection(stream, pool));
        })
        .is_err()
    {
        tracing::warn!(
            target: "medoc::verbund",
            event = "VERBUND_CONN_THREAD_SPAWN_FAILED"
        );
    }
}

async fn handle_verbund_connection_inner(
    stream: &mut TcpStream,
    pool: &SqlitePool,
) -> Result<(), AppError> {
    let (mut transport, transcript) = run_xx_responder(stream).await?;
    let msg = recv_wire_message(stream, &mut transport).await?;

    match msg {
        WireMessage::JoinRequest {
            fingerprint,
            hostname,
            requested_role,
            ..
        } => handle_join_request(stream, &mut transport, pool, &transcript, fingerprint, hostname, requested_role).await,
        WireMessage::ClusterStatusRequest { cluster_id, .. } => {
            handle_cluster_status_request(stream, &mut transport, pool, &cluster_id).await
        }
        WireMessage::ClusterReset {
            token_json,
            signature_b64,
        } => handle_inbound_cluster_reset(stream, &mut transport, pool, &token_json, &signature_b64).await,
        WireMessage::StaffDirectoryRequest { fingerprint } => {
            handle_staff_directory_request(stream, &mut transport, pool, &fingerprint).await
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
    requested_role: SeatRolleWire,
) -> Result<(), AppError> {
    let role = match requested_role {
        SeatRolleWire::Admin => SeatRolle::Admin,
        SeatRolleWire::Member => SeatRolle::Member,
    };

    let handle = match create_join_request(
        pool,
        &fingerprint,
        role,
        transcript,
        None,
        Some(hostname.as_str()),
    )
    .await
    {
        Ok(h) => h,
        Err(e) => {
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

    send_wire_message(
        stream,
        transport,
        &WireMessage::JoinAccept {
            session_id: handle.session_id,
        },
    )
    .await?;

    tracing::info!(
        target: "medoc::verbund",
        event = "VERBUND_JOIN_ACCEPTED",
        fingerprint = %fingerprint,
    );
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
) -> Result<(), AppError> {
    let allowed = staff_directory_request_allowed(pool, fingerprint).await?;
    if !allowed {
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

async fn staff_directory_request_allowed(
    pool: &SqlitePool,
    fingerprint: &str,
) -> Result<bool, AppError> {
    let cluster: Option<(i64,)> = sqlx::query_as("SELECT 1 FROM lizenz LIMIT 1")
        .fetch_optional(pool)
        .await
        .map_err(AppError::Database)?;
    if cluster.is_none() {
        return Ok(false);
    }
    let geraet: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM geraet WHERE fingerprint = ?1 AND status = 'ACTIVE' LIMIT 1",
    )
    .bind(fingerprint)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    if geraet.is_some() {
        return Ok(true);
    }
    let session: Option<(i64,)> = sqlx::query_as(
        "SELECT 1 FROM pairing_request WHERE fingerprint = ?1 OR device_id = ?1 LIMIT 1",
    )
    .bind(fingerprint)
    .fetch_optional(pool)
    .await
    .map_err(AppError::Database)?;
    Ok(session.is_some())
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
        target: "medoc::verbund",
        event = "CLUSTER_RESET_QUEUED_INBOUND",
    );
    Ok(())
}
