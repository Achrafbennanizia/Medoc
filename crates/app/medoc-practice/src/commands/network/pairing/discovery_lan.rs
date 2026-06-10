//! LAN UDP discovery for pairing (replica scans for masters).

use std::time::Duration;

use medoc_core::discovery::{beacon_base_url, beacon_host, LanBeaconPayload};
use medoc_core::error::AppError;

use super::types::{DiscoveredMaster, PairingScanPayload};
use crate::error::AppError as TauriAppError;

use super::support::into_tauri;

#[tauri::command]
#[tracing::instrument(level = "info")]
pub async fn pairing_scan_lan(
    payload: PairingScanPayload,
) -> Result<Vec<DiscoveredMaster>, TauriAppError> {
    let port = std::env::var("MEDOC_DISCOVERY_PORT")
        .ok()
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(8788);
    let window = Duration::from_millis((payload.seconds * 1000).max(500));
    let probed = medoc_core::discovery::scan_lan_hosts(port, window, None)
        .await
        .map_err(|e| into_tauri(AppError::Internal(format!("LAN discovery: {e}"))))?;
    Ok(probed
        .into_iter()
        .map(|(addr, beacon)| {
            let peer_ip = addr.ip().to_string();
            let host = beacon_host(&beacon, &peer_ip);
            discovered_from_beacon(&beacon, host, "")
        })
        .collect())
}

pub(crate) fn discovered_from_beacon(
    beacon: &LanBeaconPayload,
    host: String,
    instance_prefix: &str,
) -> DiscoveredMaster {
    DiscoveredMaster {
        base_url: beacon_base_url(beacon, &host),
        host,
        http_port: beacon.http_port,
        label: beacon.label.clone(),
        instance_id: format!("{instance_prefix}{}", beacon.instance_id),
        tls: beacon.tls,
        cert_sha256: beacon.cert_sha256.clone(),
    }
}
