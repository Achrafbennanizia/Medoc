//! IPC DTOs for pairing commands (camelCase for the frontend).

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingDecidePayload {
    pub request_id: String,
    pub accept: bool,
    #[serde(default)]
    pub allowed_actions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingMasterInfo {
    pub master_device_id: String,
    pub master_pubkey: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingScanPayload {
    #[serde(default = "default_scan_seconds")]
    pub seconds: u64,
}

fn default_scan_seconds() -> u64 {
    2
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredMaster {
    pub host: String,
    pub http_port: u16,
    pub label: String,
    pub instance_id: String,
    pub tls: bool,
    pub cert_sha256: String,
    pub base_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingSubmitPayload {
    pub master_base_url: String,
    #[serde(default)]
    pub master_cert_sha256: String,
    pub slave_label: String,
    #[serde(default = "default_pairing_transport")]
    pub transport: String,
}

fn default_pairing_transport() -> String {
    "lan".into()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingSubmitResult {
    pub request_id: String,
    pub device_id: String,
    pub slave_pubkey: String,
    pub master_pubkey: String,
    pub master_device_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingCheckStatusPayload {
    pub request_id: String,
    pub master_base_url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingConfirmPinPayload {
    pub request_id: String,
    pub master_base_url: String,
    pub pin: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingPersistTokenPayload {
    pub activation_token: String,
}
