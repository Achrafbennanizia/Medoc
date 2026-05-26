//! # MeDoc Company server crate
//!
//! Vendor portal host — subscription, feature flags, integrations status,
//! updates, billing. Backed by a dedicated `company.db` and exposed via
//! HTTP/JSON. Designed to run on the company's own infrastructure
//! (`medoc-company-server` binary in `app/src-tauri/src/bin/` — to move
//! into a dedicated binary crate in Wave B8).
//!
//! Boundary: this crate must never read `medoc.db` patient rows. The
//! practice host talks to it via the outbound HTTP adapter in
//! `medoc_core::company` (`CompanyPortalPort` / `COMPANY_PORTAL`).

pub mod api_key;
pub mod db;
pub mod http;
