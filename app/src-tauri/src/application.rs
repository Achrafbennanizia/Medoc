//! Practice-host application facade.
//!
//! All application services moved to `medoc_core::application` so the LAN
//! server (`medoc-lan` crate) and the company server (`medoc-company` crate)
//! can call them without dragging the Tauri runtime in. Each submodule is
//! re-exported here so every `use crate::application::<x>::Y;` site in the
//! practice crate (commands + tests + lib) keeps compiling.
//!
//! The `rbac` module is the one exception: its pure policy lives in
//! `medoc_core::application::rbac`, while the Tauri-State-bound guards
//! (`require`, `require_authenticated`, `require_one_of`) live in
//! `commands::rbac_state`. The shim below merges both surfaces so the many
//! `use crate::application::rbac::{Role, require, …};` call sites continue
//! to resolve unchanged.

pub use medoc_core::application::{
    akte, app_kv_policy, audit_chain_guard, auth_service, break_glass, own_profile,
    praxis_aufgabe_notify, termin_hint_fulfillment,
};

pub mod rbac {
    pub use crate::commands::rbac_state::{require, require_authenticated, require_one_of};
    pub use medoc_core::application::rbac::*;
}
