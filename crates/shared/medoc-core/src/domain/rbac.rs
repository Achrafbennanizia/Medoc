//! RBAC primitives — `Role` enum (the four MeDoc personae, FA-PERS-01 /
//! NFA-SEC-03) and `PermissionOverride` (per-user ALLOW/DENY rows from
//! FA-PERS-07).
//!
//! Lives in `domain/` so lower layers can name roles + overrides without
//! upward dependencies into `application::`. The full RBAC matrix +
//! Tauri-State guard helpers stay in the practice crate's
//! `application::rbac`, which re-exports both types from here.

use serde::{Deserialize, Serialize};

/// Roles defined in the requirements (4 personae; 2 deferred for MVP — see `deferred_roles`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Arzt,
    Rezeption,
    // TODO(deferred-roles): re-enable login — docs/coordination/todos-deferred-roles.md
    Steuerberater,
    Pharmaberater,
}

/// Wire strings for advisor personae disabled in MVP UI/login.
pub const DEFERRED_ROLE_WIRES: &[&str] = &["STEUERBERATER", "PHARMABERATER"];

pub fn is_deferred_role_wire(s: &str) -> bool {
    DEFERRED_ROLE_WIRES
        .iter()
        .any(|r| r.eq_ignore_ascii_case(s.trim()))
}

/// Active MVP login roles (`ARZT`, `REZEPTION`).
pub fn is_login_role_allowed(s: &str) -> bool {
    !is_deferred_role_wire(s)
}

impl Role {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "ARZT" => Some(Role::Arzt),
            "REZEPTION" => Some(Role::Rezeption),
            "STEUERBERATER" => Some(Role::Steuerberater),
            "PHARMABERATER" => Some(Role::Pharmaberater),
            _ => None,
        }
    }

    pub fn is_deferred(self) -> bool {
        matches!(self, Role::Steuerberater | Role::Pharmaberater)
    }
}

/// Per-user RBAC override (FA-PERS-07). `effect` is `"ALLOW"` or `"DENY"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionOverride {
    pub action: String,
    pub effect: String,
}
