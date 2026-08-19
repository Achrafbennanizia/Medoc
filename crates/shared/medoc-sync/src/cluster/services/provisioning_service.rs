//! One-time provisioning of settings, parameters, and wrapped secrets.

use medoc_core::error::AppError;
use sqlx::SqlitePool;

use crate::cluster::ports::{is_provisioned, mark_provisioned, provisioning_counter};
use crate::cluster::services::staff_directory::import_staff_directory_json;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProvisioningSettings {
    #[serde(default)]
    staff_directory_json: Option<String>,
}

async fn apply_provisioning_settings(pool: &SqlitePool, settings_json: &str) -> Result<(), AppError> {
    if settings_json.trim().is_empty() || settings_json.trim() == "{}" {
        return Ok(());
    }
    let settings: ProvisioningSettings = serde_json::from_str(settings_json)
        .map_err(|e| AppError::Validation(format!("Provisioning-Settings: {e}")))?;
    if let Some(staff_json) = settings.staff_directory_json.filter(|s| !s.trim().is_empty()) {
        import_staff_directory_json(pool, &staff_json).await?;
    }
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProvisionResult {
    pub success: bool,
    pub already_provisioned: bool,
    pub settings_json: String,
    pub seat_certificate: String,
    pub wrapped_secrets: Vec<u8>,
}

pub async fn is_local_provisioned(pool: &SqlitePool, fingerprint: &str) -> Result<bool, AppError> {
    is_provisioned(pool, fingerprint).await
}

/// Apply provisioning payload once per device fingerprint.
pub async fn apply_provisioning(
    pool: &SqlitePool,
    fingerprint: &str,
    seat_certificate: String,
    settings_json: String,
    wrapped_secrets: Vec<u8>,
) -> Result<ProvisionResult, AppError> {
    if is_provisioned(pool, fingerprint).await? {
        return Ok(ProvisionResult {
            success: false,
            already_provisioned: true,
            settings_json: String::new(),
            seat_certificate: String::new(),
            wrapped_secrets: Vec::new(),
        });
    }
    mark_provisioned(pool, fingerprint).await?;
    apply_provisioning_settings(pool, &settings_json).await?;
    Ok(ProvisionResult {
        success: true,
        already_provisioned: false,
        settings_json,
        seat_certificate,
        wrapped_secrets,
    })
}

pub async fn get_provisioning_counter(
    pool: &SqlitePool,
    fingerprint: &str,
) -> Result<i64, AppError> {
    provisioning_counter(pool, fingerprint).await
}
