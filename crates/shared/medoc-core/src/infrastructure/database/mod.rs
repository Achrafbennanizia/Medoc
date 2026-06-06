//! SQLCipher database layer — connection, migrations, domain-grouped repos.
//!
//! ### Layout (R5)
//!
//! - [`connection`], [`db_key`], [`sqlcipher`] — pool lifecycle
//! - [`migrations`] — schema evolution
//! - [`repos`] — canonical repository implementations by domain
//! - [`ports`] — [`DatabasePool`] and future store traits
//! - `*_repo.rs` shims — legacy flat import paths (re-export from [`repos`])

pub mod migrations;
pub mod ports;
pub mod repos;

pub mod connection;
pub mod db_key;
pub mod sqlcipher;
pub mod sync_outbox;

// ---------------------------------------------------------------------------
// Legacy flat repo shims (R5) — canonical code under `repos/{clinical,...}/`.
// Old wiring (commented): each `*_repo.rs` file held the full SQLx impl inline.
// ---------------------------------------------------------------------------
pub mod akte_anlage_repo;
pub mod akte_next_termin_repo;
pub mod akte_repo;
pub mod akte_validation_repo;
pub mod app_kv_repo;
pub mod attest_repo;
pub mod audit_break_glass;
pub mod audit_repo;
pub mod bestellung_repo;
pub mod bilanz_snapshot_repo;
pub mod brute_force_repo;
pub mod device_session_repo;
pub mod dokument_template_repo;
pub mod in_app_notification_repo;
pub mod leistung_repo;
pub mod license_repo;
pub mod patient_repo;
pub mod personal_permission_repo;
pub mod personal_repo;
pub mod praxis_aufgabe_repo;
pub mod praxis_repo;
pub mod praxis_ticket_repo;
pub mod produkt_repo;
pub mod rechnung_document_repo;
pub mod rezept_repo;
pub mod tagesabschluss_protokoll_repo;
pub mod termin_repo;
pub mod vertrag_repo;
pub mod zahlung_repo;
