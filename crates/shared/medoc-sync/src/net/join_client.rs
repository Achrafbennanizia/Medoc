//! Joiner-side TCP client: Noise XX + JOIN_REQUEST / JOIN_ACCEPT.
//!
//! Every request carries an Ed25519 signature of the device key over the
//! Noise handshake transcript (see [`DeviceIdentity::sign_channel`]). It
//! proves possession of the key behind the fingerprint and binds the request
//! to this connection, so a LAN peer cannot impersonate a device by sending
//! its (public) fingerprint, and a relay/MITM is detected.

use std::future::Future;
use std::time::Duration;

use medoc_core::discovery::primary_local_ipv4;
use medoc_core::error::AppError;
use tokio::net::TcpStream;

use crate::cluster::crypto::{ChannelPurpose, DeviceIdentity};
use crate::cluster::SeatRole;

use super::channel::{recv_wire_message, send_wire_message};
use super::handshake::run_xx_initiator;
use super::transport::NoiseTransport;
use super::wire::{SeatRoleWire, WireMessage};

/// TCP connect timeout to the admin device.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
/// Upper bound for one complete request/response exchange.
const EXCHANGE_TIMEOUT: Duration = Duration::from_secs(60);

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

async fn with_timeout<T>(
    what: &str,
    fut: impl Future<Output = Result<T, AppError>>,
) -> Result<T, AppError> {
    tokio::time::timeout(EXCHANGE_TIMEOUT, fut)
        .await
        .map_err(|_| AppError::Internal(format!("cluster {what}: timed out")))?
}

/// Connect + Noise XX. Returns the stream, transport and handshake transcript.
async fn open_channel(
    host: &str,
    port: u16,
    what: &str,
) -> Result<(TcpStream, NoiseTransport, Vec<u8>), AppError> {
    let addr = format!("{host}:{port}");
    let mut stream = tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect(&addr))
        .await
        .map_err(|_| AppError::Internal(format!("cluster {what} connect {addr}: timed out")))?
        .map_err(|e| AppError::Internal(format!("cluster {what} connect {addr}: {e}")))?;
    let _ = stream.set_nodelay(true);
    let (transport, transcript) = run_xx_initiator(&mut stream).await?;
    Ok((stream, transport, transcript))
}

fn lan_outcome_from_accept(msg: WireMessage, what: &str) -> Result<SasConfirmOutcome, AppError> {
    match msg {
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
            "cluster {what} rejected ({code}): {message}"
        ))),
        other => Err(AppError::Internal(format!(
            "unexpected cluster {what} response: {}",
            message_kind(&other)
        ))),
    }
}

/// Message type only — never log payloads (tokens, staff directory).
fn message_kind(msg: &WireMessage) -> &'static str {
    match msg {
        WireMessage::Discover => "DISCOVER",
        WireMessage::JoinRequest { .. } => "JOIN_REQUEST",
        WireMessage::JoinAccept { .. } => "JOIN_ACCEPT",
        WireMessage::SasConfirm { .. } => "SAS_CONFIRM",
        WireMessage::Provision { .. } => "PROVISION",
        WireMessage::MemberHello { .. } => "MEMBER_HELLO",
        WireMessage::DataRequest { .. } => "DATA_REQUEST",
        WireMessage::DataPush { .. } => "DATA_PUSH",
        WireMessage::Revoke { .. } => "REVOKE",
        WireMessage::ClusterReset { .. } => "CLUSTER_RESET",
        WireMessage::StaffDirectoryRequest { .. } => "STAFF_DIRECTORY_REQUEST",
        WireMessage::StaffDirectoryResponse { .. } => "STAFF_DIRECTORY_RESPONSE",
        WireMessage::ReplicaAuthRequest { .. } => "REPLICA_AUTH_REQUEST",
        WireMessage::ClusterStatusRequest { .. } => "CLUSTER_STATUS_REQUEST",
        WireMessage::ClusterStatusResponse { .. } => "CLUSTER_STATUS_RESPONSE",
        WireMessage::Error { .. } => "ERROR",
    }
}

