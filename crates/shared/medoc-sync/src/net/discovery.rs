//! L2/L4 mDNS discovery for `_medoc-cluster._tcp`.

use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use medoc_core::error::AppError;

use super::listener::DEFAULT_CLUSTER_PORT;

pub const SERVICE_TYPE: &str = "_medoc-cluster._tcp.local.";
pub const SERVICE_NAME: &str = "MeDoc Cluster";

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminEndpoint {
    pub host: String,
    pub port: u16,
    pub instance_name: String,
    #[serde(default)]
    pub cluster_id: Option<String>,
}

pub struct MdnsResponder {
    _daemon: ServiceDaemon,
}

impl MdnsResponder {
    pub fn advertise(host_ip: &str, port: u16, cluster_id: &str) -> Result<Self, AppError> {
        let daemon = ServiceDaemon::new().map_err(map_mdns)?;
        let props = HashMap::from([("cluster_id".into(), cluster_id.into())]);
        let slug = cluster_id
            .chars()
            .filter(|c| c.is_ascii_alphanumeric())
            .take(12)
            .collect::<String>();
        let slug = if slug.is_empty() {
            "cluster".into()
        } else {
            slug
        };
        let hostname = format!("medoc-{slug}.local.");
        let service = ServiceInfo::new(
            SERVICE_TYPE,
            SERVICE_NAME,
            &hostname,
            host_ip,
            port,
            Some(props),
        )
        .map_err(map_mdns)?;
        daemon.register(service).map_err(map_mdns)?;
        Ok(Self { _daemon: daemon })
    }
}

pub fn scan_admins(timeout: Duration) -> Result<Vec<AdminEndpoint>, AppError> {
    let mut list = scan_mdns_admins(timeout)?;
    list.retain(|a| !a.host.trim().is_empty() && a.port != 0);
    for extra in probe_local_cluster_endpoints() {
        if !list
            .iter()
            .any(|a| a.host == extra.host && a.port == extra.port)
        {
            list.push(extra);
        }
    }
    Ok(list)
}

fn scan_mdns_admins(timeout: Duration) -> Result<Vec<AdminEndpoint>, AppError> {
    let daemon = ServiceDaemon::new().map_err(map_mdns)?;
    let receiver = daemon.browse(SERVICE_TYPE).map_err(map_mdns)?;
    let found: Arc<Mutex<Vec<AdminEndpoint>>> = Arc::new(Mutex::new(Vec::new()));
    let found2 = Arc::clone(&found);
    std::thread::spawn(move || {
        while let Ok(event) = receiver.recv() {
            if let ServiceEvent::ServiceResolved(info) = event {
                let host = pick_mdns_reachable_host(info.get_addresses().iter().copied());
                let port = info.get_port();
                let cluster_id = info
                    .get_properties()
                    .get("cluster_id")
                    .map(|version| version.val_str().to_string());
                if let Ok(mut list) = found2.lock() {
                    list.push(AdminEndpoint {
                        host,
                        port,
                        instance_name: info.get_fullname().to_string(),
                        cluster_id,
                    });
                }
            }
        }
    });
    std::thread::sleep(timeout);
    let list = found
        .lock()
        .map_err(|_| AppError::Internal("mdns lock".into()))?;
    Ok(list.clone())
}

/// Same-machine master (second MeDoc window) is often missed by mDNS. Probe TCP.
fn probe_local_cluster_endpoints() -> Vec<AdminEndpoint> {
    let mut hosts = vec!["127.0.0.1".to_string()];
    if let Some(ip) = medoc_core::discovery::pick_private_lan_ipv4() {
        let s = ip.to_string();
        if s != "127.0.0.1" {
            hosts.push(s);
        }
    }
    hosts
        .into_iter()
        .filter_map(|host| probe_cluster_tcp(&host, DEFAULT_CLUSTER_PORT))
        .collect()
}

fn probe_cluster_tcp(host: &str, port: u16) -> Option<AdminEndpoint> {
    let ip: IpAddr = host.parse().ok()?;
    let addr = SocketAddr::new(ip, port);
    std::net::TcpStream::connect_timeout(&addr, Duration::from_millis(400)).ok()?;
    Some(AdminEndpoint {
        host: host.to_string(),
        port,
        instance_name: format!("{SERVICE_NAME} ({host})"),
        cluster_id: None,
    })
}

fn pick_mdns_reachable_host(addrs: impl Iterator<Item = IpAddr>) -> String {
    let mut v4: Vec<Ipv4Addr> = Vec::new();
    let mut loopback: Vec<Ipv4Addr> = Vec::new();
    let mut v6_addrs: Vec<IpAddr> = Vec::new();
    for a in addrs {
        match a {
            IpAddr::V4(v) if v.is_loopback() => loopback.push(v),
            IpAddr::V4(v) if medoc_core::discovery::lan_ipv4_addr_score(v) >= 0 => v4.push(v),
            IpAddr::V6(ip6) if crate::net::is_private_lan_address(IpAddr::V6(ip6)) => {
                v6_addrs.push(a);
            }
            _ => {}
        }
    }
    v4.sort_by_key(|ip| std::cmp::Reverse(medoc_core::discovery::lan_ipv4_addr_score(*ip)));
    if let Some(ip) = v4.first() {
        return ip.to_string();
    }
    if let Some(ip) = loopback.first() {
        return ip.to_string();
    }
    v6_addrs.first().map(|a| a.to_string()).unwrap_or_default()
}

fn map_mdns(e: impl std::fmt::Display) -> AppError {
    AppError::Internal(format!("mdns: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mdns_prefers_rfc1918_v4_over_link_local_v6() {
        let host = pick_mdns_reachable_host(
            [
                "fe80::1".parse().unwrap(),
                "192.168.1.40".parse().unwrap(),
                "172.17.0.2".parse().unwrap(),
            ]
            .into_iter(),
        );
        assert_eq!(host, "192.168.1.40");
    }

    #[test]
    fn mdns_falls_back_to_loopback_when_no_lan_v4() {
        let host = pick_mdns_reachable_host(["127.0.0.1".parse().unwrap()].into_iter());
        assert_eq!(host, "127.0.0.1");
    }
}
