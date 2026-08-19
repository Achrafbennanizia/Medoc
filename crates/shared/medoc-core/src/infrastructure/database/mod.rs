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
pub mod chart_attachment_repo;
pub mod chart_next_appointment_repo;
pub mod chart_repo;
pub mod chart_validation_repo;
pub mod app_kv_repo;
pub mod certificate_repo;
pub mod audit_break_glass;
pub mod audit_repo;
pub mod purchase_order_repo;
pub mod balance_sheet_snapshot_repo;
pub mod brute_force_repo;
pub mod device_session_repo;
pub mod document_template_repo;
pub mod in_app_notification_repo;
pub mod service_item_repo;
pub mod license_repo;
pub mod patient_repo;
pub mod staff_permission_repo;
pub mod staff_repo;
pub mod practice_task_repo;
pub mod practice_repo;
pub mod practice_ticket_repo;
pub mod product_repo;
pub mod invoice_document_repo;
pub mod prescription_repo;
pub mod day_close_protocol_repo;
pub mod appointment_repo;
pub mod contract_repo;
pub mod payment_repo;
