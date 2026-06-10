//! Tauri IPC command surface — grouped by domain (R6).
pub mod admin;
pub mod billing;
pub mod clinical;
pub mod list_params;
pub mod network;
pub mod praxis;
pub mod rbac_state;
pub mod register;
pub mod scheduling;
pub mod system;

// Legacy flat module paths (register.rs + existing call sites):
pub mod patient_commands {
    pub use super::clinical::patient::*;
}
pub mod akte_commands {
    pub use super::clinical::akte::*;
}
pub mod akte_anlage_commands {
    pub use super::clinical::akte_anlage::*;
}
pub mod akte_next_termin_commands {
    pub use super::clinical::akte_next_termin::*;
}
pub mod akte_validation_commands {
    pub use super::clinical::akte_validation::*;
}
pub mod akte_workflow_commands {
    pub use super::clinical::akte_workflow::*;
}
pub mod rezept_commands {
    pub use super::clinical::rezept::*;
}
pub mod attest_commands {
    pub use super::clinical::attest::*;
}
pub mod termin_commands {
    pub use super::scheduling::termin::*;
}
pub mod praxis_aufgabe_commands {
    pub use super::scheduling::praxis_aufgabe::*;
}
pub mod zahlung_commands {
    pub use super::billing::zahlung::*;
}
pub mod leistung_commands {
    pub use super::billing::leistung::*;
}
pub mod invoice_commands {
    pub use super::billing::invoice::*;
}
pub mod invoice_sequence_commands {
    pub use super::billing::invoice_sequence::*;
}
pub mod rechnung_document_commands {
    pub use super::billing::rechnung_document::*;
}
pub mod bilanz_snapshot_commands {
    pub use super::billing::bilanz_snapshot::*;
}
pub mod tagesabschluss_protokoll_commands {
    pub use super::billing::tagesabschluss_protokoll::*;
}
pub mod vertrag_commands {
    pub use super::billing::vertrag::*;
}
pub mod auth_commands {
    pub use super::admin::auth::*;
}
pub mod personal_commands {
    pub use super::admin::personal::*;
}
pub mod audit_commands {
    pub use super::admin::audit::*;
}
pub mod audit_chain_commands {
    pub use super::admin::audit_chain::*;
}
pub mod app_kv_commands {
    pub use super::admin::app_kv::*;
}
pub mod db_setup_commands {
    pub use super::admin::db_setup::*;
}
pub mod break_glass_commands {
    pub use super::admin::break_glass::*;
}
pub mod praxis_commands {
    pub use super::praxis::core::*;
}
pub mod produkt_commands {
    pub use super::praxis::produkt::*;
}
pub mod bestellung_commands {
    pub use super::praxis::bestellung::*;
}
pub mod dokument_template_commands {
    pub use super::praxis::dokument_template::*;
}
pub mod in_app_notification_commands {
    pub use super::praxis::in_app_notification::*;
}
pub mod statistik_commands {
    pub use super::praxis::statistik::*;
}
pub mod feedback_commands {
    pub use super::praxis::feedback::*;
}
pub mod lan_commands {
    pub use super::network::lan::*;
}
pub mod pairing_commands {
    pub use super::network::pairing::*;
}
pub mod sync_commands {
    pub use super::network::sync::*;
}
pub mod company_portal_commands {
    pub use super::network::company_portal::*;
}
pub mod system_commands {
    pub use super::system::core::*;
}
pub mod ops_commands {
    pub use super::system::ops::*;
}
pub mod logging_commands {
    pub use super::system::logging::*;
}
pub mod menu_commands {
    pub use super::system::menu::*;
}
pub mod export_commands {
    pub use super::system::export::*;
}
pub mod document_pdf_commands {
    pub use super::system::document_pdf::*;
}
pub mod report_pdf_commands {
    pub use super::system::report_pdf::*;
}
pub mod subscription_commands {
    pub use super::system::subscription::*;
}
pub mod devices_commands {
    pub use super::system::devices::*;
}
pub mod integration_commands {
    pub use super::system::integration::*;
}
