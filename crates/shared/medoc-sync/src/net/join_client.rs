//! Joiner-side TCP client: Noise XX + JOIN_REQUEST / JOIN_ACCEPT.

use medoc_core::discovery::primary_local_ipv4;
use medoc_core::error::AppError;
use tokio::net::TcpStream;

use crate::verbund::crypto::DeviceIdentity;
use crate::verbund::SeatRolle;

use super::channel::{recv_wire_message, send_wire_message};
use super::handshake::run_xx_initiator;
use super::wire::{SeatRolleWire, WireMessage};

#[derive(Debug, Clone)]
pub struct JoinOutcome {
    pub session_id: String,
    pub fingerprint: String,
    pub handshake_transcript: Vec<u8>,
}

fn local_hostname() -> String {
    hostname::get()
        .ok()
        .and_then(|h| h.into_string().ok())
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "medoc-device".into())
}

/// Connect to an admin endpoint, perform Noise XX, send JOIN_REQUEST, read JOIN_ACCEPT.
pub async fn join_admin_endpoint(
    host: &str,
    port: u16,
    identity: &DeviceIdentity,
    requested_role: SeatRolle,
) -> Result<JoinOutcome, AppError> {
    let addr = format!("{host}:{port}");
    let mut stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| AppError::Internal(format!("verbund connect {addr}: {e}")))?;

    let (mut transport, transcript) = run_xx_initiator(&mut stream).await?;

    let ip = primary_local_ipv4().unwrap_or_else(|| host.to_string());
    let join_msg = WireMessage::JoinRequest {
        fingerprint: identity.fingerprint.clone(),
        pubkey: identity.pubkey_bytes.to_vec(),
        hostname: local_hostname(),
        os: std::env::consts::OS.into(),
        app_version: env!("CARGO_PKG_VERSION").into(),
        ip,
        requested_role: SeatRolleWire::from(requested_role),
    };
    send_wire_message(&mut stream, &mut transport, &join_msg).await?;

    match recv_wire_message(&mut stream, &mut transport).await? {
        WireMessage::JoinAccept { session_id } => Ok(JoinOutcome {
            session_id,
            fingerprint: identity.fingerprint.clone(),
            handshake_transcript: transcript,
        }),
        WireMessage::Error { code, message } => Err(AppError::Validation(format!(
            "verbund join rejected ({code}): {message}"
        ))),
        other => Err(AppError::Internal(format!(
            "unexpected verbund response: {other:?}"
        ))),
    }
}
