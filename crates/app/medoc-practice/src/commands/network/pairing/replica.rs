//! Replica-side pairing IPC (submit, poll, confirm PIN, persist token).

use medoc_core::error::AppError;
use medoc_sync::deployment::{DeploymentMode, DeviceRole, SyncDeploymentConfig};
use medoc_sync::engine::SyncEngine;
use medoc_sync::master_keys;
use medoc_sync::pairing::{PairingRequest, ACTIVATION_TOKEN_PREFIX};
use sqlx::SqlitePool;
use tauri::{Manager, State};

use crate::commands::auth_commands::SessionState;
use crate::error::AppError as TauriAppError;

use super::support::{build_http_client, ensure_local_device_id, into_tauri};
use super::types::{
    PairingCheckStatusPayload, PairingConfirmPinPayload, PairingPersistTokenPayload,
    PairingSubmitPayload, PairingSubmitResult,
};

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn pairing_submit_request(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    payload: PairingSubmitPayload,
) -> Result<PairingSubmitResult, TauriAppError> {
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
        "transport": payload.transport,
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

#[tauri::command]
#[tracing::instrument(level = "info")]
pub async fn pairing_confirm_pin(
    payload: PairingConfirmPinPayload,
) -> Result<PairingRequest, TauriAppError> {
    let base = payload.master_base_url.trim_end_matches('/');
    let url = format!("{base}/api/v1/pairing/confirm/{}", payload.request_id);
    let resp = build_http_client()
        .post(&url)
        .json(&serde_json::json!({ "pin": payload.pin.trim() }))
        .send()
        .await
        .map_err(|e| into_tauri(AppError::Internal(format!("confirm pin: {e}"))))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(into_tauri(AppError::Validation(format!(
            "PIN-Bestätigung fehlgeschlagen ({status}): {body}"
        ))));
    }
    resp.json::<PairingRequest>()
        .await
        .map_err(|e| into_tauri(AppError::Internal(format!("confirm pin json: {e}"))))
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
