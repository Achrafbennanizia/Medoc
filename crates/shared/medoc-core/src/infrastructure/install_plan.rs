//! USB multi-installer blueprint carried inside vendor licenses or sidecar files.
//!
//! Schema version 1 — see `docs/architecture/usb-multi-installer.md`.

use serde::{Deserialize, Serialize};

pub const INSTALL_PLAN_SCHEMA_VERSION: u32 = 1;

/// Bit flags in [`InstallPlan::flags`]. Human-readable fields remain authoritative.
pub const FLAG_AUTO_ACTIVATE: u32 = 1 << 0;
pub const FLAG_CHAIN_MEMBER: u32 = 1 << 1;
pub const FLAG_OPEN_PORTS_WINDOW: u32 = 1 << 2;
pub const FLAG_SCAN_LAN: u32 = 1 << 3;
pub const FLAG_INSTALL_SERVER: u32 = 1 << 4;
pub const FLAG_LAN_CLIENT_ONLY: u32 = 1 << 5;

pub const PENDING_PLAN_SIDEcar_FILE: &str = "install_plan.pending.json";
pub const APP_KV_INSTALL_PLAN_PENDING: &str = "install_plan.pending.v1";
pub const APP_KV_INSTALL_PLAN_PROVISIONING: &str = "install_plan.provisioning.v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum InstallRole {
    Master,
    Replica,
    ServerHost,
    LanClient,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallComponent {
    PracticeApp,
    LanServer,
    WebClient,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InstallTopology {
    Colocated,
    SplitHost,
    ServerlessPeer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DiscoverMode {
    Scan,
    Fixed,
    MasterCode,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlanActivationMode {
    Auto,
    Manual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UsbInstallMode {
    Default,
    Chain,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DiscoverConfig {
    pub mode: DiscoverMode,
    #[serde(default)]
    pub address: String,
    #[serde(default)]
    pub port: u16,
    #[serde(default)]
    pub window_minutes: u32,
}

impl Default for DiscoverConfig {
    fn default() -> Self {
        Self {
            mode: DiscoverMode::Scan,
            address: String::new(),
            port: 8787,
            window_minutes: 30,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstallPlan {
    pub schema_version: u32,
    pub role: InstallRole,
    #[serde(default)]
    pub components: Vec<InstallComponent>,
    pub topology: InstallTopology,
    #[serde(default = "default_locale")]
    pub locale: String,
    #[serde(default)]
    pub flags: u32,
    #[serde(default)]
    pub discover: DiscoverConfig,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pairing_code: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub master_activation_ref: Option<String>,
    pub activation_mode: PlanActivationMode,
    #[serde(default)]
    pub device_label: String,
    #[serde(default)]
    pub preset_features: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub license_envelope: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chain_slot_index: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chain_total: Option<u32>,
}

fn default_locale() -> String {
    "en".into()
}

impl InstallPlan {
    pub fn new_master(device_label: impl Into<String>) -> Self {
        Self {
            schema_version: INSTALL_PLAN_SCHEMA_VERSION,
            role: InstallRole::Master,
            components: vec![InstallComponent::PracticeApp],
            topology: InstallTopology::ServerlessPeer,
            locale: default_locale(),
            flags: FLAG_AUTO_ACTIVATE | FLAG_OPEN_PORTS_WINDOW,
            discover: DiscoverConfig {
                mode: DiscoverMode::Scan,
                port: 8787,
                window_minutes: 30,
                ..Default::default()
            },
            pairing_code: None,
            master_activation_ref: None,
            activation_mode: PlanActivationMode::Auto,
            device_label: device_label.into(),
            preset_features: vec![],
            license_envelope: None,
            chain_slot_index: None,
            chain_total: None,
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != INSTALL_PLAN_SCHEMA_VERSION {
            return Err(format!(
                "unsupported install_plan schema_version {}",
                self.schema_version
            ));
        }
        if self.components.is_empty() {
            return Err("install_plan.components must not be empty".into());
        }
        if !["en", "de", "fr"].contains(&self.locale.as_str()) {
            return Err(format!("unsupported locale {}", self.locale));
        }
        Ok(())
    }

    pub fn has_flag(&self, flag: u32) -> bool {
        self.flags & flag != 0
    }

    pub fn plan_hash(&self) -> String {
        use sha2::{Digest, Sha256};
        let json = serde_json::to_string(self).unwrap_or_default();
        let digest = Sha256::digest(json.as_bytes());
        digest.iter().map(|b| format!("{b:02x}")).collect()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PendingInstallPlanSidecar {
    pub plan: InstallPlan,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub written_by_usb_setup: Option<String>,
    #[serde(default)]
    pub written_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProvisioningWindowState {
    pub expires_at: String,
    pub pairing_code: Option<String>,
    pub discover: DiscoverConfig,
    pub open_ports: bool,
    pub scan_lan: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SlotStatus {
    Pending,
    Done,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceSlot {
    pub slot_index: u32,
    pub plan: InstallPlan,
    pub status: SlotStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UsbCampaignVault {
    pub schema_version: u32,
    pub campaign_id: String,
    pub install_mode: UsbInstallMode,
    pub chain_total: u32,
    pub chain_next_index: u32,
    pub slots: Vec<DeviceSlot>,
    pub created_at: String,
    /// Optional USB volume serial binding (phase 5 hardening).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bound_volume_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UsbInstallAuditEntry {
    pub id: String,
    pub timestamp: String,
    pub install_mode: UsbInstallMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub slot_index: Option<u32>,
    pub host_fingerprint: String,
    pub hostname: String,
    pub role: InstallRole,
    pub components: Vec<InstallComponent>,
    pub plan_hash: String,
    pub success: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn install_plan_roundtrip_json() {
        let plan = InstallPlan::new_master("Front Desk");
        let json = serde_json::to_string(&plan).unwrap();
        let back: InstallPlan = serde_json::from_str(&json).unwrap();
        assert_eq!(plan, back);
        assert!(plan.validate().is_ok());
    }

    #[test]
    fn flags_and_hash_stable_for_same_content() {
        let mut plan = InstallPlan::new_master("A");
        plan.flags = FLAG_AUTO_ACTIVATE | FLAG_SCAN_LAN;
        let h1 = plan.plan_hash();
        let h2 = plan.plan_hash();
        assert_eq!(h1, h2);
        assert!(plan.has_flag(FLAG_AUTO_ACTIVATE));
        assert!(!plan.has_flag(FLAG_INSTALL_SERVER));
    }
}
