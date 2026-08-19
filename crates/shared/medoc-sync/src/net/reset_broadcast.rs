//! Owner-side push of signed cluster reset to member devices (best effort).

use std::time::Duration;

use medoc_core::error::AppError;
use tokio::net::TcpStream;

use super::channel::{recv_wire_message, send_wire_message};
use super::handshake::run_xx_initiator;
use super::listener::DEFAULT_CLUSTER_PORT;
use super::wire::WireMessage;

#[derive(Debug, Clone)]
pub struct MemberResetTarget {
    pub fingerprint: String,
    pub ip: String,
}

#[derive(Debug, Clone, Default)]
pub struct ResetBroadcastResult {
    pub notified: u32,
    pub unreachable: Vec<String>,
}

/// Push `CLUSTER_RESET` to each member IP over Noise XX (3s timeout per device).
pub async fn broadcast_cluster_reset(
    targets: &[MemberResetTarget],
    token_json: &str,
    signature_b64: &str,
) -> ResetBroadcastResult {
    let mut result = ResetBroadcastResult::default();
    for target in targets {
        match push_reset_to_member(&target.ip, token_json, signature_b64).await {
            Ok(()) => {
                result.notified += 1;
                tracing::info!(
                    target: "medoc::cluster",
                    event = "CLUSTER_RESET_PUSH_OK",
                    fingerprint = %target.fingerprint,
                    ip = %target.ip,
                );
            }
            Err(e) => {
                tracing::warn!(
                    target: "medoc::cluster",
                    event = "CLUSTER_RESET_PUSH_FAIL",
                    fingerprint = %target.fingerprint,
                    ip = %target.ip,
                    error = %e,
                );
                result.unreachable.push(target.fingerprint.clone());
            }
        }
    }
    result
}

async fn push_reset_to_member(
    ip: &str,
    token_json: &str,
    signature_b64: &str,
) -> Result<(), AppError> {
    let addr = format!("{ip}:{DEFAULT_CLUSTER_PORT}");
    let connect = tokio::time::timeout(Duration::from_secs(3), TcpStream::connect(&addr)).await;
    let mut stream = connect
        .map_err(|_| AppError::Internal(format!("cluster reset connect timeout {addr}")))?
        .map_err(|e| AppError::Internal(format!("cluster reset connect {addr}: {e}")))?;

    let (mut transport, _transcript) = run_xx_initiator(&mut stream).await?;
    send_wire_message(
        &mut stream,
        &mut transport,
        &WireMessage::ClusterReset {
            token_json: token_json.to_string(),
            signature_b64: signature_b64.to_string(),
        },
    )
    .await?;

    // Optional ack — ignore unexpected responses.
    let _ = tokio::time::timeout(
        Duration::from_secs(2),
        recv_wire_message(&mut stream, &mut transport),
    )
    .await;

    Ok(())
}
