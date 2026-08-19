//! UDP LAN discovery — broadcast probe and responder for master beacons.

use std::collections::HashSet;
use std::net::{Ipv4Addr, SocketAddr};
use std::time::Duration;

use if_addrs::IfAddr;
use tokio::net::UdpSocket;

use super::beacon::{parse_beacon_line, LanBeaconPayload, DISCOVER_PROBE, SCHEMA};

fn ipv4_broadcast(addr: Ipv4Addr, netmask: Ipv4Addr) -> Option<Ipv4Addr> {
    let mut octets = [0u8; 4];
    for (i, o) in octets.iter_mut().enumerate() {
        *o = addr.octets()[i] | (!netmask.octets()[i]);
    }
    Some(Ipv4Addr::from(octets))
}

fn discovery_targets(discovery_port: u16) -> Vec<SocketAddr> {
    let mut version = vec![SocketAddr::from((Ipv4Addr::BROADCAST, discovery_port))];
    for iface in if_addrs::get_if_addrs().unwrap_or_default() {
        if let IfAddr::V4(v4) = iface.addr {
            if v4.ip.is_loopback() {
                continue;
            }
            if let Some(bc) = v4.broadcast {
                version.push(SocketAddr::from((bc, discovery_port)));
            } else if let Some(bc) = ipv4_broadcast(v4.ip, v4.netmask) {
                version.push(SocketAddr::from((bc, discovery_port)));
            }
        }
    }
    version.sort_by_key(|s| s.to_string());
    version.dedup();
    version
}

/// Broadcast discovery probe and collect JSON beacon replies for `listen_window`.
pub async fn scan_lan_hosts(
    discovery_port: u16,
    listen_window: Duration,
    label_filter: Option<&str>,
) -> std::io::Result<Vec<(SocketAddr, LanBeaconPayload)>> {
    let socket = UdpSocket::bind("0.0.0.0:0").await?;
    socket.set_broadcast(true)?;

    let targets = discovery_targets(discovery_port);
    for t in &targets {
        let _ = socket.send_to(DISCOVER_PROBE, *t).await;
    }

    let deadline = tokio::time::Instant::now() + listen_window;
    let mut buf = [0u8; 4096];
    let mut out: Vec<(SocketAddr, LanBeaconPayload)> = Vec::new();
    let mut seen_ids: HashSet<String> = HashSet::new();

    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            break;
        }
        match tokio::time::timeout(remaining, socket.recv_from(&mut buf)).await {
            Ok(Ok((n, peer))) => {
                if let Some(payload) = parse_beacon_line(&buf[..n]) {
                    if payload.schema != SCHEMA {
                        continue;
                    }
                    if let Some(f) = label_filter {
                        if !payload.label.to_lowercase().contains(&f.to_lowercase()) {
                            continue;
                        }
                    }
                    if seen_ids.insert(payload.instance_id.clone()) {
                        out.push((peer, payload));
                    }
                }
            }
            Ok(Err(_)) => break,
            Err(_) => break,
        }
    }

    Ok(out)
}

/// Respond to discovery probes on `discovery_port` until `shutdown` becomes true.
pub async fn run_discovery_responder(
    discovery_port: u16,
    beacon_json: Vec<u8>,
    shutdown: std::sync::Arc<std::sync::atomic::AtomicBool>,
) -> std::io::Result<()> {
    let socket = UdpSocket::bind(("0.0.0.0", discovery_port)).await?;
    socket.set_broadcast(true)?;
    let mut buf = [0u8; 512];
    while !shutdown.load(std::sync::atomic::Ordering::SeqCst) {
        match tokio::time::timeout(Duration::from_millis(400), socket.recv_from(&mut buf)).await {
            Ok(Ok((n, peer))) => {
                if n == DISCOVER_PROBE.len() && &buf[..n] == DISCOVER_PROBE {
                    let _ = socket.send_to(&beacon_json, peer).await;
                }
            }
            Ok(Err(e)) => return Err(e),
            Err(_) => {}
        }
    }
    Ok(())
}
