//! Non-Tauri infrastructure layer shared by every MeDoc binary
//! (practice host, LAN server, company server).
//!
//! Modules that remain in the practice crate because they are Tauri-bound
//! (`app_menu`), system-specific HTTP hosts (`company_host`, `lan_server`),
//! or single-tenant HTTP clients (`company_portal`).

pub mod backup;
pub mod backup_files;
pub mod clinical_text_format;
pub mod company_portal;
pub mod cors_policy;
pub mod crypto;
pub mod database;
pub mod devices;
pub mod dpia;
pub mod durable_cache;
pub mod fs_guard;
pub mod gdpr;
pub mod install_plan;
pub mod license;
pub mod logging;
pub mod migration;
pub mod notifications;
pub mod payment;
pub mod perf;
pub mod photo_viewer_scan;
pub mod retention;
pub mod secret_store;
pub mod telematik;
pub mod totp;
pub mod update;
pub mod usb_vault;
pub mod vvt;

pub mod pdf;
