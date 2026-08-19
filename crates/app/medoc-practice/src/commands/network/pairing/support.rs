//! Shared helpers for pairing IPC commands.

use std::time::Duration;

use medoc_core::error::AppError;
use medoc_sync::deployment::{DeploymentMode, DeviceRole, APP_KV_DEVICE_ID_KEY};
use medoc_sync::engine::SyncEngine;
use sqlx::SqlitePool;

use crate::error::AppError as TauriAppError;

pub(crate) async fn require_master_license_cmd(pool: &SqlitePool) -> Result<(), AppError> {
    if std::env::var("MEDOC_SKIP_MASTER_LICENSE")
        .ok()
        .is_some_and(|version| version == "1" || version.eq_ignore_ascii_case("true"))
    {
        return Ok(());
    }
    let snap = SyncEngine::status(pool).await?;
    if snap.deployment.mode == DeploymentMode::ServerlessPeer
        && snap.deployment.role == DeviceRole::Replica
    {
        return Ok(());
    }
    let status = medoc_core::infrastructure::license_repo::current_status(pool).await?;
    if status.valid {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

pub(crate) async fn master_local_device_id(pool: &SqlitePool) -> Result<String, AppError> {
    let id =
        medoc_core::infrastructure::database::app_kv_repo::get(pool, APP_KV_DEVICE_ID_KEY).await?;
    Ok(id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "master-local".into()))
}

pub(crate) async fn ensure_local_device_id(pool: &SqlitePool) -> Result<String, AppError> {
    medoc_sync::repo::ensure_local_device(pool, "").await
}

pub(crate) fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .build()
        .expect("reqwest client")
}

pub(crate) fn into_tauri(e: AppError) -> TauriAppError {
    e
}
