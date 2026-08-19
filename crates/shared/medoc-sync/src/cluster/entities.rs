//! Device-cluster value objects and aggregates.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

use super::enums::{DeviceStatus, PairingStatus, SeatRole};
use medoc_core::error::AppError;

/// Cluster license record (one per practice cluster).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct License {
    pub cluster_id: String,
    pub license_ref: String,
    pub signing_key_enc: Vec<u8>,
    pub max_total: u32,
    pub max_admin: u32,
    pub max_member: u32,
    pub activated_at: DateTime<Utc>,
}

/// Device in the cluster registry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Device {
    pub fingerprint: String,
    pub cluster_id: String,
    pub device_id: String,
    pub pubkey: Vec<u8>,
    pub hostname: Option<String>,
    pub os: Option<String>,
    pub last_ip: Option<String>,
    pub seat_role: SeatRole,
    pub status: DeviceStatus,
    pub seat_cert: Option<Vec<u8>>,
    pub last_seen: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Seat certificate payload (signed by cluster CA).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeatCertificate {
    pub cluster_id: String,
    pub device_pubkey: Vec<u8>,
    pub seat_id: String,
    pub seat_role: SeatRole,
    pub issued_at: DateTime<Utc>,
    pub license_ref: String,
}

/// Active pairing session.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingSession {
    pub id: String,
    pub fingerprint: String,
    pub state: PairingStatus,
    pub sas_hash: Option<Vec<u8>>,
    pub requested_role: SeatRole,
    pub hostname: Option<String>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// Seat usage snapshot for UI meter.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeatUsage {
    pub admin_used: u32,
    pub member_used: u32,
    pub total_used: u32,
    pub max_admin: u32,
    pub max_member: u32,
    pub max_total: u32,
}

/// Cluster aggregate — enforces tier-derived seat caps from `license`.
#[derive(Debug, Clone)]
pub struct Cluster {
    pub cluster_id: String,
    pub max_total: u32,
    pub max_admin: u32,
    pub max_member: u32,
    pub usage: SeatUsage,
}

impl Cluster {
    pub fn from_license(license: &License, usage: SeatUsage) -> Self {
        Self {
            cluster_id: license.cluster_id.clone(),
            max_total: license.max_total,
            max_admin: license.max_admin,
            max_member: license.max_member,
            usage,
        }
    }

    /// Returns Ok(()) if a seat of `role` can be reserved atomically.
    pub fn reserve_seat(&self, role: SeatRole) -> Result<(), AppError> {
        let u = &self.usage;
        if u.total_used >= self.max_total {
            return Err(AppError::Validation(format!(
                "Cluster full: maximum {} devices",
                self.max_total
            )));
        }
        match role {
            SeatRole::Admin if u.admin_used >= self.max_admin => {
                return Err(AppError::Validation(format!(
                    "No ADMIN seat available (max {}). Request again as MEMBER.",
                    self.max_admin
                )));
            }
            SeatRole::Member if u.member_used >= self.max_member => {
                return Err(AppError::Validation(format!(
                    "No MEMBER seat available (max {})",
                    self.max_member
                )));
            }
            _ => {}
        }
        Ok(())
    }
}
