//! Group sharing rules ("Allowances", T5.1, docs/architecture/editions-plan.md §4.5 / §6.15).
//!
//! One legal entity: everything is shared by default. Each dentist narrows what concerns them:
//! who **sees** their data per area (view rule) and who may **change** it (change rule). A
//! single record can also be made private or hidden from named people (record rule). Only the
//! owner sets rules about their own data; these are pure decisions, the repository stores them
//! and `application::allowances` turns them into query filters.
//!
//! Patient master data and practice-wide master data have no owner and are always shared.

use serde::{Deserialize, Serialize};

/// What a rule is about. Wire names are stable (stored and synced).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShareArea {
    Calendar,
    WorkHours,
    Clinical,
    Documents,
    Payments,
    Statistics,
    Tasks,
    Orders,
    History,
}

impl ShareArea {
    pub const ALL: [ShareArea; 9] = [
        Self::Calendar,
        Self::WorkHours,
        Self::Clinical,
        Self::Documents,
        Self::Payments,
        Self::Statistics,
        Self::Tasks,
        Self::Orders,
        Self::History,
    ];

    pub fn wire(self) -> &'static str {
        match self {
            Self::Calendar => "calendar",
            Self::WorkHours => "work_hours",
            Self::Clinical => "clinical",
            Self::Documents => "documents",
            Self::Payments => "payments",
            Self::Statistics => "statistics",
            Self::Tasks => "tasks",
            Self::Orders => "orders",
            Self::History => "history",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|a| a.wire() == s)
    }
}

/// Who sees the owner's data in an area.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ViewRule {
    Everyone,
    OtherAdmin,
    /// The other admin and these staff ids.
    Chosen {
        staff: Vec<String>,
    },
    Nobody,
}

/// Who besides the owner may change the owner's data in an area.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ChangeRule {
    Me,
    MeAndOtherAdmin,
    /// The other admin and these staff ids; `reception` lets every front-desk account in.
    MeAdminAnd {
        #[serde(default)]
        staff: Vec<String>,
        #[serde(default)]
        reception: bool,
    },
    Everyone,
}

/// One record made private (owner only) or hidden from named people.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RecordRule {
    Private,
    HiddenFrom { staff: Vec<String> },
}

/// The person asking.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Viewer {
    pub staff_id: String,
    /// Holds `access.manage` (one of the practice's admins).
    pub is_admin: bool,
    pub is_reception: bool,
}

/// How much of a record the viewer gets.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Sight {
    Hidden,
    Full,
}

/// Defaults of §6.15: share everything; change rules as the table says.
pub fn default_view(_area: ShareArea) -> ViewRule {
    ViewRule::Everyone
}

pub fn default_change(area: ShareArea) -> ChangeRule {
    match area {
        ShareArea::Calendar => ChangeRule::MeAdminAnd {
            staff: vec![],
            reception: true,
        },
        // Q-E: the other dentist adds entries and comments but never edits mine.
        ShareArea::Clinical => ChangeRule::Me,
        ShareArea::Documents => ChangeRule::MeAdminAnd {
            staff: vec![],
            reception: true,
        },
        ShareArea::Tasks => ChangeRule::Everyone,
        _ => ChangeRule::MeAndOtherAdmin,
    }
}

/// What `viewer` sees of `owner`'s data in `area` under `rule`. The owner always sees it all;
/// data without an owner (`None`) is practice data and always shared.
pub fn sight(owner: Option<&str>, viewer: &Viewer, rule: &ViewRule) -> Sight {
    let Some(owner) = owner.filter(|o| !o.is_empty()) else {
        return Sight::Full;
    };
    if owner == viewer.staff_id {
        return Sight::Full;
    }
    let shown = match rule {
        ViewRule::Everyone => true,
        ViewRule::OtherAdmin => viewer.is_admin,
        ViewRule::Chosen { staff } => viewer.is_admin || staff.contains(&viewer.staff_id),
        ViewRule::Nobody => false,
    };
    if shown {
        Sight::Full
    } else {
        Sight::Hidden
    }
}

/// May `actor` change `owner`'s data in an area under `rule`?
pub fn may_change(owner: Option<&str>, actor: &Viewer, rule: &ChangeRule) -> bool {
    let Some(owner) = owner.filter(|o| !o.is_empty()) else {
        return true;
    };
    if owner == actor.staff_id {
        return true;
    }
    match rule {
        ChangeRule::Me => false,
        ChangeRule::MeAndOtherAdmin => actor.is_admin,
        ChangeRule::MeAdminAnd { staff, reception } => {
            actor.is_admin || (*reception && actor.is_reception) || staff.contains(&actor.staff_id)
        }
        ChangeRule::Everyone => true,
    }
}

