//! Geräteverbund Tauri IPC commands.

use std::net::IpAddr;
use std::time::Duration;

use medoc_sync::net::{bind_verbund_listener, scan_admins, AdminEndpoint, DEFAULT_VERBUND_PORT};
use medoc_sync::verbund::crypto::DeviceIdentity;
use medoc_sync::verbund::services::{
    accept_join_request, activate_cluster_license, block_device, create_join_request, list_devices,
    list_pending_requests, reclaim_stale_seat, reject_join_request, revoke_device, submit_sas,
    unblock_device, verbund_status, GeraetView, KopplungHandle, PendingRequest, ProvisionResult,
    SasCode, VerbundStatus,
};
use medoc_sync::verbund::SeatRolle;
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;
use tokio::sync::Mutex;

use crate::commands::auth_commands::SessionState;
use crate::commands::rbac_state::require;
use crate::error::AppError;

#[derive(Default)]
pub struct VerbundListenerControl {
    inner: Mutex<Option<tokio::task::JoinHandle<()>>>,
}

impl VerbundListenerControl {
    pub async fn stop(&self) {
        if let Some(handle) = self.inner.lock().await.take() {
            handle.abort();
        }
    }
}

async fn require_admin_seat(pool: &SqlitePool) -> Result<(), AppError> {
    let status = verbund_status(pool).await?;
    if status.is_owner {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}

fn user_id(session: &SessionState) -> Result<String, AppError> {
    let guard = session.lock_session();
    let (sess, _) = guard.as_ref().ok_or(AppError::Unauthorized)?;
    Ok(sess.user_id.clone())
}

#[tauri::command]
pub async fn verbund_status_cmd(pool: State<'_, SqlitePool>) -> Result<VerbundStatus, AppError> {
    verbund_status(&pool).await
}

#[tauri::command]
pub async fn lizenz_activate(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    license_key: String,
) -> Result<VerbundStatus, AppError> {
    // Pre-login onboarding: no session yet — use bootstrap actor id.
    let uid = user_id(&session_state).unwrap_or_else(|_| "onboarding".into());
    activate_cluster_license(&pool, &uid, &license_key).await
}

#[tauri::command]
pub async fn verbund_discover_admins() -> Result<Vec<AdminEndpoint>, AppError> {
    scan_admins(Duration::from_secs(2))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinRequestPayload {
    pub requested_role: String,
    #[serde(default)]
    pub handshake_transcript_b64: String,
}

#[tauri::command]
pub async fn verbund_send_join_request(
    pool: State<'_, SqlitePool>,
    payload: JoinRequestPayload,
) -> Result<KopplungHandle, AppError> {
    let role = SeatRolle::parse(&payload.requested_role).unwrap_or(SeatRolle::Member);
    let identity = DeviceIdentity::load_or_create()?;
    let transcript = if payload.handshake_transcript_b64.is_empty() {
        identity.fingerprint.as_bytes()
    } else {
        payload.handshake_transcript_b64.as_bytes()
    };
    create_join_request(&pool, &identity.fingerprint, role, transcript).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SasSubmitPayload {
    pub handle: KopplungHandle,
    pub digits: String,
    #[serde(default)]
    pub handshake_transcript_b64: String,
}

#[tauri::command]
pub async fn verbund_submit_sas(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    payload: SasSubmitPayload,
) -> Result<ProvisionResult, AppError> {
    let uid = user_id(&session_state).unwrap_or_else(|_| "joiner".into());
    let transcript = payload.handshake_transcript_b64.as_bytes();
    submit_sas(&pool, &uid, &payload.handle, &payload.digits, transcript).await
}

/// Spawn TCP+mDNS receive port when licensed or provisioned (called from setup + IPC).
pub async fn auto_start_verbund_if_ready(pool: &SqlitePool, listener: &VerbundListenerControl) {
    let Ok(status) = verbund_status(pool).await else {
        return;
    };
    if !status.licensed && !status.provisioned {
        return;
    }
    if let Err(e) = start_verbund_listener_task(listener).await {
        tracing::warn!(
            target: "medoc::verbund",
            event = "VERBUND_LISTENER_AUTO_SKIP",
            error = %e
        );
    }
}

async fn start_verbund_listener_task(listener: &VerbundListenerControl) -> Result<(), AppError> {
    listener.stop().await;
    let addr = pick_private_bind_addr()?;
    let listener_task = tokio::spawn(async move {
        if let Ok(l) = bind_verbund_listener(addr, DEFAULT_VERBUND_PORT).await {
            tracing::info!(
                target: "medoc::verbund",
                event = "VERBUND_LISTENER_START",
                port = DEFAULT_VERBUND_PORT
            );
            loop {
                if l.accept().await.is_err() {
                    break;
                }
            }
        }
    });
    *listener.inner.lock().await = Some(listener_task);
    Ok(())
}

#[tauri::command]
pub async fn verbund_start_listener(
    pool: State<'_, SqlitePool>,
    listener: State<'_, VerbundListenerControl>,
) -> Result<(), AppError> {
    let status = verbund_status(&pool).await?;
    if !status.licensed && !status.provisioned {
        return Err(AppError::Validation(
            "Verbund-Listener nur bei aktiver Lizenz/Provisioning".into(),
        ));
    }
    start_verbund_listener_task(&listener).await
}

#[tauri::command]
pub async fn verbund_list_pending(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<PendingRequest>, AppError> {
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    list_pending_requests(&pool).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AcceptRequestPayload {
    pub id: String,
    #[serde(default)]
    pub handshake_transcript_b64: String,
    /// Revoke this fingerprint before reserving a seat (reinstall reclaim).
    #[serde(default)]
    pub replace_fingerprint: Option<String>,
}

#[tauri::command]
pub async fn verbund_accept_request(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    payload: AcceptRequestPayload,
) -> Result<SasCode, AppError> {
    let uid = user_id(&session_state)?;
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    let transcript = payload.handshake_transcript_b64.as_bytes();
    accept_join_request(
        &pool,
        &uid,
        &payload.id,
        transcript,
        payload.replace_fingerprint.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn verbund_reclaim_device(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    fingerprint: String,
) -> Result<(), AppError> {
    let uid = user_id(&session_state)?;
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    reclaim_stale_seat(&pool, &uid, &fingerprint).await
}

fn pick_private_bind_addr() -> Result<IpAddr, AppError> {
    for iface in if_addrs::get_if_addrs().map_err(|e| AppError::Internal(e.to_string()))? {
        if !iface.is_loopback() && medoc_sync::net::is_private_lan_address(iface.ip()) {
            return Ok(iface.ip());
        }
    }
    Ok("127.0.0.1".parse().expect("loopback parse"))
}

#[tauri::command]
pub async fn verbund_reject_request(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    id: String,
) -> Result<(), AppError> {
    let uid = user_id(&session_state)?;
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    reject_join_request(&pool, &uid, &id).await
}

#[tauri::command]
pub async fn verbund_list_devices(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<GeraetView>, AppError> {
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    list_devices(&pool).await
}

#[tauri::command]
pub async fn verbund_revoke_device(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    fingerprint: String,
) -> Result<(), AppError> {
    let uid = user_id(&session_state)?;
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    revoke_device(&pool, &uid, &fingerprint).await
}

#[tauri::command]
pub async fn verbund_block_device(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    fingerprint: String,
    reason: String,
) -> Result<(), AppError> {
    let uid = user_id(&session_state)?;
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    block_device(&pool, &uid, &fingerprint, &reason).await
}

#[tauri::command]
pub async fn verbund_unblock_device(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    fingerprint: String,
) -> Result<(), AppError> {
    let uid = user_id(&session_state)?;
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    unblock_device(&pool, &uid, &fingerprint).await
}
