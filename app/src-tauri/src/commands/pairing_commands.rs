//! Tauri IPC for master/replica pairing.
//!
//! Master side (inbox):
//! - `pairing_list_pending` — pending requests to approve.
//! - `pairing_list_all`     — full history (pending / accepted / rejected / revoked).
//! - `pairing_decide`       — accept or reject a request (RBAC: `ops.system`).
//! - `pairing_revoke`       — revoke an accepted pairing.
//! - `pairing_master_info`  — master pubkey + label for UI display.
//!
//! Replica side (initiator):
//! - `pairing_scan_lan`        — UDP discovery of LAN masters.
//! - `pairing_submit_request`  — submit `{device_id, slave_pubkey}` to master.
//! - `pairing_check_status`    — poll a request id until accepted/rejected.
//! - `pairing_persist_token`   — once accepted, write activation token + master pubkey
//!   into `sync.deployment.v1` so subsequent sync calls use it.

use std::time::Duration;

use medoc_core::error::AppError;
use medoc_sync::deployment::{
    DeploymentMode, DeviceRole, SyncDeploymentConfig, APP_KV_DEVICE_ID_KEY,
};
use medoc_sync::engine::SyncEngine;
use medoc_sync::master_keys;
use medoc_sync::pairing::{
    self as pairing, PairingDecision, PairingRequest, ACTIVATION_TOKEN_PREFIX,
};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{Manager, State};

use crate::commands::auth_commands::SessionState;
use crate::commands::rbac_state::require;
use crate::error::AppError as TauriAppError;

