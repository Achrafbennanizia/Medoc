//! Apply USB `install_plan` to deployment, locale, and provisioning window state.

use std::path::Path;

use chrono::{Duration, Utc};
use medoc_core::error::AppError;
use medoc_core::infrastructure::database::app_kv_repo;
use medoc_core::infrastructure::install_plan::{
    DiscoverMode, InstallComponent, InstallPlan, InstallRole, InstallTopology,
    PlanActivationMode, ProvisioningWindowState, PendingInstallPlanSidecar,
    APP_KV_INSTALL_PLAN_PENDING, APP_KV_INSTALL_PLAN_PROVISIONING, FLAG_LAN_CLIENT_ONLY,
    FLAG_OPEN_PORTS_WINDOW, FLAG_SCAN_LAN,
};
use medoc_core::infrastructure::license::LicenseV2;
use medoc_core::infrastructure::usb_vault;
use serde_json::Value;
use sqlx::SqlitePool;

use crate::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig, APP_KV_DEPLOYMENT_KEY};
use crate::engine::SyncEngine;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyInstallPlanResult {
    pub applied: bool,
    pub locale: Option<String>,
    pub deployment_mode: Option<String>,
    pub device_role: Option<String>,
    pub provisioning_window_until: Option<String>,
    pub skipped_reason: Option<String>,
}

pub fn plan_to_deployment(plan: &InstallPlan) -> SyncDeploymentConfig {
    let (mode, role) = match plan.role {
        InstallRole::Master => match plan.topology {
            InstallTopology::Colocated => (DeploymentMode::PracticeDesktop, DeviceRole::Master),
            _ => (DeploymentMode::ServerlessPeer, DeviceRole::Master),
        },
        InstallRole::Replica => (DeploymentMode::ServerlessPeer, DeviceRole::Replica),
        InstallRole::ServerHost => (DeploymentMode::PracticeDesktop, DeviceRole::Master),
        InstallRole::LanClient => (DeploymentMode::LanClient, DeviceRole::Replica),
    };

    let mode = if plan.has_flag(FLAG_LAN_CLIENT_ONLY) {
        DeploymentMode::LanClient
    } else {
        mode
    };

    let master_base_url = match plan.discover.mode {
        DiscoverMode::Fixed if !plan.discover.address.is_empty() => {
            format!("https://{}:{}", plan.discover.address, plan.discover.port)
        }
        _ => String::new(),
    };

    SyncDeploymentConfig {
        schema_version: 1,
        mode,
        role,
        master_base_url,
        master_cert_sha256: String::new(),
        master_access_token: String::new(),
        device_label: plan.device_label.clone(),
        activation_token: String::new(),
        master_pubkey: String::new(),
        master_device_id: String::new(),
        pairing_request_id: String::new(),
        unstable_mesh: false,
    }
}

async fn merge_locale(pool: &SqlitePool, locale: &str) -> Result<(), AppError> {
    let mut prefs: Value = match app_kv_repo::get(pool, "practice.preferences.v1").await? {
        Some(raw) => serde_json::from_str(&raw).unwrap_or_else(|_| serde_json::json!({"version": 1})),
        None => serde_json::json!({"version": 1}),
    };
    if let Some(obj) = prefs.as_object_mut() {
        obj.insert("locale".into(), Value::String(locale.to_string()));
    }
    let out = serde_json::to_string(&prefs).map_err(|e| AppError::Internal(e.to_string()))?;
    app_kv_repo::set(pool, "practice.preferences.v1", &out).await
}

fn store_provisioning_window(plan: &InstallPlan) -> Result<Option<String>, AppError> {
    if plan.activation_mode == PlanActivationMode::Manual {
        return Ok(None);
    }
    if !plan.has_flag(FLAG_OPEN_PORTS_WINDOW)
        && !plan.has_flag(FLAG_SCAN_LAN)
        && plan.pairing_code.is_none()
    {
        return Ok(None);
    }
    let minutes = plan.discover.window_minutes.max(1);
    let expires = Utc::now() + Duration::minutes(minutes as i64);
    let state = ProvisioningWindowState {
        expires_at: expires.to_rfc3339(),
        pairing_code: plan.pairing_code.clone(),
        discover: plan.discover.clone(),
        open_ports: plan.has_flag(FLAG_OPEN_PORTS_WINDOW),
        scan_lan: plan.has_flag(FLAG_SCAN_LAN),
    };
    let json = serde_json::to_string(&state).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(Some(json))
}

