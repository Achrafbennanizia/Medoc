//! Device flavor (main app or replica app, chosen at build time) and where each main-only
//! operation runs. See docs/architecture/device-flavors-and-access.md.
//!
//! One registry replaces the scattered "is this the main device?" checks: a main-only
//! operation runs **locally** only in the main app on the main device, and is **forwarded**
//! to the main device's API everywhere else.

use serde::Serialize;

/// Which app this binary is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum DeviceFlavor {
    /// Hosts the practice: holds the licence, accepts devices, manages access.
    Main,
    /// Joins a practice: works on a synced copy, forwards main-only operations.
    Replica,
}

/// Fixed when the binary is compiled (Cargo feature `replica`).
#[cfg(not(feature = "replica"))]
pub const FLAVOR: DeviceFlavor = DeviceFlavor::Main;
#[cfg(feature = "replica")]
pub const FLAVOR: DeviceFlavor = DeviceFlavor::Replica;

impl DeviceFlavor {
    pub fn wire(self) -> &'static str {
        match self {
            DeviceFlavor::Main => "main",
            DeviceFlavor::Replica => "replica",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "main" => Some(DeviceFlavor::Main),
            "replica" => Some(DeviceFlavor::Replica),
            _ => None,
        }
    }
}

/// The replica app joins a practice but never creates or owns one.
pub fn require_can_host() -> Result<(), crate::error::AppError> {
    match FLAVOR {
        DeviceFlavor::Main => Ok(()),
        DeviceFlavor::Replica => Err(crate::error::AppError::validation_code(
            "error.device.replica_cannot_host",
        )),
    }
}

/// Operations only the main device performs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MainOnly {
    /// Read and change roles and privileges of staff accounts.
    ManageAccess,
    /// Activate the licence and create the practice network.
    ActivateLicense,
    /// Accept, block and remove devices.
    ManageDevices,
}

impl MainOnly {
    pub const ALL: [MainOnly; 3] = [
        MainOnly::ManageAccess,
        MainOnly::ActivateLicense,
        MainOnly::ManageDevices,
    ];

    pub fn wire(self) -> &'static str {
        match self {
            MainOnly::ManageAccess => "manage_access",
            MainOnly::ActivateLicense => "activate_license",
            MainOnly::ManageDevices => "manage_devices",
        }
    }

    /// Whether a replica can reach it through the main device's API.
    /// Licence and device management are about the main device itself, so they stay there.
    pub fn forwardable(self) -> bool {
        matches!(self, MainOnly::ManageAccess)
    }
}

/// Where an operation runs on this device.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Placement {
    Local,
    /// Sent to the main device for the signed-in person.
    MainDevice,
    /// Not possible from this device.
    Unavailable,
}

/// `is_main_device`: the run-time role from the deployment settings. The main app can still run
/// as a replica (installations from before flavors); the replica app never runs as main.
pub fn placement(op: MainOnly, flavor: DeviceFlavor, is_main_device: bool) -> Placement {
    let local = flavor == DeviceFlavor::Main && is_main_device;
    match (local, op.forwardable()) {
        (true, _) => Placement::Local,
        (false, true) => Placement::MainDevice,
        (false, false) => Placement::Unavailable,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn main_app_on_main_device_runs_everything_locally() {
        for op in MainOnly::ALL {
            assert_eq!(placement(op, DeviceFlavor::Main, true), Placement::Local);
        }
    }

    #[test]
    fn replica_app_forwards_access_management_and_never_hosts() {
        assert_eq!(
            placement(MainOnly::ManageAccess, DeviceFlavor::Replica, true),
            Placement::MainDevice
        );
        assert_eq!(
            placement(MainOnly::ActivateLicense, DeviceFlavor::Replica, false),
            Placement::Unavailable
        );
        assert_eq!(
            placement(MainOnly::ManageDevices, DeviceFlavor::Replica, false),
            Placement::Unavailable
        );
    }

    #[test]
    fn main_app_configured_as_replica_behaves_like_a_replica() {
        assert_eq!(
            placement(MainOnly::ManageAccess, DeviceFlavor::Main, false),
            Placement::MainDevice
        );
        assert_eq!(
            placement(MainOnly::ManageDevices, DeviceFlavor::Main, false),
            Placement::Unavailable
        );
    }

    #[test]
    fn flavor_wire_round_trips() {
        for f in [DeviceFlavor::Main, DeviceFlavor::Replica] {
            assert_eq!(DeviceFlavor::parse(f.wire()), Some(f));
        }
    }
}
