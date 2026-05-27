use serde::{Deserialize, Serialize};

/// How this installation connects to practice data.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeploymentMode {
    /// Tauri desktop with embedded SQLite (default). Optional embedded LAN server on same machine.
    PracticeDesktop,
    /// Thin client: HTTPS to a remote `medoc-server` on the LAN.
    LanClient,
    /// Local SQLite + direct peer sync to a master device (no `medoc-server` required).
    ServerlessPeer,
}

impl DeploymentMode {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "practice_desktop" => Some(Self::PracticeDesktop),
            "lan_client" => Some(Self::LanClient),
            "serverless_peer" => Some(Self::ServerlessPeer),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::PracticeDesktop => "practice_desktop",
            Self::LanClient => "lan_client",
            Self::ServerlessPeer => "serverless_peer",
        }
    }
}

/// Role in a serverless pair/group. Master holds authoritative conflict resolution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DeviceRole {
    Master,
    Replica,
}

impl DeviceRole {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "MASTER" => Some(Self::Master),
            "REPLICA" => Some(Self::Replica),
            _ => None,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Master => "MASTER",
            Self::Replica => "REPLICA",
        }
    }
}

/// Persisted in `app_kv` key `sync.deployment.v1`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncDeploymentConfig {
    pub schema_version: u32,
    pub mode: DeploymentMode,
    pub role: DeviceRole,
    /// When `mode = serverless_peer` and `role = REPLICA`: master peer HTTPS base (no trailing slash).
    pub master_base_url: String,
    /// Pin self-signed LAN cert of master (`sha256` hex, lowercase).
    pub master_cert_sha256: String,
    /// **Deprecated** (kept for backwards compat with v1 deployments that
    /// used the LAN login JWT). New deployments use `activation_token`.
    #[serde(default)]
    pub master_access_token: String,
    /// Optional human label for this device in sync status UI.
    pub device_label: String,
    /// Ed25519-signed pairing token issued by master (`mt2.<body>.<sig>`).
    /// Replicas send this in `Authorization: Bearer …` for sync calls.
    #[serde(default)]
    pub activation_token: String,
    /// Master's Ed25519 public key (base64-no-pad). Replicas use this to
    /// verify signed peer lists and to confirm the activation token was
    /// minted by the master they paired with.
    #[serde(default)]
    pub master_pubkey: String,
    /// Master device id (the master's `sync.device_id.v1`). Useful for
    /// pull's `sinceSeq` bookkeeping.
    #[serde(default)]
    pub master_device_id: String,
    /// Outstanding pairing request id (used while waiting for accept).
    #[serde(default)]
    pub pairing_request_id: String,
    /// Enable BEST-EFFORT mesh sync to other replicas (peer list signed by master).
    #[serde(default)]
    pub unstable_mesh: bool,
}

impl Default for SyncDeploymentConfig {
    fn default() -> Self {
        Self {
            schema_version: 1,
            mode: DeploymentMode::PracticeDesktop,
            role: DeviceRole::Master,
            master_base_url: String::new(),
            master_cert_sha256: String::new(),
            master_access_token: String::new(),
            device_label: String::new(),
            activation_token: String::new(),
            master_pubkey: String::new(),
            master_device_id: String::new(),
            pairing_request_id: String::new(),
            unstable_mesh: false,
        }
    }
}

pub const APP_KV_DEPLOYMENT_KEY: &str = "sync.deployment.v1";
pub const APP_KV_DEVICE_ID_KEY: &str = "sync.device_id.v1";
