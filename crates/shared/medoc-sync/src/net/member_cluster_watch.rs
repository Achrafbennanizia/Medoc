//! Member device: poll admin for cluster reset and apply queued resets.

use std::path::Path;
use std::time::Duration;

use medoc_core::error::AppError;
use sqlx::SqlitePool;
use tokio::net::TcpStream;

use crate::cluster::crypto::DeviceIdentity;
use crate::cluster::services::cluster_reset_service::{
    apply_queued_remote_reset_if_any, load_pending_reset, queue_verified_remote_reset,
};
use crate::cluster::services::license_service::cluster_status;

use super::channel::{recv_wire_message, send_wire_message};
use super::discovery::{scan_admins, AdminEndpoint};
use super::handshake::run_xx_initiator;
use super::listener::DEFAULT_CLUSTER_PORT;
use super::wire::WireMessage;

const POLL_INTERVAL: Duration = Duration::from_secs(30);

/// Spawn a background task that polls the admin for cluster reset and applies queued resets.
pub fn spawn_member_cluster_watch(
    pool: SqlitePool,
    app_data_dir: std::path::PathBuf,
    emit_reset: impl Fn() + Send + Sync + 'static,
) {
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(POLL_INTERVAL).await;
            if let Err(e) = member_watch_tick(&pool, &app_data_dir, &emit_reset).await {
                tracing::debug!(
                    target: "medoc::cluster",
                    event = "MEMBER_CLUSTER_WATCH_TICK_ERR",
                    error = %e
                );
            }
        }
    });
}

async fn member_watch_tick(
    pool: &SqlitePool,
    app_data_dir: &Path,
    emit_reset: &impl Fn(),
) -> Result<(), AppError> {
    let status = cluster_status(pool).await?;
    if !status.provisioned || status.is_owner {
        return Ok(());
    }

    if apply_queued_remote_reset_if_any(pool, app_data_dir)
        .await?
        .is_some()
    {
        emit_reset();
        return Ok(());
    }

    if load_pending_reset(pool).await?.is_some() {
        return Ok(());
    }

    let cluster_id = status.cluster_id.unwrap_or_default();
    if cluster_id.is_empty() {
        return Ok(());
    }

    let admins = scan_admins(Duration::from_secs(2))?;
    let admin = admins
        .into_iter()
        .find(|a| a.cluster_id.as_deref() == Some(cluster_id.as_str()));
    let Some(admin) = admin else {
        return Ok(());
    };

    if let Ok((token_json, signature_b64)) = poll_admin_for_reset(&admin, &cluster_id).await {
        queue_verified_remote_reset(pool, &token_json, &signature_b64).await?;
        if apply_queued_remote_reset_if_any(pool, app_data_dir)
            .await?
            .is_some()
        {
            emit_reset();
        }
    }

    Ok(())
}

async fn poll_admin_for_reset(
    admin: &AdminEndpoint,
    cluster_id: &str,
) -> Result<(String, String), AppError> {
    let identity = DeviceIdentity::load_or_create()?;
    let addr = format!("{}:{DEFAULT_CLUSTER_PORT}", admin.host);
    let mut stream = tokio::time::timeout(Duration::from_secs(5), TcpStream::connect(&addr))
        .await
        .map_err(|_| AppError::Internal(format!("cluster status connect timeout {addr}")))?
        .map_err(|e| AppError::Internal(format!("cluster status connect {addr}: {e}")))?;

    let (mut transport, _transcript) = run_xx_initiator(&mut stream).await?;
    send_wire_message(
        &mut stream,
        &mut transport,
        &WireMessage::ClusterStatusRequest {
            fingerprint: identity.fingerprint.clone(),
            cluster_id: cluster_id.to_string(),
        },
    )
    .await?;

    match recv_wire_message(&mut stream, &mut transport).await? {
        WireMessage::ClusterStatusResponse {
            reset_pending: true,
            token_json: Some(token_json),
            signature_b64: Some(signature_b64),
        } => Ok((token_json, signature_b64)),
        _ => Err(AppError::Validation("Kein Reset outstanding".into())),
    }
}
