//! Plain data of the practice-network protocol (`net`), compiled in every build so the cluster
//! services keep their types when `net` is off (`net_offline.rs`).

/// TCP port of the device-network listener.
pub const DEFAULT_CLUSTER_PORT: u16 = 49300;

/// A main device found on the LAN.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminEndpoint {
    pub host: String,
    pub port: u16,
    pub instance_name: String,
    #[serde(default)]
    pub cluster_id: Option<String>,
}

/// LAN credentials returned after SAS so the replica can call the master's HTTPS server.
#[derive(Debug, Clone, Default)]
pub struct SasConfirmOutcome {
    pub activation_token: Option<String>,
    pub master_pubkey: Option<String>,
    pub master_device_id: Option<String>,
    pub master_cert_sha256: Option<String>,
    /// Main device's LAN HTTPS port, when it sent one.
    pub master_http_port: Option<u16>,
}

/// A member device to tell about a cluster reset.
#[derive(Debug, Clone)]
pub struct MemberResetTarget {
    pub fingerprint: String,
    pub ip: String,
}

#[derive(Debug, Clone, Default)]
pub struct ResetBroadcastResult {
    pub notified: u32,
    pub unreachable: Vec<String>,
}
