//! Practice-host infrastructure — shared core + LAN/company server facades.

pub use medoc_core::infrastructure::{
    backup, backup_files, clinical_text_format, company_portal, crypto, database, devices, dpia,
    durable_cache, error_reports, gdpr, license, logging, migration, notifications, payment, pdf,
    perf, photo_viewer_scan, retention, secret_store, telematik, totp, update, vvt,
};

#[cfg(feature = "cap-net")]
pub use medoc_core::infrastructure::cors_policy;
#[cfg(feature = "cap-net")]
pub use medoc_lan as lan_server;

pub mod app_menu;
pub mod github_updates;
