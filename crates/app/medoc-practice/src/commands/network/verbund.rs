//! Geräteverbund Tauri IPC commands.

use std::net::IpAddr;
use std::time::Duration;

use medoc_sync::net::{
    bind_verbund_listener, handle_join_connection, join_admin_endpoint, scan_admins, AdminEndpoint,
    MdnsResponder, DEFAULT_VERBUND_PORT,
};
use medoc_sync::verbund::crypto::DeviceIdentity;
use medoc_sync::verbund::services::{
    accept_join_request, activate_cluster_license, block_device, import_owner_activation,
    list_devices, list_pending_requests, mirror_join_session, reclaim_stale_seat,
    reject_join_request, require_owner_admin, revoke_device, submit_sas, unblock_device,
    verbund_network_ready, verbund_status, GeraetView, ImportActivationResult, JoinRequestResult,
    KopplungHandle, PendingRequest, ProvisionResult, SasCode, VerbundStatus,
};
use medoc_sync::verbund::SeatRolle;
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, State};
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
    require_owner_admin(pool).await
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
pub async fn import_activation_manifest(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    manifest_path: String,
    passphrase: String,
) -> Result<ImportActivationResult, AppError> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(format!("App-Datenverzeichnis: {e}")))?;
    let summary = import_owner_activation(
        &pool,
        &app_dir,
        "onboarding",
        std::path::Path::new(&manifest_path),
        &passphrase,
    )
    .await?;
    let status = if summary.requires_app_reload {
        let fresh =
            medoc_core::infrastructure::database::connection::reopen_app_pool(&app_dir).await?;
        verbund_status(&fresh).await?
    } else {
        verbund_status(&pool).await?
    };
    Ok(ImportActivationResult {
        status,
        manifest_removed: summary.manifest_removed,
        cluster_id: Some(summary.cluster_id),
        device_fingerprint: Some(summary.device_fingerprint),
        requires_app_reload: summary.requires_app_reload,
    })
}

/// Native file picker for owner activation manifest (pre-login onboarding).
#[tauri::command]
pub async fn pick_activation_manifest_file() -> Result<Option<String>, AppError> {
    let path = rfd::FileDialog::new()
        .add_filter("JSON", &["json"])
        .set_file_name("activation.json")
        .pick_file();
    Ok(path.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub async fn verbund_discover_admins() -> Result<Vec<AdminEndpoint>, AppError> {
    scan_admins(Duration::from_secs(2))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JoinRequestPayload {
    pub requested_role: String,
    pub admin_host: String,
    pub admin_port: u16,
    #[serde(default)]
    pub handshake_transcript_b64: String,
}

#[tauri::command]
pub async fn verbund_send_join_request(
    pool: State<'_, SqlitePool>,
    payload: JoinRequestPayload,
) -> Result<JoinRequestResult, AppError> {
    if payload.admin_host.trim().is_empty() || payload.admin_port == 0 {
        return Err(AppError::Validation(
            "Admin-Host und Port erforderlich".into(),
        ));
    }
    let role = SeatRolle::parse(&payload.requested_role).unwrap_or(SeatRolle::Member);
    let identity = DeviceIdentity::load_or_create()?;
    let outcome = join_admin_endpoint(
        payload.admin_host.trim(),
        payload.admin_port,
        &identity,
        role,
    )
    .await?;
    mirror_join_session(
        &pool,
        &outcome.session_id,
        &outcome.fingerprint,
        role,
        &outcome.handshake_transcript,
    )
    .await?;
    let transcript_b64 = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &outcome.handshake_transcript,
    );
    Ok(JoinRequestResult {
        handle: KopplungHandle {
            session_id: outcome.session_id,
            fingerprint: outcome.fingerprint,
        },
        handshake_transcript_b64: transcript_b64,
    })
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
    let transcript = if payload.handshake_transcript_b64.is_empty() {
        vec![]
    } else {
        base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            payload.handshake_transcript_b64.trim(),
        )
        .map_err(|e| AppError::Validation(format!("handshake transcript base64: {e}")))?
    };
    submit_sas(&pool, &uid, &payload.handle, &payload.digits, &transcript).await
}

/// Spawn TCP+mDNS receive port when licensed (owners) or licensed/provisioned (members).
pub async fn auto_start_verbund_if_ready(pool: &SqlitePool, listener: &VerbundListenerControl) {
    let Ok(status) = verbund_status(pool).await else {
        return;
    };
    if !verbund_network_ready(&status) {
        return;
    }
    if let Err(e) = start_verbund_listener_task(pool.clone(), listener).await {
        tracing::warn!(
            target: "medoc::verbund",
            event = "VERBUND_LISTENER_AUTO_SKIP",
            error = %e
        );
    }
}

async fn start_verbund_listener_task(
    pool: SqlitePool,
    listener: &VerbundListenerControl,
) -> Result<(), AppError> {
    listener.stop().await;
    let addr = pick_private_bind_addr()?;
    let host = addr.to_string();
    let cluster_id = verbund_status(&pool)
        .await?
        .cluster_id
        .unwrap_or_else(|| "verbund".into());
    let listener_task = tokio::spawn(async move {
        let _mdns = match MdnsResponder::advertise(&host, DEFAULT_VERBUND_PORT, &cluster_id) {
            Ok(r) => Some(r),
            Err(e) => {
                tracing::warn!(
                    target: "medoc::verbund",
                    event = "VERBUND_MDNS_SKIP",
                    error = %e
                );
                None
            }
        };
        if let Ok(l) = bind_verbund_listener(addr, DEFAULT_VERBUND_PORT).await {
            tracing::info!(
                target: "medoc::verbund",
                event = "VERBUND_LISTENER_START",
                port = DEFAULT_VERBUND_PORT
            );
            loop {
                match l.accept().await {
                    Ok((stream, peer)) => {
                        tracing::debug!(
                            target: "medoc::verbund",
                            event = "VERBUND_INBOUND",
                            peer = %peer
                        );
                        let pool = pool.clone();
                        tokio::spawn(async move {
                            handle_join_connection(stream, pool).await;
                        });
                    }
                    Err(e) => {
                        tracing::warn!(
                            target: "medoc::verbund",
                            event = "VERBUND_ACCEPT_ERR",
                            error = %e
                        );
                        break;
                    }
                }
            }
        }
        drop(_mdns);
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
    if !verbund_network_ready(&status) {
        return Err(AppError::Validation(
            "Verbund-Listener nur bei aktiver Lizenz (Eigentümer) bzw. Lizenz/Provisioning (Mitglied)".into(),
        ));
    }
    start_verbund_listener_task(pool.inner().clone(), &listener).await
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
