//! L2/L4 mDNS discovery for `_medoc-cluster._tcp`.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use medoc_core::error::AppError;

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
    let daemon = ServiceDaemon::new().map_err(map_mdns)?;
    let receiver = daemon.browse(SERVICE_TYPE).map_err(map_mdns)?;
    let found: Arc<Mutex<Vec<AdminEndpoint>>> = Arc::new(Mutex::new(Vec::new()));
    let found2 = Arc::clone(&found);
    std::thread::spawn(move || {
        while let Ok(event) = receiver.recv() {
            if let ServiceEvent::ServiceResolved(info) = event {
                let host = info
                    .get_addresses()
                    .iter()
                    .next()
                    .map(|a| a.to_string())
                    .unwrap_or_default();
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

fn map_mdns(e: impl std::fmt::Display) -> AppError {
    AppError::Internal(format!("mdns: {e}"))
}
