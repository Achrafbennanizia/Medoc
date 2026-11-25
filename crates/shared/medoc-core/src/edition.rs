//! Product editions and capabilities (generated from `config/editions.yaml`).
//! See docs/architecture/editions-plan.md §3.
//!
//! The edition itself is chosen in `medoc-practice` (`edition-*` features), which turns on this
//! crate's `cap-*` features; [`CORE_CAPS`] reports what this crate was compiled with.

use serde::Serialize;

/// Sizing limits of an edition.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Limits {
    /// Hard device limit (licence seats).
    pub devices: u32,
    pub admins: u32,
    /// Active staff accounts.
    pub staff_active: u32,
    pub doctors: u32,
}

/// One edition: id, capabilities, limits.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditionSpec {
    pub id: &'static str,
    pub caps: Caps,
    pub limits: Limits,
}

include!(concat!(env!("OUT_DIR"), "/edition_generated.rs"));

#[cfg(all(feature = "cap-guest-inbox", feature = "cap-multi-staff"))]
compile_error!("cap-guest-inbox and cap-multi-staff are exclusive (config/editions.yaml)");

/// The edition whose capabilities equal `caps`, if any.
pub fn edition_of(caps: &Caps) -> Option<&'static EditionSpec> {
    ALL_EDITIONS.iter().find(|e| e.caps.same_as(caps))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edition_ids_are_unique_and_known() {
        let ids: Vec<&str> = ALL_EDITIONS.iter().map(|e| e.id).collect();
        assert_eq!(ids, ["solo", "duo", "group"]);
        for e in ALL_EDITIONS {
            assert_eq!(edition_of(&e.caps).map(|f| f.id), Some(e.id));
        }
    }

    #[test]
    fn solo_has_no_network_and_group_has_everything_but_guest() {
        assert_eq!((SOLO.caps.net, SOLO.caps.guest_inbox), (false, true));
        assert_eq!((DUO.caps.net, DUO.caps.multi_doctor), (true, false));
        assert_eq!(GROUP.caps.enabled().len(), ALL_CAPABILITIES.len() - 1);
        assert!(!GROUP.caps.enabled().contains(&"guest_inbox"));
        assert_eq!(
            (
                SOLO.limits.devices,
                DUO.limits.devices,
                GROUP.limits.devices
            ),
            (1, 3, 5)
        );
    }
}
