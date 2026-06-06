//! Sync replication repository — modular layout (R5b).
//!
//! | Module | Responsibility |
//! |--------|----------------|
//! | [`types`] | DTOs + `SYNCED_TABLES` allow-list |
//! | [`store`] | SQLite outbox + device registry |
//!
//! Legacy flat path: all items re-exported at `medoc_sync::repo::*`.

mod store;
mod types;

pub use store::*;
pub use types::*;
