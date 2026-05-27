//! Practice-host infrastructure facade.
//!
//! Most modules now live in `medoc_core::infrastructure` (database, crypto,
//! logging, PDF, …) and are re-exported here so existing
//! `crate::infrastructure::<module>` import paths keep compiling.
//!
//! The four modules below stay in the practice crate:
//! - `app_menu` is Tauri-bound (native macOS menu).
//! - `company_host` will move to the dedicated `medoc-company` crate in Wave B7.
//! - `lan_server` will move to the dedicated `medoc-lan` crate in Wave B7.
//! - `company_portal` is the practice host's HTTP client to the company
//!   server — stays here until the frontend split decides where it belongs.

pub use medoc_core::infrastructure::{
    backup, clinical_pdf_layout, clinical_text_format, company_portal, cors_policy, crypto,
    database, devices, dsfa, dsgvo, license, license_repo, logging, migration, notifications,
    payment, pdf, pdf_core, pdf_letterhead, perf, photo_viewer_scan, retention, secret_store,
    telematik, totp, update, vvt,
};

pub mod app_menu;
pub mod company_host;
pub mod lan_server;
