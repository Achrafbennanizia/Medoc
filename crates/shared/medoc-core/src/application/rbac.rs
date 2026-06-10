// Role-Based Access Control (NFA-SEC-03).
//
// Centralised policy: maps a role to the set of resources/actions it may
// perform. Backend Tauri commands call `require()` with the active session
// before executing privileged operations.
//
// This module hosts the *pure* policy:
// - the `Role` enum (re-exported from `domain::rbac`),
// - the build-time-generated permission matrix (`rbac_matrix_allowed`),
// - and `effective_allowed` (matrix + per-user ALLOW/DENY overrides).
//
// The Tauri-State-bound entry points (`require`, `require_authenticated`,
// `require_one_of`) live in the practice crate's `commands::rbac_state`
// because they take a `&State<'_, SessionState>`. The practice crate's
// `application::rbac` shim re-exports them next to the matrix below so
// `crate::application::rbac::require(…)` keeps working at every call site.

use crate::domain::rbac::PermissionOverride;

// `Role` itself lives in `domain::rbac` so lower layers (e.g. `domain::services`) can
// reference it without an upward dependency. Re-exported here for source compatibility
// with the many `use crate::application::rbac::Role;` (and `{self, Role}`) call sites.
pub use crate::domain::rbac::{
    is_deferred_role_wire, is_login_role_allowed, Role, DEFERRED_ROLE_WIRES,
};

include!(concat!(env!("OUT_DIR"), "/rbac_generated.rs"));

/// Finanzen-Lesezugriff: volle Finanzübersicht (Arzt/Steuerberater) oder Kassenbereich (Rezeption).
pub const FINANZEN_READ_OR_RECEPTION: &[&str] = &["finanzen.read", "finanzen.reception.view"];

/// Permission matrix from `config/rbac.yaml` (generated at build time).
pub fn allowed(action: &str, role: Role) -> bool {
    rbac_matrix_allowed(action, role)
}

/// FA-PERS-07: Rollenmatrix, überschrieben durch explizite ALLOW/DENY-Zeilen pro Benutzer.
pub fn effective_allowed(action: &str, role: Role, overrides: &[PermissionOverride]) -> bool {
    for o in overrides {
        if o.action == action {
            return match o.effect.as_str() {
                "ALLOW" => true,
                "DENY" => false,
                _ => allowed(action, role),
            };
        }
    }
    allowed(action, role)
}
