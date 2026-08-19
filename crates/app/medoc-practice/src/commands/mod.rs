//! Tauri IPC command surface — grouped by domain (R6).
pub mod admin;
pub mod app_lifecycle;
pub mod billing;
pub mod clinical;
pub mod list_params;
pub mod network;
pub mod practice;
pub mod rbac_state;
pub mod register;
pub mod scheduling;
pub mod system;

// Legacy flat module paths (register.rs + existing call sites):
pub mod patient_commands {
    pub use super::clinical::patient::*;
}
pub mod chart_commands {
    pub use super::clinical::chart::*;
}
pub mod chart_attachment_commands {
    pub use super::clinical::chart_attachment::*;
}
pub mod chart_next_appointment_commands {
    pub use super::clinical::chart_next_appointment::*;
}
pub mod chart_validation_commands {
    pub use super::clinical::chart_validation::*;
}
pub mod chart_workflow_commands {
    pub use super::clinical::chart_workflow::*;
}
pub mod prescription_commands {
    pub use super::clinical::prescription::*;
}
pub mod certificate_commands {
    pub use super::clinical::certificate::*;
}
pub mod appointment_commands {
    pub use super::scheduling::appointment::*;
}
pub mod practice_task_commands {
    pub use super::scheduling::practice_task::*;
}
pub mod payment_commands {
    pub use super::billing::payment::*;
}
pub mod service_item_commands {
    pub use super::billing::service_item::*;
}
pub mod invoice_commands {
    pub use super::billing::invoice::*;
}
pub mod invoice_sequence_commands {
    pub use super::billing::invoice_sequence::*;
}
pub mod invoice_document_commands {
    pub use super::billing::invoice_document::*;
}
pub mod balance_sheet_snapshot_commands {
    pub use super::billing::balance_sheet_snapshot::*;
}
pub mod day_close_protocol_commands {
    pub use super::billing::day_close_protocol::*;
}
pub mod contract_commands {
    pub use super::billing::contract::*;
}
pub mod auth_commands {
    pub use super::admin::auth::*;
}
pub mod staff_commands {
    pub use super::admin::staff::*;
}
pub mod work_time_commands {
    pub use super::admin::work_time::*;
}
pub mod sick_leave_certificate_commands {
    pub use super::admin::sick_leave_certificate::*;
}
pub mod work_plan_adjustment_commands {
    pub use super::admin::work_plan_adjustment::*;
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
pub mod practice_commands {
    pub use super::practice::core::*;
}
pub mod product_commands {
    pub use super::practice::product::*;
}
pub mod purchase_order_commands {
    pub use super::practice::purchase_order::*;
}
pub mod document_template_commands {
    pub use super::practice::document_template::*;
}
pub mod in_app_notification_commands {
    pub use super::practice::in_app_notification::*;
}
pub mod statistics_commands {
    pub use super::practice::statistics::*;
}
pub mod feedback_commands {
    pub use super::practice::feedback::*;
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