/// Connect to an admin endpoint, perform Noise XX, send JOIN_REQUEST, read JOIN_ACCEPT.
pub async fn join_admin_endpoint(
    host: &str,
    port: u16,
    identity: &DeviceIdentity,
    requested_role: SeatRole,
) -> Result<JoinOutcome, AppError> {
    with_timeout("join", async {
        let (mut stream, mut transport, transcript) = open_channel(host, port, "join").await?;

        let ip = primary_local_ipv4().unwrap_or_else(|| host.to_string());
        let join_msg = WireMessage::JoinRequest {
            fingerprint: identity.fingerprint.clone(),
            pubkey: identity.pubkey_bytes.to_vec(),
            hostname: local_hostname(),
            os: std::env::consts::OS.into(),
            app_version: env!("CARGO_PKG_VERSION").into(),
            ip,
            requested_role: SeatRoleWire::from(requested_role),
            signature: identity.sign_channel(ChannelPurpose::Join, &transcript),
        };
        send_wire_message(&mut stream, &mut transport, &join_msg).await?;

        match recv_wire_message(&mut stream, &mut transport).await? {
            WireMessage::JoinAccept { session_id, .. } if !session_id.trim().is_empty() => {
                Ok(JoinOutcome {
                    session_id,
                    fingerprint: identity.fingerprint.clone(),
                    handshake_transcript: transcript,
                })
            }
            WireMessage::Error { code, message } => Err(AppError::Validation(format!(
                "cluster join rejected ({code}): {message}"
            ))),
            other => Err(AppError::Internal(format!(
                "unexpected cluster response: {}",
                message_kind(&other)
            ))),
        }
    })
    .await
}

/// Fetch owner staff directory after cluster join (for local login on member devices).
pub async fn fetch_staff_directory(
    host: &str,
    port: u16,
    identity: &DeviceIdentity,
    session_id: &str,
) -> Result<String, AppError> {
    with_timeout("staff directory", async {
        let (mut stream, mut transport, transcript) =
            open_channel(host, port, "staff directory").await?;

        send_wire_message(
            &mut stream,
            &mut transport,
            &WireMessage::StaffDirectoryRequest {
                fingerprint: identity.fingerprint.clone(),
                session_id: session_id.trim().to_string(),
                pubkey: identity.pubkey_bytes.to_vec(),
                signature: identity.sign_channel(ChannelPurpose::StaffDirectory, &transcript),
            },
        )
        .await?;

        match recv_wire_message(&mut stream, &mut transport).await? {
            WireMessage::StaffDirectoryResponse { directory_json } => Ok(directory_json),
            WireMessage::Error { code, message } => Err(AppError::Validation(format!(
                "staff directory rejected ({code}): {message}"
            ))),
            other => Err(AppError::Internal(format!(
                "unexpected staff directory response: {}",
                message_kind(&other)
            ))),
        }
    })
    .await
}

/// Confirm the 4-digit SAS shown on the admin after it accepted the request.
/// The request is signed with this device's key, so only the device that
/// joined can redeem the SAS (the admin also checks it accepted the session).
///
/// `identity` is the key used for the join. Callers pass that key instead of
/// reading the keychain again: a second read can fail even when the key is
/// already loaded, which used to abort pairing with "no cluster identity".
pub async fn confirm_sas_on_admin(
    host: &str,
    port: u16,
    identity: &DeviceIdentity,
    session_id: &str,
    digits: &str,
) -> Result<SasConfirmOutcome, AppError> {
    with_timeout("SAS", async {
        let (mut stream, mut transport, transcript) = open_channel(host, port, "SAS").await?;

        send_wire_message(
            &mut stream,
            &mut transport,
            &WireMessage::SasConfirm {
                session_id: session_id.trim().to_string(),
                digits: digits.to_string(),
                pubkey: identity.pubkey_bytes.to_vec(),
                signature: identity.sign_channel(ChannelPurpose::SasConfirm, &transcript),
            },
        )
        .await?;

        let reply = recv_wire_message(&mut stream, &mut transport).await?;
        lan_outcome_from_accept(reply, "SAS")
    })
    .await
}

/// Re-fetch LAN activation token + master device id after SAS (or if SAS
/// never stored them). Reuses the join session already on the master.
pub async fn fetch_replica_auth(
    host: &str,
    port: u16,
    identity: &DeviceIdentity,
    fingerprint: &str,
    session_id: &str,
) -> Result<SasConfirmOutcome, AppError> {
    if identity.fingerprint != fingerprint.trim() {
        return Err(AppError::Validation(
            "replica auth: fingerprint is not this device's identity".into(),
        ));
    }
    with_timeout("replica auth", async {
        let (mut stream, mut transport, transcript) =
            open_channel(host, port, "replica auth").await?;

        send_wire_message(
            &mut stream,
            &mut transport,
            &WireMessage::ReplicaAuthRequest {
                fingerprint: identity.fingerprint.clone(),
                session_id: session_id.trim().to_string(),
                pubkey: identity.pubkey_bytes.to_vec(),
                signature: identity.sign_channel(ChannelPurpose::ReplicaAuth, &transcript),
            },
        )
        .await?;

        let reply = recv_wire_message(&mut stream, &mut transport).await?;
        lan_outcome_from_accept(reply, "replica auth")
    })
    .await
}
