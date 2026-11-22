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
            if v4.ip.is_loopback() || super::lan_iface::is_ignored_lan_iface(&iface.name) {
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

async fn send_probes(socket: &UdpSocket, targets: &[SocketAddr]) {
    for t in targets {
        let _ = socket.send_to(DISCOVER_PROBE, *t).await;
    }
}

/// Interval between probe bursts. Wi-Fi drops broadcast frames regularly; one probe was not enough.
const PROBE_INTERVAL: Duration = Duration::from_millis(500);

/// Broadcast discovery probes and collect JSON beacon replies for `listen_window`.
///
/// Probes are re-sent every [`PROBE_INTERVAL`] to every broadcast target (global + each LAN interface),
/// and a failed receive (e.g. ICMP "port unreachable" from a host without MeDoc) no longer ends the scan.
pub async fn scan_lan_hosts(
    discovery_port: u16,
    listen_window: Duration,
    label_filter: Option<&str>,
) -> std::io::Result<Vec<(SocketAddr, LanBeaconPayload)>> {
    scan_lan_hosts_on_ports(&[discovery_port], listen_window, label_filter).await
}

/// Same as [`scan_lan_hosts`] but probes several discovery ports at once (configured + defaults), so a host
/// that runs on a non-default port — or an older build on the legacy port — is still found.
pub async fn scan_lan_hosts_on_ports(
    discovery_ports: &[u16],
    listen_window: Duration,
    label_filter: Option<&str>,
) -> std::io::Result<Vec<(SocketAddr, LanBeaconPayload)>> {
    let socket = UdpSocket::bind("0.0.0.0:0").await?;
    socket.set_broadcast(true)?;

    let mut targets: Vec<SocketAddr> = Vec::new();
    for port in discovery_ports {
        for t in discovery_targets(*port) {
            if !targets.contains(&t) {
                targets.push(t);
            }
        }
    }
    send_probes(&socket, &targets).await;

    let start = tokio::time::Instant::now();
    let deadline = start + listen_window;
    let mut next_probe = start + PROBE_INTERVAL;
    let mut buf = [0u8; 4096];
    let mut out: Vec<(SocketAddr, LanBeaconPayload)> = Vec::new();
    let mut seen_ids: HashSet<String> = HashSet::new();

    loop {
        let now = tokio::time::Instant::now();
        if now >= deadline {
            break;
        }
        if now >= next_probe {
            send_probes(&socket, &targets).await;
            next_probe = now + PROBE_INTERVAL;
        }
        let wait = deadline.min(next_probe).saturating_duration_since(now);
        match tokio::time::timeout(wait, socket.recv_from(&mut buf)).await {
            Ok(Ok((n, peer))) => {
                let Some(payload) = parse_beacon_line(&buf[..n]) else {
                    continue;
                };
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
            // Transient per-packet errors (ICMP unreachable, interface flaps): keep listening.
            Ok(Err(_)) => tokio::time::sleep(Duration::from_millis(20)).await,
            Err(_) => {} // wait elapsed → loop re-probes or ends
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
