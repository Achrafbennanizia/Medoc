//! # LAN System (local practice server)
//!
//! HTTPS API + UDP discovery on the practice network. Shares **`medoc.db`** with the host.
//!
//! - **Factory:** [`LanSystemFactory`] builds router + TLS state.
//! - **Adapter:** re-exports `infrastructure::lan_server` HTTP/TLS/discovery.
//!
//! Does **not** own vendor data; ops routes proxy to the Company system via `company::CompanyPortalHttpAdapter`.

pub use crate::infrastructure::lan_server;

pub mod facade;

pub use facade::LanSystemFactory;
