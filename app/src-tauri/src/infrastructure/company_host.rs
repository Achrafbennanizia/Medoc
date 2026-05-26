//! Re-export shim — the company server lives in the dedicated
//! `medoc-company` crate (`app/crates/medoc-company/`). The
//! `medoc-company-server` binary still lives in this crate (`bin/`) for
//! now and will move into its own binary crate in Wave B8.
//!
//! Re-exported here so every `crate::infrastructure::company_host::*`
//! import (`bin/medoc-company-server.rs` via `medoc_lib::*`,
//! `systems/company::company_host` re-export) keeps resolving.

pub use medoc_company::*;
