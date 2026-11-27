//! Device seats of a practice: how many computers may join (docs/architecture/editions-plan.md).
//!
//! Devices are not accounts: accounts are capped by `mvp_security::staff_quota_limits`. The
//! numbers come from the product edition (`config/editions.yaml` → `devices`, `admins`).

use medoc_core::edition::{edition_of, EditionSpec, ALL_EDITIONS, CORE_CAPS, SOLO};

/// Device seat caps for a cluster.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SeatBudget {
    /// Computers in the practice, the owner's included.
    pub max_total: u32,
    /// Admin computers (hubs).
    pub max_admin: u32,
    /// Other computers (replicas).
    pub max_member: u32,
}

/// The product edition a licence's `edition` field stands for. Older licences carry
/// BASIC / PRO / ENTERPRISE (Q8: Solo / Duo / Group); unknown values get the smallest edition.
pub fn licence_product_edition(licence_edition: &str) -> &'static EditionSpec {
    let wire = match licence_edition.trim().to_ascii_lowercase().as_str() {
        "basic" | "basis" | "essentiel" => "solo",
        "pro" | "professional" | "cabinet" => "duo",
        "enterprise" | "cabinet+" => "group",
        other => return ALL_EDITIONS.iter().find(|e| e.id == other).unwrap_or(&SOLO),
    };
    ALL_EDITIONS.iter().find(|e| e.id == wire).unwrap_or(&SOLO)
}

/// Seats for a licence. A build of one edition accepts a licence of that edition or a lower one
/// (Q9), so the seats are the smaller of the licence's edition and this build's edition.
pub fn seat_budget_from_edition(licence_edition: &str) -> SeatBudget {
    let licence = licence_product_edition(licence_edition);
    let (mut devices, mut admins) = (licence.limits.devices, licence.limits.admins);
    if let Some(build) = edition_of(&CORE_CAPS) {
        devices = devices.min(build.limits.devices);
        admins = admins.min(build.limits.admins);
    }
    let devices = devices.max(1);
    let admins = admins.clamp(1, devices);
    SeatBudget {
        max_total: devices,
        max_admin: admins,
        max_member: devices - admins,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn old_licence_names_map_to_the_editions() {
        assert_eq!(licence_product_edition("BASIC").id, "solo");
        assert_eq!(licence_product_edition("PRO").id, "duo");
        assert_eq!(licence_product_edition("ENTERPRISE").id, "group");
        assert_eq!(licence_product_edition("duo").id, "duo");
        assert_eq!(licence_product_edition("???").id, "solo");
    }

    #[test]
    fn seats_follow_the_edition_limits() {
        // This crate's own tests run without an edition, so only the licence decides.
        if edition_of(&CORE_CAPS).is_some() {
            return;
        }
        assert_eq!(
            seat_budget_from_edition("BASIC"),
            SeatBudget {
                max_total: 1,
                max_admin: 1,
                max_member: 0
            }
        );
        assert_eq!(
            seat_budget_from_edition("PRO"),
            SeatBudget {
                max_total: 3,
                max_admin: 1,
                max_member: 2
            }
        );
        assert_eq!(
            seat_budget_from_edition("ENTERPRISE"),
            SeatBudget {
                max_total: 5,
                max_admin: 2,
                max_member: 3
            }
        );
    }
}
