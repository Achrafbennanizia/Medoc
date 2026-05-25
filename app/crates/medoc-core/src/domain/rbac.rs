//! Role enum — the four MeDoc personae (FA-PERS-01 / NFA-SEC-03).
//!
//! Lives in `domain/` so lower layers (e.g. `domain::services::workflow_transitions`)
//! can name a role without an upward dependency into `application::`.
//! The full RBAC matrix + Tauri-State guard helpers stay in
//! `application::rbac`; `application::rbac::Role` is re-exported from here.

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
