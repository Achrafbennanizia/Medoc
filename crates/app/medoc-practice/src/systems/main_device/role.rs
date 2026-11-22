//! Is this device the main device, and where does a main-only operation run here?

use serde::Serialize;
use sqlx::SqlitePool;

use medoc_core::domain::device::{placement, DeviceFlavor, MainOnly, Placement, FLAVOR};
use medoc_sync::deployment::DeviceRole;

/// Main device by the deployment settings. The replica app is never the main device;
/// an unreadable setting counts as main for the main app (single-device practice).
pub async fn is_main_device(pool: &SqlitePool) -> bool {
    if FLAVOR == DeviceFlavor::Replica {
        return false;
    }
    match medoc_sync::repo::load_deployment(pool).await {
        Ok(d) => d.role == DeviceRole::Master,
        Err(_) => true,
    }
}

pub async fn placement_of(pool: &SqlitePool, op: MainOnly) -> Placement {
    placement(op, FLAVOR, is_main_device(pool).await)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    /// Build flavor: "main" or "replica".
    pub flavor: &'static str,
    pub is_main_device: bool,
    /// Main-only operation → "local" | "main_device" | "unavailable".
    pub placements: Vec<(MainOnly, Placement)>,
    pub main_link: super::LinkStatus,
}

pub async fn device_info(pool: &SqlitePool) -> DeviceInfo {
    let main = is_main_device(pool).await;
    DeviceInfo {
        flavor: FLAVOR.wire(),
        is_main_device: main,
        placements: MainOnly::ALL
            .into_iter()
            .map(|op| (op, placement(op, FLAVOR, main)))
            .collect(),
        main_link: super::link_status(),
    }
}
