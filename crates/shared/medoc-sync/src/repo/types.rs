//! Sync replication DTOs and allow-list constants.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::deployment::SyncDeploymentConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutboxEntry {
    pub id: String,
    pub device_id: String,
    pub seq: i64,
    pub entity_table: String,
    pub entity_id: String,
    pub op: String,
    pub payload_json: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPeer {
    pub device_id: String,
    pub display_name: String,
    pub role: String,
    pub peer_base_url: Option<String>,
    pub last_seen_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatusSnapshot {
    pub local_device_id: String,
    pub deployment: SyncDeploymentConfig,
    pub local_seq: i64,
    pub pending_outbox: i64,
    pub peers: Vec<SyncPeer>,
    pub vectors: HashMap<String, i64>,
}

/// Allow-listed entity tables that flow through the outbox.
///
/// Keep in sync with `merge::sanitize_table`.
pub const SYNCED_TABLES: &[&str] = &[
    "patient",
    "patient_chart",
    "appointment",
    "treatment",
    "examination",
    "payment",
    "app_kv",
    "practice_task",
    "anamnesis_form",
    "dental_finding",
    "prescription",
    "certificate",
    "service_item",
    "in_app_notification",
    "practice_ticket",
];
