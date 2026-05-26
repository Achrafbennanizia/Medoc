//! Cross-system Company-portal adapter (HTTP client to the vendor server).
//!
//! Lives in `medoc-core` because both the practice host (calls the portal
//! directly from Tauri commands) and the LAN server crate (proxies portal
//! calls for browser clients on the LAN) consume the same `CompanyPortalPort`
//! trait + `COMPANY_PORTAL` singleton. The actual company server
//! (`infrastructure::company_host`) is a separate concern that stays in the
//! practice crate until it moves to `medoc-company` in Wave B7.2.

pub mod adapter;
pub mod port;

pub use adapter::{CompanyPortalHttpAdapter, COMPANY_PORTAL};
pub use port::CompanyPortalPort;
