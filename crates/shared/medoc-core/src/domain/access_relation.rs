//! Relationship-based access (ReBAC) on top of roles and area levels.
//!
//! A level says *what* a person may do in an area ("Calendar: create"); a scope says *on which
//! records*: all of them, or only those the person is related to. Today the relation is
//! "assigned clinician" on appointments (`appointment.physician_id`). The medical record has no
//! responsible-clinician field yet, so it is not scopable (docs/architecture/device-flavors-and-access.md).
//!
//! A scope is stored as an entry in the person's replicated override list (`scope.own.<area>`),
//! so it travels with the session to every check and every device without a schema change.

use std::collections::BTreeSet;

use crate::domain::access::Area;
use crate::domain::rbac::PermissionOverride;

/// Areas whose records name a responsible person.
pub const SCOPABLE_AREAS: [Area; 1] = [Area::Calendar];

const PREFIX: &str = "scope.own.";

pub fn scope_action(area: Area) -> String {
    format!("{PREFIX}{}", area.wire())
}

pub fn is_scope_action(action: &str) -> bool {
    action.starts_with(PREFIX)
}

/// Areas limited to the person's own records.
pub fn own_scopes(overrides: &[PermissionOverride]) -> BTreeSet<Area> {
    overrides
        .iter()
        .filter(|o| o.effect == "ALLOW")
        .filter_map(|o| o.action.strip_prefix(PREFIX).and_then(Area::parse))
        .filter(|a| SCOPABLE_AREAS.contains(a))
        .collect()
}

/// Replaces the scope entries in `overrides`, keeping every other entry.
pub fn with_own_scopes(
    overrides: &[PermissionOverride],
    own: &BTreeSet<Area>,
) -> Vec<PermissionOverride> {
    let mut out: Vec<PermissionOverride> = overrides
        .iter()
        .filter(|o| !is_scope_action(&o.action))
        .cloned()
        .collect();
    out.extend(
        own.iter()
            .filter(|a| SCOPABLE_AREAS.contains(a))
            .map(|a| PermissionOverride {
                action: scope_action(*a),
                effect: "ALLOW".into(),
            }),
    );
    out
}

/// May `user_id` act on a record of `area` whose responsible person is `owner_id`?
/// Without an own-only scope: yes (the level check already passed). With it: only their own.
pub fn may_act_on(
    overrides: &[PermissionOverride],
    area: Area,
    user_id: &str,
    owner_id: &str,
) -> bool {
    !own_scopes(overrides).contains(&area) || owner_id == user_id
}

#[cfg(test)]
mod tests {
    use super::*;

    fn allow(action: &str) -> PermissionOverride {
        PermissionOverride {
            action: action.into(),
            effect: "ALLOW".into(),
        }
    }

    #[test]
    fn without_scope_everyone_with_the_level_may_act() {
        assert!(may_act_on(&[], Area::Calendar, "me", "someone-else"));
    }

    #[test]
    fn own_scope_limits_to_records_of_the_person() {
        let o = vec![allow("scope.own.calendar")];
        assert!(may_act_on(&o, Area::Calendar, "me", "me"));
        assert!(!may_act_on(&o, Area::Calendar, "me", "someone-else"));
    }

    #[test]
    fn unscopable_areas_are_ignored() {
        let o = vec![allow("scope.own.billing")];
        assert!(own_scopes(&o).is_empty());
        assert!(may_act_on(&o, Area::Billing, "me", "other"));
    }

    #[test]
    fn replacing_scopes_keeps_other_overrides() {
        let o = vec![allow("cash.create"), allow("scope.own.calendar")];
        let next = with_own_scopes(&o, &BTreeSet::new());
        assert_eq!(next, vec![allow("cash.create")]);
        let back = with_own_scopes(&next, &[Area::Calendar].into_iter().collect());
        assert_eq!(own_scopes(&back), [Area::Calendar].into_iter().collect());
    }
}
