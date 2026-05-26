//! Non-Tauri infrastructure layer shared by every MeDoc binary
//! (practice host, LAN server, company server).
//!
//! Modules that remain in the practice crate because they are Tauri-bound
//! (`app_menu`), system-specific HTTP hosts (`company_host`, `lan_server`),
//! or single-tenant HTTP clients (`company_portal`) — see
//! `app/src-tauri/src/infrastructure/mod.rs`.

pub mod backup;
pub mod clinical_pdf_layout;
pub mod clinical_text_format;
pub mod company_portal;
pub mod cors_policy;
pub mod crypto;
pub mod database;
pub mod devices;
pub mod dsfa;
pub mod dsgvo;
pub mod license;
pub mod logging;
pub mod migration;
pub mod notifications;
pub mod payment;
pub mod pdf;
pub mod pdf_core;
pub mod pdf_letterhead;
pub mod perf;
pub mod photo_viewer_scan;
pub mod retention;
pub mod secret_store;
pub mod telematik;
pub mod totp;
pub mod update;
pub mod vvt;
