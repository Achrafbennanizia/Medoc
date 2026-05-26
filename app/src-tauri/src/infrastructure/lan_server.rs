//! Re-export shim — the LAN server lives in the dedicated `medoc-lan` crate
//! (`app/crates/medoc-lan/`) so it can be built + run without the Tauri
//! desktop runtime (`bin/medoc-server.rs` and a future standalone Linux/
//! macOS service can both pull it in via `medoc_lan::serve_*`).
//!
//! Re-exported here so every `crate::infrastructure::lan_server::*` import
//! in the practice crate (`commands::lan_commands`, `systems::lan::facade`,
//! `bin/medoc-server.rs` via `medoc_lib`) keeps resolving unchanged.

pub use medoc_lan::*;
