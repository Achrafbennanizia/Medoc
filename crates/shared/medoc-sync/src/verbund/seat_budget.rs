//! Seat budgets derived from vendor license edition (Systementwurf §8.1).

/// Device seat caps for a cluster license tier.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SeatBudget {
    pub max_total: u32,
    pub max_admin: u32,
    pub max_member: u32,
}

/// Map Abo-Stufe → seat caps. Enterprise uses the spec default (10 / 3 / 7); Basis and
/// Professional follow FA-LIC-02 device budgets from `systementwurf.md` §8.1.
pub fn seat_budget_from_edition(edition: &str) -> SeatBudget {
    let e = edition.trim().to_uppercase();
    match e.as_str() {
        "BASIC" | "BASIS" => SeatBudget {
            max_total: 2,
            max_admin: 1,
            max_member: 1,
        },
        "PRO" | "PROFESSIONAL" => SeatBudget {
            max_total: 5,
            max_admin: 2,
            max_member: 3,
        },
        "ENTERPRISE" => SeatBudget {
            max_total: 10,
            max_admin: 3,
            max_member: 7,
        },
        _ => SeatBudget {
            max_total: 2,
            max_admin: 1,
            max_member: 1,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn basis_caps() {
        let b = seat_budget_from_edition("BASIS");
        assert_eq!(b.max_total, 2);
        assert_eq!(b.max_admin, 1);
    }

    #[test]
    fn pro_caps() {
        let b = seat_budget_from_edition("PRO");
        assert_eq!(b.max_total, 5);
    }

    #[test]
    fn enterprise_default_caps() {
        let b = seat_budget_from_edition("ENTERPRISE");
        assert_eq!(b.max_total, 10);
        assert_eq!(b.max_admin, 3);
        assert_eq!(b.max_member, 7);
    }
}
