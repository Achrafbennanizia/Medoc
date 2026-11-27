//! Sync orchestration — push/pull/mesh over HTTPS.
//!
//! | Module | Responsibility |
//! |--------|----------------|
//! | [`types`] | IPC/LAN report DTOs |
//! | [`run`] | [`SyncEngine`] implementation |
//! | [`route`] | Group: star vs origin-sends when the primary is down (T4.1) |
//!
//! Legacy flat path: `medoc_sync::engine::*`.

pub mod catch_up;
mod initial_copy;
pub mod origin_pull;
pub mod route;
mod run;
mod types;

pub use initial_copy::{finish_replica_initial_copy, replica_initial_copy_blocks_catchup};
pub(crate) use run::master_http_client_for_reconcile;
pub use run::{SyncEngine, PULL_ROW_RETRY_LIMIT};
pub use types::{
    InitialCopyProgress, MeshSyncReport, ReplicaPullPage, SyncExchangePage, SyncPullResult,
    SyncPushResult, SyncRunReport,
};
