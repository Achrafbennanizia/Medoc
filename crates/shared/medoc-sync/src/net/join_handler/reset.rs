//! Inbound cluster reset from the main device (split from `join_handler.rs`).

use super::*;

pub(super) async fn handle_inbound_cluster_reset(
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
