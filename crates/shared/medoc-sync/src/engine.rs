//! Sync orchestration — push/pull/mesh over HTTPS.
//!
//! | Module | Responsibility |
//! |--------|----------------|
//! | [`types`] | IPC/LAN report DTOs |
//! | [`run`] | [`SyncEngine`] implementation |
//!
//! Legacy flat path: `medoc_sync::engine::*`.

mod initial_copy;
mod run;
mod types;

pub use initial_copy::{finish_replica_initial_copy, replica_initial_copy_blocks_catchup};
pub(crate) use run::master_http_client_for_reconcile;
pub use run::{SyncEngine, PULL_ROW_RETRY_LIMIT};
pub use types::{
    InitialCopyProgress, MeshSyncReport, ReplicaPullPage, SyncPullResult, SyncPushResult,
    SyncRunReport,
};
