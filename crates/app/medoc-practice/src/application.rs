//! Practice-host application facade (re-exports medoc-core + Tauri RBAC guards).

pub use medoc_core::application::{
    akte, app_kv_policy, audit_chain_guard, auth_service, break_glass, device_session_service,
    own_profile, praxis_aufgabe_notify, termin_hint_fulfillment, totp_service,
};

pub mod rbac {
    pub use crate::commands::rbac_state::{require, require_authenticated, require_one_of};
    pub use medoc_core::application::rbac::*;
}
