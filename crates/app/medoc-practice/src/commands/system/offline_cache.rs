//! Crash-safe cache file for the LAN client's offline queue (`offline-write-queue.ts`).
//!
//! In LAN client mode there is no local database: changes that could not reach the main device
//! wait in an encrypted file (`durable_cache`) so a crash or a hard power-off does not lose them.
//! The client deletes the file once every queued change was answered with 2xx.

use crate::error::AppError;
use crate::infrastructure::durable_cache;

/// The only queues the UI may touch; sync's own files stay out of reach.
const ALLOWED: &[&str] = &["lan-offline-writes"];

fn allowed(name: &str) -> Result<&str, AppError> {
    ALLOWED
        .iter()
        .find(|n| **n == name)
        .copied()
        .ok_or_else(|| AppError::Validation(format!("offline cache not allowed: {name}")))
}

#[tauri::command]
pub async fn offline_cache_read(name: String) -> Result<Option<serde_json::Value>, AppError> {
    if !durable_cache::enabled() {
        return Ok(None);
    }
    durable_cache::read(allowed(&name)?)
}

/// Returns once the content is on disk (`fsync` + atomic rename).
#[tauri::command]
pub async fn offline_cache_write(name: String, value: serde_json::Value) -> Result<(), AppError> {
    durable_cache::write(allowed(&name)?, &value)
}

#[tauri::command]
pub async fn offline_cache_clear(name: String) -> Result<(), AppError> {
    if !durable_cache::enabled() {
        return Ok(());
    }
    durable_cache::clear(allowed(&name)?)
}
