//! RBAC primitives — `Role` enum (the four MeDoc personae, FA-PERS-01 /
//! NFA-SEC-03) and `PermissionOverride` (per-user ALLOW/DENY rows from
//! FA-PERS-07).
//!
//! Lives in `domain/` so lower layers can name roles + overrides without
//! upward dependencies into `application::`. The full RBAC matrix +
//! Tauri-State guard helpers stay in the practice crate's
//! `application::rbac`, which re-exports both types from here.

use serde::{Deserialize, Serialize};

/// Roles defined in the requirements (4 personae).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    Arzt,
    Rezeption,
    Steuerberater,
    Pharmaberater,
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
}

/// Per-user RBAC override (FA-PERS-07). `effect` is `"ALLOW"` or `"DENY"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionOverride {
    pub action: String,
    pub effect: String,
}
