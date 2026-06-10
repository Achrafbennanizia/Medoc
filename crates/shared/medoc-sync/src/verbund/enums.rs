//! Geräteverbund domain enums — orthogonal to application RBAC.

use serde::{Deserialize, Serialize};

/// Seat role: what this *device* may do in the cluster (not app RBAC).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SeatRolle {
    Admin,
    Member,
}

impl SeatRolle {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Admin => "ADMIN",
            Self::Member => "MEMBER",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_uppercase().as_str() {
            "ADMIN" => Some(Self::Admin),
            "MEMBER" => Some(Self::Member),
            _ => None,
        }
    }
}

/// Registry status for a cluster device.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum GeraetStatus {
    Pending,
    Active,
    Revoked,
    Blocked,
}

impl GeraetStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Pending => "PENDING",
            Self::Active => "ACTIVE",
            Self::Revoked => "REVOKED",
            Self::Blocked => "BLOCKED",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_uppercase().as_str() {
            "PENDING" => Some(Self::Pending),
            "ACTIVE" => Some(Self::Active),
            "REVOKED" => Some(Self::Revoked),
            "BLOCKED" => Some(Self::Blocked),
            _ => None,
        }
    }

    pub fn counts_toward_seat_cap(self) -> bool {
        matches!(self, Self::Pending | Self::Active)
    }
}

/// Pairing / kopplung session lifecycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum KopplungStatus {
    Discovered,
    JoinRequested,
    AwaitingSas,
    SasConfirmed,
    Provisioned,
    Rejected,
    Expired,
    Aborted,
}

impl KopplungStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Discovered => "DISCOVERED",
            Self::JoinRequested => "JOIN_REQUESTED",
            Self::AwaitingSas => "AWAITING_SAS",
            Self::SasConfirmed => "SAS_CONFIRMED",
            Self::Provisioned => "PROVISIONED",
            Self::Rejected => "REJECTED",
            Self::Expired => "EXPIRED",
            Self::Aborted => "ABORTED",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s.trim().to_ascii_uppercase().as_str() {
            "DISCOVERED" => Some(Self::Discovered),
            "JOIN_REQUESTED" => Some(Self::JoinRequested),
            "AWAITING_SAS" => Some(Self::AwaitingSas),
            "SAS_CONFIRMED" => Some(Self::SasConfirmed),
            "PROVISIONED" => Some(Self::Provisioned),
            "REJECTED" => Some(Self::Rejected),
            "EXPIRED" => Some(Self::Expired),
            "ABORTED" => Some(Self::Aborted),
            _ => None,
        }
    }

    /// Valid transitions for the kopplung state machine.
    pub fn can_transition_to(self, next: Self) -> bool {
        use KopplungStatus::*;
        matches!(
            (self, next),
            (Discovered, JoinRequested)
                | (JoinRequested, AwaitingSas)
                | (JoinRequested, Rejected)
                | (AwaitingSas, SasConfirmed)
                | (AwaitingSas, Aborted)
                | (AwaitingSas, Expired)
                | (SasConfirmed, Provisioned)
                | (SasConfirmed, Aborted)
        )
    }
}
