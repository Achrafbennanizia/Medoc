//! Stand-in for `net` in builds without the practice network (feature `net` off: Solo).
//!
//! Same names as the parts of `net` the cluster services call. Discovery finds nobody, a reset
//! has nobody to notify, and anything that must reach another device fails with
//! `error.device.no_network`, so no mDNS, Noise or TCP listener code is compiled in.

use std::time::Duration;

use medoc_core::error::AppError;

use crate::cluster::crypto::DeviceIdentity;
pub use crate::net_types::{AdminEndpoint, SasConfirmOutcome, DEFAULT_CLUSTER_PORT};

fn no_network() -> AppError {
    AppError::validation_code("error.device.no_network")
}

pub fn scan_admins(_timeout: Duration) -> Result<Vec<AdminEndpoint>, AppError> {
    Ok(Vec::new())
}

pub async fn confirm_sas_on_admin(
    _host: &str,
    _port: u16,
    _identity: &DeviceIdentity,
    _session_id: &str,
    _digits: &str,
) -> Result<SasConfirmOutcome, AppError> {
    Err(no_network())
}

pub async fn fetch_replica_auth(
    _host: &str,
    _port: u16,
    _identity: &DeviceIdentity,
    _fingerprint: &str,
    _session_id: &str,
) -> Result<SasConfirmOutcome, AppError> {
    Err(no_network())
}

pub async fn fetch_staff_directory(
    _host: &str,
    _port: u16,
    _identity: &DeviceIdentity,
    _session_id: &str,
) -> Result<String, AppError> {
    Err(no_network())
}

pub mod reset_broadcast {
    pub use crate::net_types::{MemberResetTarget, ResetBroadcastResult};

    /// No member devices without a practice network.
    pub async fn broadcast_cluster_reset(
        _targets: &[MemberResetTarget],
        _token_json: &str,
        _signature_b64: &str,
    ) -> ResetBroadcastResult {
        ResetBroadcastResult::default()
    }
}
