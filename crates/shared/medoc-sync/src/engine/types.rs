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
