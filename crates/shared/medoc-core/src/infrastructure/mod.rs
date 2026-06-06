//! Non-Tauri infrastructure layer shared by every MeDoc binary
//! (practice host, LAN server, company server).
//!
//! Modules that remain in the practice crate because they are Tauri-bound
//! (`app_menu`), system-specific HTTP hosts (`company_host`, `lan_server`),
//! or single-tenant HTTP clients (`company_portal`).

pub mod backup;
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
pub mod perf;
pub mod photo_viewer_scan;
pub mod retention;
pub mod secret_store;
pub mod telematik;
pub mod totp;
pub mod update;
pub mod vvt;

// ---------------------------------------------------------------------------
// PDF (R2) — canonical tree: `pdf/`; legacy flat shims for stable import paths.
// ---------------------------------------------------------------------------
pub mod pdf;

pub mod clinical_pdf_layout;
pub mod pdf_core;
pub mod pdf_export;
pub mod pdf_letterhead;

pub mod license_repo;
