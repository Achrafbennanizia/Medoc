//! Cross-cutting persistence ports (DIP).
//!
//! HTTP handlers, engines, and tests depend on these traits — not on SQLx
//! details — so backends can be swapped (SQLite today, mock/in-memory in tests).

pub mod pairing;
pub mod sync;

pub use pairing::{PairingPersistence, SqlitePairingStore};
pub use sync::{SqliteSyncStore, SyncReplicationStore};
