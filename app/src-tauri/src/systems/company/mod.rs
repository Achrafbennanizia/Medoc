//! # Company System (vendor / Hersteller server)
//!
//! Subscription, feature flags, integrations status, updates, billing — **`company.db`** only.
//!
//! - **HTTP host:** `infrastructure::company_host` (stays in the practice
//!   crate until Wave B7.2 lifts it into `medoc-company`).
//! - **Outbound client (from practice/LAN):** [`CompanyPortalHttpAdapter`]
//!   — now lives in `medoc_core::company` so the LAN-server crate can use
//!   the same trait/singleton.
//!
//! Must never read `medoc.db` patient rows.

pub use crate::infrastructure::company_host;
pub use medoc_core::company::{CompanyPortalHttpAdapter, CompanyPortalPort, COMPANY_PORTAL};
