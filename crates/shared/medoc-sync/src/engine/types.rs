//! Sync engine report DTOs (serialised to Tauri IPC + LAN JSON).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPushResult {
    pub accepted: u32,
    pub last_seq: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncPullResult {
    pub applied: u32,
    pub skipped: u32,
}

/// Span of the one-shot snapshot a new replica is copying.
/// Older clients ignore the field.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InitialCopyProgress {
    pub total: i64,
    pub through_seq: i64,
    pub end_seq: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub device_label: Option<String>,
}

/// Pull page served to a replica. `initial_copy` is set only during a first copy.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplicaPullPage {
    pub entries: Vec<crate::repo::OutboxEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub initial_copy: Option<InitialCopyProgress>,
    /// Rows queued on the main device after the snapshot. Applied without
    /// moving the snapshot cursor, so a new calendar edit is not stuck
    /// behind the rest of the copy.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub live: Vec<crate::repo::OutboxEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRunReport {
    pub push: Option<SyncPushResult>,
    pub pull: Option<SyncPullResult>,
    pub mesh: Option<MeshSyncReport>,
    pub error: Option<String>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshSyncReport {
    pub attempted: u32,
    pub succeeded: u32,
    pub errors: Vec<String>,
}