/// A record rule narrows the area's sight further; it never widens it.
pub fn record_sight(
    owner: Option<&str>,
    viewer: &Viewer,
    area: Sight,
    rule: Option<&RecordRule>,
) -> Sight {
    if owner.is_some_and(|o| o == viewer.staff_id) {
        return Sight::Full;
    }
    match rule {
        None => area,
        Some(RecordRule::Private) => Sight::Hidden,
        Some(RecordRule::HiddenFrom { staff }) if staff.contains(&viewer.staff_id) => Sight::Hidden,
        Some(RecordRule::HiddenFrom { .. }) => area,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn viewer(id: &str, admin: bool, reception: bool) -> Viewer {
        Viewer {
            staff_id: id.into(),
            is_admin: admin,
            is_reception: reception,
        }
    }

    #[test]
    fn defaults_share_everything_and_protect_clinical_edits() {
        let dr_b = viewer("b", true, false);
        let desk = viewer("r", false, true);
        for area in ShareArea::ALL {
            assert_eq!(sight(Some("a"), &desk, &default_view(area)), Sight::Full);
        }
        assert!(!may_change(
            Some("a"),
            &dr_b,
            &default_change(ShareArea::Clinical)
        ));
        assert!(may_change(
            Some("a"),
            &desk,
            &default_change(ShareArea::Calendar)
        ));
        assert!(!may_change(
            Some("a"),
            &desk,
            &default_change(ShareArea::Payments)
        ));
        assert!(may_change(
            Some("a"),
            &dr_b,
            &default_change(ShareArea::Payments)
        ));
    }

    #[test]
    fn view_rules_narrow_per_viewer() {
        let dr_b = viewer("b", true, false);
        let desk = viewer("r", false, true);
        let nurse = viewer("n", false, false);
        let chosen = ViewRule::Chosen {
            staff: vec!["n".into()],
        };
        assert_eq!(
            sight(Some("a"), &desk, &ViewRule::OtherAdmin),
            Sight::Hidden
        );
        assert_eq!(sight(Some("a"), &dr_b, &ViewRule::OtherAdmin), Sight::Full);
        assert_eq!(sight(Some("a"), &nurse, &chosen), Sight::Full);
        assert_eq!(sight(Some("a"), &desk, &chosen), Sight::Hidden);
        assert_eq!(sight(Some("a"), &dr_b, &ViewRule::Nobody), Sight::Hidden);
        assert_eq!(
            sight(Some("a"), &viewer("a", true, false), &ViewRule::Nobody),
            Sight::Full
        );
        assert_eq!(
            sight(None, &desk, &ViewRule::Nobody),
            Sight::Full,
            "practice data"
        );
    }

    #[test]
    fn record_rules_only_narrow() {
        let desk = viewer("r", false, true);
        let hidden = RecordRule::HiddenFrom {
            staff: vec!["r".into()],
        };
        assert_eq!(
            record_sight(Some("a"), &desk, Sight::Full, Some(&RecordRule::Private)),
            Sight::Hidden
        );
        assert_eq!(
            record_sight(Some("a"), &desk, Sight::Full, Some(&hidden)),
            Sight::Hidden
        );
        assert_eq!(
            record_sight(Some("a"), &viewer("x", false, false), Sight::Full, Some(&hidden)),
            Sight::Full,
            "hidden from someone else only"
        );
        assert_eq!(
            record_sight(
                Some("a"),
                &viewer("a", true, false),
                Sight::Hidden,
                Some(&RecordRule::Private)
            ),
            Sight::Full
        );
    }

    #[test]
    fn rules_round_trip_as_json() {
        let r = ChangeRule::MeAdminAnd {
            staff: vec!["n".into()],
            reception: true,
        };
        let back: ChangeRule = serde_json::from_str(&serde_json::to_string(&r).unwrap()).unwrap();
        assert_eq!(back, r);
        let v: ViewRule = serde_json::from_str(r#"{"kind":"other_admin"}"#).unwrap();
        assert_eq!(v, ViewRule::OtherAdmin);
        // "Busy only" was removed before release: such a rule no longer parses.
        assert!(serde_json::from_str::<ViewRule>(r#"{"kind":"busy_only"}"#).is_err());
    }
}
