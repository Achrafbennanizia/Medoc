//! Persisted LAN server settings (`app_kv` key `lan.server.config.v1`).

use serde::{Deserialize, Serialize};

pub const APP_KV_KEY: &str = "lan.server.config.v1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LanServerConfigV1 {
    pub schema_version: u32,
    /// TCP bind address, e.g. `0.0.0.0` for all interfaces or `127.0.0.1` for loopback only.
    pub bind_addr: String,
    pub http_port: u16,
    pub udp_discovery_port: u16,
    /// Shown to clients during discovery (e.g. „Praxis Dr. Muster“).
    pub instance_label: String,
    /// Start the LAN listener automatically when the desktop app launches (after DB init).
    pub auto_start_with_app: bool,
    /// Extra browser origins allowed for CORS (full URL, e.g. `http://192.168.1.20:1420`).
    #[serde(default)]
    pub extra_cors_origins: Vec<String>,
}

impl Default for LanServerConfigV1 {
    fn default() -> Self {
        Self {
            schema_version: 1,
            bind_addr: "0.0.0.0".into(),
            http_port: 8787,
            udp_discovery_port: 47_830,
            instance_label: "MeDoc Praxis".into(),
            auto_start_with_app: false,
            extra_cors_origins: vec![],
        }
    }
}
