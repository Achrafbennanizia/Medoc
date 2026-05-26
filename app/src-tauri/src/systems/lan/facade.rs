//! LAN system **Facade** — thin re-export shim.
//!
//! `LanSystemFactory` now lives in `medoc_lan::LanSystemFactory` so the
//! standalone `medoc-server` binary can build router + TLS state without
//! pulling in the practice crate. Re-exported here so existing
//! `crate::systems::lan::LanSystemFactory` import paths keep resolving.

pub use medoc_lan::LanSystemFactory;
