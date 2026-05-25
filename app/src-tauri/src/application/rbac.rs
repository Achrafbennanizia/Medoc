// Role-Based Access Control (NFA-SEC-03).
//
// Centralised policy: maps a role to the set of resources/actions it may
// perform. Backend Tauri commands call `require()` with the active session
// before executing privileged operations.
//
// This module contains the *pure* policy: the `Role` enum (re-exported
// from `domain::rbac`), the build-time-generated permission matrix
// (`rbac_matrix_allowed`), and `effective_allowed` (matrix + per-user
// ALLOW/DENY overrides). Tauri-State-bound entry points (`require`,
// `require_authenticated`, `require_one_of`) live in `commands::rbac_state`
// and are re-exported below so existing `use crate::application::rbac::require;`
// call sites keep working unchanged.

use crate::application::auth_service::PermissionOverride;

// `Role` itself lives in `domain::rbac` so lower layers (e.g. `domain::services`) can
// reference it without an upward dependency. Re-exported here for source compatibility
// with the many `use crate::application::rbac::Role;` (and `{self, Role}`) call sites.
pub use crate::domain::rbac::Role;

// Tauri-State-bound guards. Re-exported so existing `rbac::require(...)`
// call sites keep working; the implementations now sit under `commands::`.
pub use crate::commands::rbac_state::{require, require_authenticated, require_one_of};

include!(concat!(env!("OUT_DIR"), "/rbac_generated.rs"));

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
