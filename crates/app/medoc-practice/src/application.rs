//! Practice-host application facade (re-exports medoc-core + Tauri RBAC guards).

pub use medoc_core::application::{
    app_kv_policy, appointment_hint_fulfillment, audit_chain_guard, auth_service, break_glass,
    chart, device_session_service, own_profile, practice_task_notify, totp_service,
};
pub use medoc_core::mvp_security;

pub mod rbac {
    pub use crate::commands::rbac_state::{require, require_authenticated, require_one_of};
    pub use medoc_core::application::rbac::*;
}
