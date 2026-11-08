//! Joiner-side TCP client: Noise XX + JOIN_REQUEST / JOIN_ACCEPT.

use medoc_core::discovery::primary_local_ipv4;
use medoc_core::error::AppError;
use tokio::net::TcpStream;

use crate::cluster::crypto::DeviceIdentity;
use crate::cluster::SeatRole;

use super::channel::{recv_wire_message, send_wire_message};
use super::handshake::run_xx_initiator;
use super::wire::{SeatRoleWire, WireMessage};

#[derive(Debug, Clone)]
pub struct JoinOutcome {
    pub session_id: String,
    pub fingerprint: String,
    pub handshake_transcript: Vec<u8>,
}

/// LAN credentials returned after SAS so the replica can call the master's HTTPS server.
#[derive(Debug, Clone, Default)]
pub struct SasConfirmOutcome {
    pub activation_token: Option<String>,
    pub master_pubkey: Option<String>,
    pub master_device_id: Option<String>,
    pub master_cert_sha256: Option<String>,
    /// Main device's LAN HTTPS port, when it sent one.
    pub master_http_port: Option<u16>,
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
    requested_role: SeatRole,
) -> Result<JoinOutcome, AppError> {
    let addr = format!("{host}:{port}");
    let mut stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| AppError::Internal(format!("cluster connect {addr}: {e}")))?;

    let (mut transport, transcript) = run_xx_initiator(&mut stream).await?;

    let ip = primary_local_ipv4().unwrap_or_else(|| host.to_string());
    let join_msg = WireMessage::JoinRequest {
        fingerprint: identity.fingerprint.clone(),
        pubkey: identity.pubkey_bytes.to_vec(),
        hostname: local_hostname(),
        os: std::env::consts::OS.into(),
        app_version: env!("CARGO_PKG_VERSION").into(),
        ip,
        requested_role: SeatRoleWire::from(requested_role),
    };
    send_wire_message(&mut stream, &mut transport, &join_msg).await?;

    match recv_wire_message(&mut stream, &mut transport).await? {
        WireMessage::JoinAccept { session_id, .. } => Ok(JoinOutcome {
            session_id,
            fingerprint: identity.fingerprint.clone(),
            handshake_transcript: transcript,
        }),
        WireMessage::Error { code, message } => Err(AppError::Validation(format!(
            "cluster join rejected ({code}): {message}"
        ))),
        other => Err(AppError::Internal(format!(
            "unexpected cluster response: {other:?}"
        ))),
    }
}

/// Fetch owner staff directory after cluster join (for local login on member devices).
pub async fn fetch_staff_directory(
    host: &str,
    port: u16,
    identity: &DeviceIdentity,
    session_id: &str,
) -> Result<String, AppError> {
    let addr = format!("{host}:{port}");
    let mut stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| AppError::Internal(format!("cluster connect {addr}: {e}")))?;

    let (mut transport, _transcript) = run_xx_initiator(&mut stream).await?;

    send_wire_message(
        &mut stream,
        &mut transport,
        &WireMessage::StaffDirectoryRequest {
            fingerprint: identity.fingerprint.clone(),
            session_id: session_id.trim().to_string(),
        },
    )
    .await?;

    match recv_wire_message(&mut stream, &mut transport).await? {
        WireMessage::StaffDirectoryResponse { directory_json } => Ok(directory_json),
        WireMessage::Error { code, message } => Err(AppError::Validation(format!(
            "staff directory rejected ({code}): {message}"
        ))),
        other => Err(AppError::Internal(format!(
            "unexpected staff directory response: {other:?}"
        ))),
    }
}

/// Confirm the 4-digit SAS against the hash stored at admin Accept (new Noise session is transport only).
pub async fn confirm_sas_on_admin(
    host: &str,
    port: u16,
    session_id: &str,
    digits: &str,
) -> Result<SasConfirmOutcome, AppError> {
    let addr = format!("{host}:{port}");
    let mut stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| AppError::Internal(format!("cluster SAS connect {addr}: {e}")))?;

    let (mut transport, _transcript) = run_xx_initiator(&mut stream).await?;

    send_wire_message(
        &mut stream,
        &mut transport,
        &WireMessage::SasConfirm {
            session_id: session_id.to_string(),
            digits: digits.to_string(),
        },
    )
    .await?;

    match recv_wire_message(&mut stream, &mut transport).await? {
        WireMessage::JoinAccept {
            activation_token,
            master_pubkey,
            master_device_id,
            master_cert_sha256,
            master_http_port,
            ..
        } => Ok(SasConfirmOutcome {
            activation_token: activation_token.filter(|s| !s.trim().is_empty()),
            master_pubkey: master_pubkey.filter(|s| !s.trim().is_empty()),
            master_device_id: master_device_id.filter(|s| !s.trim().is_empty()),
            master_cert_sha256: master_cert_sha256
                .map(|pin| crate::tls_pin::normalize_sha256_pin(&pin))
                .filter(|pin| crate::tls_pin::is_sha256_pin(pin)),
            master_http_port: master_http_port.filter(|p| *p != 0),
        }),
        WireMessage::Error { code, message } => Err(AppError::Validation(format!(
            "cluster SAS rejected ({code}): {message}"
        ))),
        other => Err(AppError::Internal(format!(
            "unexpected cluster SAS response: {other:?}"
        ))),
    }
}

/// Re-fetch LAN activation token + master device id after SAS (or if SAS
/// never stored them). Reuses the join session already on the master.
pub async fn fetch_replica_auth(
    host: &str,
    port: u16,
    identity: &DeviceIdentity,
    session_id: &str,
) -> Result<SasConfirmOutcome, AppError> {
    let addr = format!("{host}:{port}");
    let mut stream = TcpStream::connect(&addr)
        .await
        .map_err(|e| AppError::Internal(format!("cluster auth connect {addr}: {e}")))?;

    let (mut transport, _transcript) = run_xx_initiator(&mut stream).await?;

    send_wire_message(
        &mut stream,
        &mut transport,
        &WireMessage::ReplicaAuthRequest {
            fingerprint: identity.fingerprint.clone(),
            session_id: session_id.trim().to_string(),
        },
    )
    .await?;

    match recv_wire_message(&mut stream, &mut transport).await? {
        WireMessage::JoinAccept {
            activation_token,
            master_pubkey,
            master_device_id,
            master_cert_sha256,
            master_http_port,
            ..
        } => Ok(SasConfirmOutcome {
            activation_token: activation_token.filter(|s| !s.trim().is_empty()),
            master_pubkey: master_pubkey.filter(|s| !s.trim().is_empty()),
            master_device_id: master_device_id.filter(|s| !s.trim().is_empty()),
            master_cert_sha256: master_cert_sha256
                .map(|pin| crate::tls_pin::normalize_sha256_pin(&pin))
                .filter(|pin| crate::tls_pin::is_sha256_pin(pin)),
            master_http_port: master_http_port.filter(|p| *p != 0),
        }),
        WireMessage::Error { code, message } => Err(AppError::Validation(format!(
            "replica auth rejected ({code}): {message}"
        ))),
        other => Err(AppError::Internal(format!(
            "unexpected replica auth response: {other:?}"
        ))),
    }
}
