//! Shared MeDoc master beacon payload — used by UDP LAN and BLE discovery.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Probe payload clients broadcast on the LAN (newline-terminated for easy CLI debugging).
pub const DISCOVER_PROBE: &[u8] = b"MEDOC_DISCOVER_V1\n";

pub const SCHEMA: &str = "medoc-lan-v1";

/// BLE GAP local-name prefix for embedded beacon JSON (`MeDoc|{json}`).
pub const BLE_LOCAL_NAME_PREFIX: &str = "MeDoc|";

/// MeDoc pairing BLE service UUID (`4d65` = "Me" ASCII).
pub const MEDOC_BLE_SERVICE_UUID: Uuid = Uuid::from_u128(0x00004d65_0001_0000_8000_00805f9b34fb);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LanBeaconPayload {
    pub schema: String,
    pub version: String,
    pub http_port: u16,
    pub instance_id: String,
    pub label: String,
    /// When true, clients must use `https://` on `http_port` (name kept for schema compat).
    #[serde(default = "default_tls_enabled")]
    pub tls: bool,
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub cert_sha256: String,
    /// LAN IPv4 clients should use for HTTPS (filled by master beacon; empty on legacy rows).
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub advertised_host: String,
}

fn default_tls_enabled() -> bool {
    true
}

impl LanBeaconPayload {
    pub fn to_json_line(&self) -> Vec<u8> {
        let mut s = serde_json::to_vec(self).unwrap_or_else(|_| b"{}".to_vec());
        s.push(b'\n');
        s
    }
}

pub fn parse_beacon_line(bytes: &[u8]) -> Option<LanBeaconPayload> {
    let line = std::str::from_utf8(bytes.trim_ascii_end()).ok()?;
    serde_json::from_str(line).ok()
}

pub fn parse_beacon_from_ble_local_name(name: &str) -> Option<LanBeaconPayload> {
    let rest = name.strip_prefix(BLE_LOCAL_NAME_PREFIX)?;
    parse_beacon_line(rest.as_bytes())
}

/// Resolve the host IP/hostname to use when building HTTPS URLs from a beacon.
pub fn beacon_host(payload: &LanBeaconPayload, fallback_host: &str) -> String {
    if payload.advertised_host.is_empty() {
        fallback_host.to_string()
    } else {
        payload.advertised_host.clone()
    }
}

/// Build `{https|http}://{host}:{port}` from beacon fields.
pub fn beacon_base_url(payload: &LanBeaconPayload, host: &str) -> String {
    let scheme = if payload.tls { "https" } else { "http" };
    format!("{scheme}://{host}:{}", payload.http_port)
}

/// First non-loopback IPv4 on this machine (for master beacons).
pub fn primary_local_ipv4() -> Option<String> {
    for iface in if_addrs::get_if_addrs().unwrap_or_default() {
        if let if_addrs::IfAddr::V4(v4) = iface.addr {
            if !v4.ip.is_loopback() {
                return Some(v4.ip.to_string());
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_sample_beacon() {
        let p = LanBeaconPayload {
            schema: SCHEMA.into(),
            version: "0.1.0".into(),
            http_port: 8787,
            instance_id: "abc".into(),
            label: "Test".into(),
            tls: true,
            cert_sha256: "deadbeef".into(),
            advertised_host: String::new(),
        };
        let line = p.to_json_line();
        let parsed = parse_beacon_line(&line).unwrap();
        assert_eq!(parsed.http_port, 8787);
        assert_eq!(parsed.schema, SCHEMA);
    }

    #[test]
    fn beacon_base_url_uses_tls_scheme() {
        let p = LanBeaconPayload {
            schema: SCHEMA.into(),
            version: "0.1.0".into(),
            http_port: 8787,
            instance_id: "x".into(),
            label: "T".into(),
            tls: true,
            cert_sha256: String::new(),
            advertised_host: "192.168.1.5".into(),
        };
        assert_eq!(
            beacon_base_url(&p, "192.168.1.5"),
            "https://192.168.1.5:8787"
        );
    }
}
