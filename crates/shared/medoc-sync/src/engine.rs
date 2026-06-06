//! Sync orchestration — push/pull/mesh over HTTPS.
//!
//! | Module | Responsibility |
//! |--------|----------------|
//! | [`types`] | IPC/LAN report DTOs |
//! | [`run`] | [`SyncEngine`] implementation |
//!
//! Legacy flat path: `medoc_sync::engine::*`.

mod run;
mod types;

pub use run::SyncEngine;
pub use types::{MeshSyncReport, SyncPullResult, SyncPushResult, SyncRunReport};
