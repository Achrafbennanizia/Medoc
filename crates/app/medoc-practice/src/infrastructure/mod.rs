//! Practice-host infrastructure — shared core + LAN/company server facades.

pub use medoc_core::infrastructure::{
    backup, backup_files, clinical_text_format, company_portal, cors_policy, crypto, database,
    devices, dpia, durable_cache, gdpr, license, logging, migration, notifications, payment, pdf,
    perf, photo_viewer_scan, retention, secret_store, telematik, totp, update, vvt,
};

pub use medoc_company as company_host;
pub use medoc_lan as lan_server;

pub mod app_menu;
pub mod github_updates;
