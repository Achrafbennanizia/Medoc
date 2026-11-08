//! Status columns: parse, emit, and allowed transitions.

use crate::error::AppError;

macro_rules! status_enum {
    ($name:ident, [ $($var:ident => $lit:literal),+ $(,)? ]) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq)]
        pub enum $name {
            $($var),+
        }

        impl $name {
            pub fn as_str(self) -> &'static str {
                match self {
                    $(Self::$var => $lit),+
                }
            }

            pub fn parse(raw: &str) -> Result<Self, AppError> {
                let u = raw.trim().to_ascii_uppercase();
                match u.as_str() {
                    $($lit => Ok(Self::$var),)+
                    other => {
                        tracing::warn!(
                            target: "medoc::system",
                            event = "UNKNOWN_STATUS",
                            enum_name = stringify!($name),
                            value = other,
                        );
                        Err(AppError::Validation(format!(
                            "Invalid status: {other}"
                        )))
                    }
                }
            }
        }
    };
}

status_enum!(PatientStatus, [
    New => "NEW",
    Active => "ACTIVE",
    Validated => "VALIDATED",
    Readonly => "READONLY",
    Archived => "ARCHIVED",
]);

status_enum!(ChartStatus, [
    Draft => "DRAFT",
    InProgress => "IN_PROGRESS",
    Validated => "VALIDATED",
    Readonly => "READONLY",
    Declined => "DECLINED",
]);

status_enum!(AppointmentStatus, [
    Planned => "PLANNED",
    Confirmed => "CONFIRMED",
    InProgress => "IN_PROGRESS",
    Completed => "COMPLETED",
    Cancelled => "CANCELLED",
    NoShow => "NO_SHOW",
]);

status_enum!(PaymentStatus, [
    Outstanding => "OUTSTANDING",
    PartiallyPaid => "PARTIALLY_PAID",
    Paid => "PAID",
    Cancelled => "CANCELLED",
]);

fn deny(from: &str, to: &str) -> AppError {
    AppError::Validation(format!("Invalid status transition: {from} → {to}"))
}

impl PatientStatus {
    pub fn can_transition_to(self, next: Self) -> bool {
        if self == next {
            return true;
        }
        if next == Self::Archived {
            return true;
        }
        if self == Self::Archived {
            return next == Self::Active;
        }
        // FA-PAT-03: NEW -> ACTIVE -> VALIDATED -> READONLY, forward only.
        fn rank(s: PatientStatus) -> u8 {
            match s {
                PatientStatus::New => 0,
                PatientStatus::Active => 1,
                PatientStatus::Validated => 2,
                PatientStatus::Readonly => 3,
                PatientStatus::Archived => 4,
            }
        }
        rank(next) >= rank(self)
    }

    pub fn require_transition(from: &str, to: &str) -> Result<(Self, Self), AppError> {
        let a = Self::parse(from)?;
        let b = Self::parse(to)?;
        if a.can_transition_to(b) {
            Ok((a, b))
        } else {
            Err(deny(from, to))
        }
    }
}

impl ChartStatus {
    pub fn can_transition_to(self, next: Self) -> bool {
        if self == next {
            return true;
        }
        if next == Self::Declined {
            return true;
        }
        if self == Self::Declined {
            return matches!(next, Self::Draft | Self::InProgress);
        }
        true
    }

    pub fn require_transition(from: &str, to: &str) -> Result<(Self, Self), AppError> {
        let a = Self::parse(from)?;
        let b = Self::parse(to)?;
        if a.can_transition_to(b) {
            Ok((a, b))
        } else {
            Err(deny(from, to))
        }
    }
}

impl AppointmentStatus {
    pub fn can_transition_to(self, next: Self) -> bool {
        use AppointmentStatus::*;
        matches!(
            (self, next),
            (Planned, Confirmed)
                | (Confirmed, InProgress)
                | (InProgress, Completed)
                | (Planned, Completed)
                | (Confirmed, Completed)
                | (Planned, Cancelled)
                | (Planned, NoShow)
                | (Confirmed, Cancelled)
                | (Confirmed, NoShow)
                | (Cancelled, Planned)
                | (NoShow, Planned)
        ) || self == next
    }

    pub fn require_transition(from: &str, to: &str) -> Result<(Self, Self), AppError> {
        let a = Self::parse(from)?;
        let b = Self::parse(to)?;
        if a.can_transition_to(b) {
            Ok((a, b))
        } else {
            Err(deny(from, to))
        }
    }
}

impl PaymentStatus {
    pub fn can_transition_to(self, next: Self) -> bool {
        use PaymentStatus::*;
        matches!(
            (self, next),
            (Outstanding, PartiallyPaid)
                | (Outstanding, Paid)
                | (Outstanding, Cancelled)
                | (PartiallyPaid, Paid)
                | (PartiallyPaid, Cancelled)
        ) || self == next
    }

    pub fn require_transition(from: &str, to: &str) -> Result<(Self, Self), AppError> {
        let a = Self::parse(from)?;
        let b = Self::parse(to)?;
        if a.can_transition_to(b) {
            Ok((a, b))
        } else {
            Err(deny(from, to))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn patient_status_rejects_unknown_value() {
        assert!(PatientStatus::parse("NOPE").is_err());
        assert_eq!(PatientStatus::parse("archived").unwrap().as_str(), "ARCHIVED");
    }

    #[test]
    fn patient_status_rejects_invalid_transition() {
        assert!(PatientStatus::require_transition("ARCHIVED", "NEW").is_err());
        assert!(PatientStatus::require_transition("ACTIVE", "ARCHIVED").is_ok());
        assert!(PatientStatus::require_transition("ARCHIVED", "ACTIVE").is_ok());
    }

    #[test]
    fn chart_status_rejects_unknown_value() {
        assert!(ChartStatus::parse("GONE").is_err());
        assert_eq!(ChartStatus::parse("DECLINED").unwrap().as_str(), "DECLINED");
    }

    #[test]
    fn chart_status_rejects_invalid_transition() {
        assert!(ChartStatus::require_transition("DECLINED", "VALIDATED").is_err());
        assert!(ChartStatus::require_transition("DRAFT", "DECLINED").is_ok());
        assert!(ChartStatus::require_transition("DECLINED", "DRAFT").is_ok());
    }

    #[test]
    fn appointment_status_rejects_unknown_value() {
        assert!(AppointmentStatus::parse("ACTIVE").is_err());
    }

    #[test]
    fn appointment_status_rejects_invalid_transition() {
        assert!(AppointmentStatus::require_transition("COMPLETED", "PLANNED").is_err());
        assert!(AppointmentStatus::require_transition("PLANNED", "CONFIRMED").is_ok());
        assert!(AppointmentStatus::require_transition("CANCELLED", "PLANNED").is_ok());
    }

    #[test]
    fn payment_status_rejects_unknown_value() {
        assert!(PaymentStatus::parse("OPEN").is_err());
    }

    #[test]
    fn payment_status_rejects_invalid_transition() {
        assert!(PaymentStatus::require_transition("PAID", "OUTSTANDING").is_err());
        assert!(PaymentStatus::require_transition("OUTSTANDING", "PAID").is_ok());
        assert!(PaymentStatus::require_transition("CANCELLED", "PAID").is_err());
    }
}