pub async fn apply_install_plan(
    pool: &SqlitePool,
    plan: &InstallPlan,
) -> Result<ApplyInstallPlanResult, AppError> {
    plan.validate().map_err(AppError::Validation)?;

    if plan.activation_mode == PlanActivationMode::Manual {
        let json = serde_json::to_string(plan).map_err(|e| AppError::Internal(e.to_string()))?;
        app_kv_repo::set(pool, APP_KV_INSTALL_PLAN_PENDING, &json).await?;
        return Ok(ApplyInstallPlanResult {
            applied: false,
            locale: Some(plan.locale.clone()),
            deployment_mode: None,
            device_role: None,
            provisioning_window_until: None,
            skipped_reason: Some("manual activation — plan stored pending".into()),
        });
    }

    let deployment = plan_to_deployment(plan);
    SyncEngine::set_deployment(pool, deployment.clone()).await?;
    merge_locale(pool, &plan.locale).await?;

    let prov_json = store_provisioning_window(plan)?;
    let prov_until = if let Some(json) = prov_json {
        app_kv_repo::set(pool, APP_KV_INSTALL_PLAN_PROVISIONING, &json).await?;
        serde_json::from_str::<ProvisioningWindowState>(&json)
            .ok()
            .map(|s| s.expires_at)
    } else {
        None
    };

    app_kv_repo::delete(pool, APP_KV_INSTALL_PLAN_PENDING).await.ok();

    Ok(ApplyInstallPlanResult {
        applied: true,
        locale: Some(plan.locale.clone()),
        deployment_mode: Some(deployment.mode.as_str().into()),
        device_role: Some(deployment.role.as_str().into()),
        provisioning_window_until: prov_until,
        skipped_reason: None,
    })
}

pub async fn apply_install_plan_from_license_v2(
    pool: &SqlitePool,
    license: &LicenseV2,
) -> Result<Option<ApplyInstallPlanResult>, AppError> {
    let Some(plan) = &license.install_plan else {
        return Ok(None);
    };
    apply_install_plan(pool, plan)
        .await
        .map(Some)
}

pub async fn load_sidecar_plan(path: &Path) -> Result<Option<InstallPlan>, AppError> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = std::fs::read_to_string(path)
        .map_err(|e| AppError::Internal(format!("read sidecar: {e}")))?;
    let sidecar: PendingInstallPlanSidecar = serde_json::from_str(&raw)
        .map_err(|e| AppError::Validation(format!("sidecar json: {e}")))?;
    sidecar.plan.validate().map_err(AppError::Validation)?;
    Ok(Some(sidecar.plan))
}

pub async fn consume_pending_sidecar_and_apply(
    pool: &SqlitePool,
    sidecar_path: &Path,
) -> Result<Option<ApplyInstallPlanResult>, AppError> {
    let Some(plan) = load_sidecar_plan(sidecar_path).await? else {
        return Ok(None);
    };
    let result = apply_install_plan(pool, &plan).await?;
    std::fs::remove_file(sidecar_path)
        .map_err(|e| AppError::Internal(format!("remove sidecar: {e}")))?;
    Ok(Some(result))
}

pub async fn consume_default_sidecar_and_apply(
    pool: &SqlitePool,
) -> Result<Option<ApplyInstallPlanResult>, AppError> {
    let path = usb_vault::default_sidecar_path();
    consume_pending_sidecar_and_apply(pool, &path).await
}

pub async fn get_provisioning_window(
    pool: &SqlitePool,
) -> Result<Option<ProvisioningWindowState>, AppError> {
    let Some(raw) = app_kv_repo::get(pool, APP_KV_INSTALL_PLAN_PROVISIONING).await? else {
        return Ok(None);
    };
    let state: ProvisioningWindowState = serde_json::from_str(&raw)
        .map_err(|e| AppError::Validation(format!("provisioning json: {e}")))?;
    if let Ok(expires) = chrono::DateTime::parse_from_rfc3339(&state.expires_at) {
        if Utc::now() > expires.with_timezone(&Utc) {
            app_kv_repo::delete(pool, APP_KV_INSTALL_PLAN_PROVISIONING)
                .await
                .ok();
            return Ok(None);
        }
    }
    Ok(Some(state))
}

pub fn plan_includes_server(plan: &InstallPlan) -> bool {
    plan.components
        .iter()
        .any(|c| matches!(c, InstallComponent::LanServer))
}

pub async fn read_deployment_mode(pool: &SqlitePool) -> Result<Option<String>, AppError> {
    let Some(raw) = app_kv_repo::get(pool, APP_KV_DEPLOYMENT_KEY).await? else {
        return Ok(None);
    };
    let cfg: SyncDeploymentConfig = serde_json::from_str(&raw)
        .map_err(|e| AppError::Validation(format!("deployment json: {e}")))?;
    Ok(Some(cfg.mode.as_str().into()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use medoc_core::infrastructure::install_plan::InstallPlan;

    #[test]
    fn master_plan_maps_to_deployment() {
        let plan = InstallPlan::new_master("Main PC");
        let cfg = plan_to_deployment(&plan);
        assert_eq!(cfg.role, DeviceRole::Master);
        assert_eq!(cfg.mode, DeploymentMode::ServerlessPeer);
        assert_eq!(cfg.device_label, "Main PC");
    }

    #[test]
    fn fixed_discover_builds_master_url() {
        let mut plan = InstallPlan::new_master("Replica");
        plan.role = InstallRole::Replica;
        plan.discover.mode = DiscoverMode::Fixed;
        plan.discover.address = "192.168.1.10".into();
        plan.discover.port = 8787;
        let cfg = plan_to_deployment(&plan);
        assert_eq!(cfg.master_base_url, "https://192.168.1.10:8787");
    }
}
