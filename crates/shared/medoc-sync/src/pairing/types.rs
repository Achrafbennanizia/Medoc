//! Pairing DTOs and shared constants.

use serde::{Deserialize, Serialize};

pub const ACTIVATION_TOKEN_PREFIX: &str = "mt2.";
pub const APP_KV_PAIRING_ENABLED: &str = "pairing.enabled.v1";
/// When set, this computer does not listen on the practice LAN address.
pub const APP_KV_NETWORK_HIDDEN: &str = "network.hidden.v1";
pub const DEFAULT_REPLICA_HTTP_PORT: u16 = 8787;

/// Canonical default actions granted to a freshly accepted replica.
pub const DEFAULT_ALLOWED_ACTIONS: &[&str] = &[
    "sync.push",
    "sync.pull",
    "sync.status",
    "sync.blob.get",
    "sync.blob.put",
    "sync.reconcile",
    "sync.number",
    "pairing.peers",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingRequest {
    pub id: String,
    pub device_id: String,
    pub slave_pubkey: String,
    pub slave_label: String,
    pub requester_ip: String,
    pub status: String,
    pub allowed_actions: Vec<String>,
    pub activation_token: Option<String>,
    pub requested_at: String,
    pub decided_at: Option<String>,
    pub decided_by: Option<String>,
    /// True when the master approved the request and waits for the 4-digit PIN on the replica.
    #[serde(default)]
    pub awaiting_pin: bool,
    /// How the request was initiated (`lan` | `bluetooth`).
    #[serde(default = "default_transport")]
    pub transport: String,
    /// Cluster Noise-XX join (same 4-digit code as Device cluster SAS).
    #[serde(default)]
    pub cluster_sas: bool,
    /// 4-digit coupling code while the request is pending (transcript SAS). Not stored after accept token mint.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub coupling_code: Option<String>,
}

fn default_transport() -> String {
    "lan".into()
}

impl PairingRequest {
    /// Drop the live activation token before a response that is not the PIN confirm.
    pub fn redact_public_token(mut self) -> Self {
        self.activation_token = None;
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingDecideResult {
    pub request: PairingRequest,
    /// Shown once on the accepting (master) device; replica must enter it to finish coupling.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub confirm_pin: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingRequestSubmit {
    pub device_id: String,
    pub slave_pubkey: String,
    pub slave_label: String,
    pub requester_ip: String,
    #[serde(default = "default_transport")]
    pub transport: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingDecision {
    pub accept: bool,
    pub allowed_actions: Vec<String>,
    pub decided_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivationTokenPayload {
    pub version: u32,
    pub device_id: String,
    pub slave_label: String,
    pub master_device_id: String,
    pub allowed_actions: Vec<String>,
    pub issued_at: String,
    pub nonce: String,
}