async fn require_master_license_cmd(pool: &SqlitePool) -> Result<(), AppError> {
    if std::env::var("MEDOC_SKIP_MASTER_LICENSE")
        .ok()
        .is_some_and(|v| v == "1" || v.eq_ignore_ascii_case("true"))
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingDecidePayload {
    pub request_id: String,
    pub accept: bool,
    #[serde(default)]
    pub allowed_actions: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingMasterInfo {
    pub master_device_id: String,
    pub master_pubkey: String,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_list_pending(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PairingRequest>, TauriAppError> {
    require(&session_state, "ops.system")?;
    pairing::list_pending(&pool).await.map_err(into_tauri)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_list_all(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PairingRequest>, TauriAppError> {
    require(&session_state, "ops.system")?;
    pairing::list_all(&pool).await.map_err(into_tauri)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_decide(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    payload: PairingDecidePayload,
) -> Result<PairingRequest, TauriAppError> {
    let session = require(&session_state, "ops.system")?;
    require_master_license_cmd(&pool)
        .await
        .map_err(into_tauri)?;
    let master_device_id = master_local_device_id(&pool).await.map_err(into_tauri)?;
    pairing::decide(
        &pool,
        &master_device_id,
        &payload.request_id,
        PairingDecision {
            accept: payload.accept,
            allowed_actions: payload.allowed_actions,
            decided_by: session.user_id.clone(),
        },
        pairing::DEFAULT_REPLICA_HTTP_PORT,
    )
    .await
    .map_err(into_tauri)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_revoke(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    device_id: String,
) -> Result<(), TauriAppError> {
    let session = require(&session_state, "ops.system")?;
    require_master_license_cmd(&pool)
        .await
        .map_err(into_tauri)?;
    let master_device_id = master_local_device_id(&pool).await.map_err(into_tauri)?;
    pairing::revoke(&pool, &master_device_id, &device_id, &session.user_id)
        .await
        .map_err(into_tauri)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_master_info(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<PairingMasterInfo, TauriAppError> {
    require(&session_state, "ops.system")?;
    let sk = master_keys::load_or_create().map_err(into_tauri)?;
    let master_device_id = master_local_device_id(&pool).await.map_err(into_tauri)?;
    Ok(PairingMasterInfo {
        master_device_id,
        master_pubkey: master_keys::pubkey_b64(&sk),
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingScanPayload {
    #[serde(default = "default_scan_seconds")]
    pub seconds: u64,
}

fn default_scan_seconds() -> u64 {
    2
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredMaster {
    pub host: String,
    pub http_port: u16,
    pub label: String,
    pub instance_id: String,
    pub tls: bool,
    pub cert_sha256: String,
    pub base_url: String,
}

#[tauri::command]
#[tracing::instrument(level = "info")]
pub async fn pairing_scan_lan(
    payload: PairingScanPayload,
) -> Result<Vec<DiscoveredMaster>, TauriAppError> {
    let port = std::env::var("MEDOC_DISCOVERY_PORT")
        .ok()
        .and_then(|s| s.parse::<u16>().ok())
        .unwrap_or(8788);
    let window = Duration::from_millis((payload.seconds * 1000).max(500));
    let probed = medoc_core::discovery::scan_lan_hosts(port, window, None)
        .await
        .map_err(|e| into_tauri(AppError::Internal(format!("LAN discovery: {e}"))))?;
    let out = probed
        .into_iter()
        .map(|(addr, payload)| {
            let host = addr.ip().to_string();
            let scheme = if payload.tls { "https" } else { "http" };
            DiscoveredMaster {
                base_url: format!("{scheme}://{host}:{}", payload.http_port),
                host,
                http_port: payload.http_port,
                label: payload.label,
                instance_id: payload.instance_id,
                tls: payload.tls,
                cert_sha256: payload.cert_sha256,
            }
        })
        .collect();
    Ok(out)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingSubmitPayload {
    pub master_base_url: String,
    #[serde(default)]
    pub master_cert_sha256: String,
    pub slave_label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingSubmitResult {
    pub request_id: String,
    pub device_id: String,
    pub slave_pubkey: String,
    pub master_pubkey: String,
    pub master_device_id: String,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_submit_request(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    payload: PairingSubmitPayload,
) -> Result<PairingSubmitResult, TauriAppError> {
    // Replica context: any authenticated session can initiate pairing.
    crate::application::rbac::require_authenticated(&session_state)?;
    let device_id = ensure_local_device_id(&pool).await.map_err(into_tauri)?;
    let slave_sk = master_keys::load_or_create().map_err(into_tauri)?;
    let slave_pubkey = master_keys::pubkey_b64(&slave_sk);

    let client = build_http_client();
    let base = payload.master_base_url.trim_end_matches('/').to_string();

    let info: serde_json::Value = client
        .get(format!("{base}/api/v1/pairing/master-info"))
        .send()
        .await
        .map_err(|e| into_tauri(AppError::Internal(format!("master-info: {e}"))))?
        .json()
        .await
        .map_err(|e| into_tauri(AppError::Internal(format!("master-info json: {e}"))))?;
    let master_pubkey = info
        .get("masterPubkey")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let master_device_id = info
        .get("masterDeviceId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if master_pubkey.is_empty() || master_device_id.is_empty() {
        return Err(into_tauri(AppError::Validation(
            "Master Antwort unvollständig (pubkey/deviceId fehlt)".into(),
        )));
    }

    let body = serde_json::json!({
        "deviceId": device_id,
        "slavePubkey": slave_pubkey,
        "slaveLabel": payload.slave_label,
    });
    let resp = client
        .post(format!("{base}/api/v1/pairing/request"))
        .json(&body)
        .send()
        .await
        .map_err(|e| into_tauri(AppError::Internal(format!("pairing request: {e}"))))?;
    if !resp.status().is_success() {
        let status = resp.status();
        return Err(into_tauri(AppError::Internal(format!(
            "pairing request http {status}"
        ))));
    }
    let req: PairingRequest = resp
        .json()
        .await
        .map_err(|e| into_tauri(AppError::Internal(format!("pairing request json: {e}"))))?;

    // Provisionally persist deployment so future polls + sync reuse base URL + pubkey.
    let cfg = SyncDeploymentConfig {
        schema_version: 1,
        mode: DeploymentMode::ServerlessPeer,
        role: DeviceRole::Replica,
        master_base_url: base.clone(),
        master_cert_sha256: payload.master_cert_sha256,
        master_access_token: String::new(),
        device_label: payload.slave_label,
        activation_token: String::new(),
        master_pubkey: master_pubkey.clone(),
        master_device_id: master_device_id.clone(),
        pairing_request_id: req.id.clone(),
        unstable_mesh: false,
    };
    SyncEngine::set_deployment(&pool, cfg)
        .await
        .map_err(into_tauri)?;

    Ok(PairingSubmitResult {
        request_id: req.id,
        device_id,
        slave_pubkey,
        master_pubkey,
        master_device_id,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingCheckStatusPayload {
    pub request_id: String,
    pub master_base_url: String,
}

#[tauri::command]
#[tracing::instrument(level = "info")]
pub async fn pairing_check_status(
    payload: PairingCheckStatusPayload,
) -> Result<PairingRequest, TauriAppError> {
    let base = payload.master_base_url.trim_end_matches('/');
    let url = format!("{base}/api/v1/pairing/status/{}", payload.request_id);
    let resp = build_http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| into_tauri(AppError::Internal(format!("status: {e}"))))?;
    if !resp.status().is_success() {
        return Err(into_tauri(AppError::Internal(format!(
            "status http {}",
            resp.status()
        ))));
    }
    resp.json::<PairingRequest>()
        .await
        .map_err(|e| into_tauri(AppError::Internal(format!("status json: {e}"))))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PairingPersistTokenPayload {
    pub activation_token: String,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state, payload))]
pub async fn pairing_persist_token(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    app: tauri::AppHandle,
    payload: PairingPersistTokenPayload,
) -> Result<(), TauriAppError> {
    crate::application::rbac::require_authenticated(&session_state)?;
    let token = payload.activation_token.trim();
    if !token.starts_with(ACTIVATION_TOKEN_PREFIX) {
        return Err(into_tauri(AppError::Validation(
            "Aktivierungstoken: ungültiger Präfix".into(),
        )));
    }
    let snap = SyncEngine::status(&pool).await.map_err(into_tauri)?;
    let mut cfg = snap.deployment;
    cfg.activation_token = token.to_string();
    SyncEngine::set_deployment(&pool, cfg)
        .await
        .map_err(into_tauri)?;
    if let Some(ctrl) = app.try_state::<crate::commands::lan_commands::LanServerControl>() {
        crate::commands::lan_commands::auto_start_replica_sync_lan(&app, (*pool).clone(), &ctrl)
            .await;
    }
    Ok(())
}

async fn master_local_device_id(pool: &SqlitePool) -> Result<String, AppError> {
    let id =
        medoc_core::infrastructure::database::app_kv_repo::get(pool, APP_KV_DEVICE_ID_KEY).await?;
    Ok(id
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "master-local".into()))
}

async fn ensure_local_device_id(pool: &SqlitePool) -> Result<String, AppError> {
    // Re-uses the sync layer helper so the device id is consistent across the app.
    let label = "";
    medoc_sync::repo::ensure_local_device(pool, label).await
}

fn build_http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .danger_accept_invalid_certs(true)
        .build()
        .expect("reqwest client")
}

fn into_tauri(e: AppError) -> TauriAppError {
    // The practice crate re-exports medoc_core::error::AppError under its
    // own `error` module path, so this is a no-op wrapper.
    e
}

#[macro_export]
macro_rules! register_pairing_commands {
    () => {
        $crate::commands::pairing_commands::pairing_list_pending,
        $crate::commands::pairing_commands::pairing_list_all,
        $crate::commands::pairing_commands::pairing_decide,
        $crate::commands::pairing_commands::pairing_revoke,
        $crate::commands::pairing_commands::pairing_master_info,
        $crate::commands::pairing_commands::pairing_scan_lan,
        $crate::commands::pairing_commands::pairing_submit_request,
        $crate::commands::pairing_commands::pairing_check_status,
        $crate::commands::pairing_commands::pairing_persist_token,
    };
}
