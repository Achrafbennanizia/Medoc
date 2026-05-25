//! # Company System (vendor / Hersteller server)
//!
//! Subscription, feature flags, integrations status, updates, billing — **`company.db`** only.
//!
//! - **HTTP host:** `infrastructure::company_host`
//! - **Outbound client (from practice/LAN):** [`CompanyPortalHttpAdapter`] (**Adapter** pattern)
//!
//! Must never read `medoc.db` patient rows.

pub use crate::infrastructure::company_host;

pub mod adapter;
pub mod port;

pub use adapter::{CompanyPortalHttpAdapter, COMPANY_PORTAL};
pub use port::CompanyPortalPort;
