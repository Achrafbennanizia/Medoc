//! Admin-side handler for incoming JOIN_REQUEST over TCP.

use medoc_core::error::AppError;
use sqlx::SqlitePool;
use tokio::net::TcpStream;

use crate::verbund::services::create_join_request;
use crate::verbund::SeatRolle;

use super::channel::{recv_wire_message, send_wire_message};
use super::handshake::run_xx_responder;
use super::wire::{SeatRolleWire, WireMessage};

/// Handle one inbound verbund pairing connection on the admin device.
pub async fn handle_join_connection(mut stream: TcpStream, pool: SqlitePool) {
    if let Err(e) = handle_join_connection_inner(&mut stream, &pool).await {
        tracing::warn!(
            target: "medoc::verbund",
            event = "VERBUND_JOIN_HANDLER_ERR",
            error = %e
        );
    }
}

async fn handle_join_connection_inner(
    stream: &mut TcpStream,
    pool: &SqlitePool,
) -> Result<(), AppError> {
    let (mut transport, transcript) = run_xx_responder(stream).await?;

    let msg = recv_wire_message(stream, &mut transport).await?;
    let WireMessage::JoinRequest {
        fingerprint,
        hostname,
        requested_role,
        ..
    } = msg
    else {
        send_wire_message(
            stream,
            &mut transport,
            &WireMessage::Error {
                code: "INVALID_MSG".into(),
                message: "expected JOIN_REQUEST".into(),
            },
        )
        .await?;
        return Ok(());
    };

    let role = match requested_role {
        SeatRolleWire::Admin => SeatRolle::Admin,
        SeatRolleWire::Member => SeatRolle::Member,
    };

    let handle = match create_join_request(
        pool,
        &fingerprint,
        role,
        &transcript,
        None,
        Some(hostname.as_str()),
    )
    .await
    {
        Ok(h) => h,
        Err(e) => {
            send_wire_message(
                stream,
                &mut transport,
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
        &mut transport,
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
