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

use crate::domain::access;
use crate::domain::rbac::PermissionOverride;

// `Role` itself lives in `domain::rbac` so lower layers (e.g. `domain::services`) can
// reference it without an upward dependency. Re-exported here for source compatibility
// with the many `use crate::application::rbac::Role;` (and `{self, Role}`) call sites.
pub use crate::domain::rbac::{
    is_deferred_role_wire, is_login_role_allowed, Role, DEFERRED_ROLE_WIRES,
};

include!(concat!(env!("OUT_DIR"), "/rbac_generated.rs"));

/// Finance read access: full finance overview (physician/tax advisor) or cash-desk area (reception).
pub const FINANCE_READ_OR_RECEPTION: &[&str] = &["finance.read", "finance.reception.view"];

/// Staff toggle: full patient chart visible, clinical mutations still forbidden.
pub const PATIENT_READ_MEDICAL: &str = "patient.read_medical";
pub const PATIENT_WRITE_MEDICAL: &str = "patient.write_medical";

/// Permission matrix from `config/rbac.yaml` (generated at build time).
///
/// A scoped action from the access catalogue (`cash.create` …) is not in the
/// matrix; it answers as its legacy name does, or by the role's default
/// profile when it has none. Callers that check a role without a session
/// (LAN app-kv, tests) therefore keep working with the new names.
pub fn allowed(action: &str, role: Role) -> bool {
    if let Some(rule) = access::rule(action) {
        if rule.kind == access::ActionKind::Scoped {
            if rule.legacy.is_empty() {
                return access::rule_allows(&access::default_levels(role), rule);
            }
            return rule
                .legacy
                .iter()
                .any(|legacy| rbac_matrix_allowed(legacy, role));
        }
    }
    rbac_matrix_allowed(action, role)
}

/// True when `config/rbac.yaml` grants the action to at least one role, or
/// the access catalogue ([`crate::domain::access::ACTION_RULES`]) knows it.
pub fn is_known_action(action: &str) -> bool {
    access::rule(action).is_some() || in_matrix(action)
}

/// True when `config/rbac.yaml` itself grants the action to some role.
pub fn is_matrix_action(action: &str) -> bool {
    in_matrix(action)
}

fn in_matrix(action: &str) -> bool {
    [
        Role::Physician,
        Role::Reception,
        Role::TaxAdvisor,
        Role::PharmaConsultant,
    ]
    .into_iter()
    .any(|role| rbac_matrix_allowed(action, role))
}

/// FA-PERS-07 + access profiles.
///
/// Order, first match wins:
/// 1. an explicit ALLOW/DENY entry in `overrides`. Hand-set per-person
///    overrides come first, then the entries compiled from the person's
///    access profile (see `application::access_control::session_overrides`);
/// 2. a scoped action (`cash.create` …) without such an entry — i.e. the
///    person has no profile — decides exactly as its legacy name did before,
///    or by the role's default profile when it has no legacy name;
/// 3. the role matrix from `config/rbac.yaml`.
pub fn effective_allowed(action: &str, role: Role, overrides: &[PermissionOverride]) -> bool {
    if guest_write_blocked(action, role) {
        return false;
    }
    proposal_allowed(action, role, overrides)
}

/// Direct writes the Solo guest may perform (not staged). Delivery confirmations only.
#[cfg(feature = "cap-guest-inbox")]
const GUEST_DIRECT_WRITES: &[&str] = &["purchase_order.receive"];

/// In guest-inbox editions (Solo) the only reception login is the guest. It may read what its
/// profile allows but never write: its changes become proposals the admin adds or dismisses
/// (`staged_change`). Exception: confirming a delivery (`purchase_order.receive`).
#[cfg(feature = "cap-guest-inbox")]
fn guest_write_blocked(action: &str, role: Role) -> bool {
    if role != Role::Reception {
        return false;
    }
    if GUEST_DIRECT_WRITES.contains(&action) {
        return false;
    }
    !access::is_read_only_action(action)
}

#[cfg(not(feature = "cap-guest-inbox"))]
fn guest_write_blocked(_action: &str, _role: Role) -> bool {
    false
}

/// What the person's profile grants, before the guest guard: for the guest, what it may
/// propose. Everyone else: same as [`effective_allowed`].
pub fn proposal_allowed(action: &str, role: Role, overrides: &[PermissionOverride]) -> bool {
    if let Some(o) = overrides.iter().find(|o| o.action == action) {
        match o.effect.as_str() {
            "ALLOW" => return true,
            "DENY" => return false,
            _ => {}
        }
    }
    if let Some(rule) = access::rule(action) {
        if rule.kind == access::ActionKind::Scoped {
            if rule.legacy.is_empty() {
                return access::rule_allows(&access::default_levels(role), rule);
            }
            // Legacy rules carry no fallback of their own, so this terminates.
            return rule
                .legacy
                .iter()
                .any(|legacy| proposal_allowed(legacy, role, overrides));
        }
    }
    allowed(action, role)
}

#[cfg(test)]
mod tests {
    use super::is_known_action;

    #[test]
    fn unknown_override_action_is_rejected() {
        assert!(is_known_action("patient.read"));
        assert!(is_known_action("cash.create"));
        assert!(!is_known_action("not.a.real.action"));
    }

    #[test]
    fn without_a_profile_scoped_actions_follow_their_legacy_name() {
        use super::{allowed, effective_allowed, Role};
        for role in [Role::Physician, Role::Reception] {
            assert_eq!(
                effective_allowed("cash.create", role, &[]),
                allowed("finance.write", role)
            );
            assert_eq!(
                effective_allowed("cash.day_close", role, &[]),
                allowed("finance.day_close.write", role)
            );
            assert_eq!(
                effective_allowed("billing.read", role, &[]),
                allowed("finance.read", role)
            );
        }
    }

    #[test]
    fn a_legacy_deny_also_blocks_its_scoped_names() {
        use super::{effective_allowed, Role};
        use crate::domain::rbac::PermissionOverride;
        let deny = vec![PermissionOverride {
            action: "finance.write".into(),
            effect: "DENY".into(),
        }];
        assert!(!effective_allowed("cash.create", Role::Physician, &deny));
        assert!(!effective_allowed("billing.cancel", Role::Physician, &deny));
    }
}
