//! Bluetooth LE discovery for pairing (replica central/scan mode).

use std::collections::HashSet;
use std::time::Duration;

use btleplug::api::{Central, Manager as _, Peripheral as _, ScanFilter};
use btleplug::platform::Manager;
use medoc_core::discovery::{
    beacon_base_url, beacon_host, parse_beacon_from_ble_local_name, parse_beacon_line,
    MEDOC_BLE_SERVICE_UUID, SCHEMA,
};
use medoc_core::error::AppError;

use super::discovery_lan::discovered_from_beacon;
use super::types::{DiscoveredMaster, PairingScanPayload};
use crate::error::AppError as TauriAppError;

use super::support::into_tauri;

#[tauri::command]
#[tracing::instrument(level = "info")]
pub async fn pairing_scan_bluetooth(
    payload: PairingScanPayload,
) -> Result<Vec<DiscoveredMaster>, TauriAppError> {
    scan_bluetooth_masters(payload.seconds)
        .await
        .map_err(into_tauri)
}

pub async fn scan_bluetooth_masters(seconds: u64) -> Result<Vec<DiscoveredMaster>, AppError> {
    let manager = Manager::new()
        .await
        .map_err(|e| AppError::Internal(format!("Bluetooth unavailable: {e}")))?;
    let adapters = manager
        .adapters()
        .await
        .map_err(|e| AppError::Internal(format!("Bluetooth adapter: {e}")))?;
    let central = adapters
        .into_iter()
        .next()
        .ok_or_else(|| AppError::Validation("No Bluetooth adapter found".into()))?;

    central
        .start_scan(ScanFilter::default())
        .await
        .map_err(|e| AppError::Internal(format!("Failed to start BLE scan: {e}")))?;

    tokio::time::sleep(Duration::from_millis((seconds * 1000).max(500))).await;

    let peripherals = central
        .peripherals()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to read BLE devices: {e}")))?;

    let _ = central.stop_scan().await;

    let mut out = Vec::new();
    let mut seen = HashSet::new();

    for peripheral in peripherals {
        let props = peripheral
            .properties()
            .await
            .map_err(|e| AppError::Internal(format!("BLE properties: {e}")))?;
        let Some(props) = props else { continue };

        let Some(payload) = props
            .service_data
            .get(&MEDOC_BLE_SERVICE_UUID)
            .and_then(|bytes| parse_beacon_line(bytes))
            .or_else(|| {
                props
                    .local_name
                    .as_deref()
                    .and_then(parse_beacon_from_ble_local_name)
            })
        else {
            continue;
        };
        if payload.schema != SCHEMA {
            continue;
        }
        if !seen.insert(payload.instance_id.clone()) {
            continue;
        }

        let host = beacon_host(&payload, "127.0.0.1");
        let mut hit = discovered_from_beacon(&payload, host, "ble-");
        hit.label = format!("{} (Bluetooth)", payload.label);
        hit.base_url = beacon_base_url(&payload, &hit.host);
        out.push(hit);
    }

    Ok(out)
}
