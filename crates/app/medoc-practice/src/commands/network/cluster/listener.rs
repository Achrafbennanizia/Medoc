//! Cluster listener auto-start and the background listener task.

use super::*;

/// Spawn TCP+mDNS receive port with the desktop app (pairing / mesh).
pub async fn auto_start_cluster_if_ready(pool: &SqlitePool, listener: &ClusterListenerControl) {
    if medoc_sync::pairing::is_network_hidden(pool)
        .await
        .unwrap_or(false)
    {
        tracing::info!(
            target: "medoc::cluster",
            event = "CLUSTER_LISTENER_SKIP_HIDDEN"
        );
        return;
    }
    if crate::commands::network::lan::lan_server_listen_disabled() {
        tracing::info!(
            target: "medoc::cluster",
            event = "CLUSTER_LISTENER_SKIP_INSTANCE"
        );
        return;
    }
    if let Ok(snap) = medoc_sync::engine::SyncEngine::status(pool).await {
        if snap.deployment.role == medoc_sync::deployment::DeviceRole::Replica {
            tracing::info!(
                target: "medoc::cluster",
                event = "CLUSTER_LISTENER_SKIP_REPLICA"
            );
            return;
        }
    }
    if let Err(e) = start_cluster_listener_task(pool.clone(), listener).await {
        tracing::warn!(
            target: "medoc::cluster",
            event = "CLUSTER_LISTENER_AUTO_SKIP",
            error = %e
        );
    }
}

pub(super) async fn start_cluster_listener_task(
    pool: SqlitePool,
    listener: &ClusterListenerControl,
) -> Result<(), AppError> {
    if listener.is_running().await {
        return Ok(());
    }
    let _ = listener.cancel_existing.send(false);
    listener.stop().await;
    let (addr, iface_name) = match medoc_core::discovery::pick_private_lan_ipv4_bind() {
        Some(bind) => (IpAddr::V4(bind.ip), bind.iface_name),
        None => {
            tracing::info!(
                target: "medoc::cluster",
                event = "CLUSTER_LISTENER_LOOPBACK_FALLBACK"
            );
            (IpAddr::V4(Ipv4Addr::LOCALHOST), "lo".into())
        }
    };
    let bound = match bind_cluster_listener(addr, DEFAULT_CLUSTER_PORT).await {
        Ok(l) => l,
        Err(e) if matches!(e, AppError::Conflict(_)) => {
            tracing::info!(
                target: "medoc::cluster",
                event = "CLUSTER_LISTENER_ALREADY_BOUND",
                error = %e
            );
            return Ok(());
        }
        Err(e) => return Err(e),
    };
    let cancel = listener.cancel_existing.subscribe();
    let cluster_id = cluster_status(&pool)
        .await?
        .cluster_id
        .unwrap_or_else(|| "cluster".into());
    let host = addr.to_string();
    let listener_task = tokio::spawn(async move {
        let cancel = cancel;
        let _mdns = match MdnsResponder::advertise(&host, DEFAULT_CLUSTER_PORT, &cluster_id) {
            Ok(r) => Some(r),
            Err(e) => {
                tracing::warn!(
                    target: "medoc::cluster",
                    event = "CLUSTER_MDNS_SKIP",
                    error = %e
                );
                None
            }
        };
        tracing::info!(
            target: "medoc::cluster",
            event = "CLUSTER_LISTENER_START",
            iface = %iface_name,
            bind_ip = %addr,
            port = DEFAULT_CLUSTER_PORT
        );
        loop {
            match bound.accept().await {
                Ok((stream, peer)) => {
                    tracing::debug!(
                        target: "medoc::cluster",
                        event = "CLUSTER_INBOUND",
                        peer = %peer
                    );
                    let pool = pool.clone();
                    spawn_cluster_connection_handler_until(stream, pool, cancel.clone());
                }
                Err(e) => {
                    tracing::warn!(
                        target: "medoc::cluster",
                        event = "CLUSTER_ACCEPT_ERR",
                        error = %e
                    );
                    break;
                }
            }
        }
        drop(_mdns);
    });
    *listener.inner.lock().await = Some(listener_task);
    Ok(())
}
