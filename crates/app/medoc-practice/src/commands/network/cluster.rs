//! Practice-network (Cluster) Tauri IPC commands.

use std::net::{IpAddr, Ipv4Addr};
use std::time::Duration;

use medoc_core::infrastructure::install_plan::{InstallPlan, ProvisioningWindowState};
use medoc_sync::cluster::crypto::DeviceIdentity;
use medoc_sync::cluster::services::{
    accept_join_request, activate_cluster_license, apply_install_plan, block_device,
    cluster_network_ready, cluster_status, consume_default_sidecar_and_apply,
    get_provisioning_window, import_owner_activation, list_devices, list_pending_requests,
    mirror_join_session, reclaim_stale_seat, reject_join_request, require_owner_admin,
    revoke_device, run_provisioning_tasks, store_join_admin_endpoint, submit_sas,
    sync_staff_from_stored_admin_endpoint, unblock_device, ApplyInstallPlanResult, ClusterStatus,
    DeviceView, ImportActivationResult, JoinRequestResult, PairingHandle, PendingRequest,
    ProvisionResult, SasCode,
};
use medoc_sync::cluster::SeatRole;
use medoc_sync::net::{
    bind_cluster_listener, join_admin_endpoint, scan_admins,
    spawn_cluster_connection_handler_until, AdminEndpoint, MdnsResponder, DEFAULT_CLUSTER_PORT,
};
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, State};
use tokio::sync::{watch, Mutex};

use crate::commands::admin::auth::SessionState;
use crate::commands::rbac_state::require;
use crate::error::AppError;

pub struct ClusterListenerControl {
    inner: Mutex<Option<tokio::task::JoinHandle<()>>>,
    /// `true` closes sockets that are already accepted.
    cancel_existing: watch::Sender<bool>,
}

impl Default for ClusterListenerControl {
    fn default() -> Self {
        let (cancel_existing, _) = watch::channel(false);
        Self {
            inner: Mutex::new(None),
            cancel_existing,
        }
    }
}

impl ClusterListenerControl {
    pub async fn is_running(&self) -> bool {
        self.inner.lock().await.is_some()
    }

    /// Drop the listen socket. Connections already accepted stay open.
    pub async fn stop(&self) {
        if let Some(handle) = self.inner.lock().await.take() {
            handle.abort();
        }
    }

    /// Drop the listen socket and close every connection already accepted.
    pub async fn close_all(&self) {
        let _ = self.cancel_existing.send(true);
        self.stop().await;
    }
}

async fn require_admin_seat(pool: &SqlitePool) -> Result<(), AppError> {
    require_owner_admin(pool).await
}

/// Pre-login onboarding commands (license, install plan) run without a staff
/// session on a fresh install. Once setup is complete they change the
/// device's role / license, so a signed-in `ops.system` user is required —
/// otherwise anyone at a logged-out practice PC could re-role the device.
async fn require_ops_after_onboarding(
    pool: &SqlitePool,
    session_state: &State<'_, SessionState>,
) -> Result<(), AppError> {
    let done = medoc_core::infrastructure::database::repos::admin::app_kv::get(
        pool,
        "onboarding.setup_complete.v1",
    )
    .await
    .ok()
    .flatten()
    .map(|v| {
        let v = v.trim().trim_matches('"');
        !v.is_empty() && v != "0" && v != "false"
    })
    .unwrap_or(false);
    if done {
        require(session_state, "ops.system")?;
    }
    Ok(())
}

fn user_id(session: &SessionState) -> Result<String, AppError> {
    let guard = session.lock_session();
    let (sess, _) = guard.as_ref().ok_or(AppError::Unauthorized)?;
    Ok(sess.user_id.clone())
}

#[tauri::command]
pub async fn cluster_status_cmd(pool: State<'_, SqlitePool>) -> Result<ClusterStatus, AppError> {
    cluster_status(&pool).await
}

#[tauri::command]
pub async fn license_activate(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    license_key: String,
) -> Result<ClusterStatus, AppError> {
    require_ops_after_onboarding(&pool, &session_state).await?;
    // Pre-login onboarding: no session yet — use bootstrap actor id.
    let uid = user_id(&session_state).unwrap_or_else(|_| "onboarding".into());
    let resolved = crate::commands::network::company_portal::resolve_onboarding_license_key(
        &pool,
        &license_key,
    )
    .await?;
    let status = activate_cluster_license(&pool, &uid, &resolved).await?;
    if status.licensed {
        let rebound = resolved.trim() != license_key.trim();
        if let Some(code) =
            crate::commands::network::company_portal::deployment_code_for_pasted_license(
                &license_key,
                rebound,
            )
        {
            let _ =
                crate::commands::network::company_portal::apply_serverless_role_from_license_code(
                    &pool, &code,
                )
                .await;
        }
        crate::commands::network::company_portal::reset_onboarding_after_owner_license_activation(
            &pool,
        )
        .await?;
    }
    Ok(status)
}

#[tauri::command]
pub async fn import_activation_manifest(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    manifest_path: String,
    passphrase: String,
) -> Result<ImportActivationResult, AppError> {
    let app_dir = crate::commands::app_data_dir(&app)?;
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
        cluster_status(&fresh).await?
    } else {
        cluster_status(&pool).await?
    };
    Ok(ImportActivationResult {
        status,
        manifest_removed: summary.manifest_removed,
        cluster_id: Some(summary.cluster_id),
        device_fingerprint: Some(summary.device_fingerprint),
        requires_app_reload: summary.requires_app_reload,
        needs_bridge_b_passphrase: summary.needs_bridge_b_passphrase,
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

/// Apply pending USB sidecar install plan (first boot after USB setup).
#[tauri::command]
pub async fn install_plan_consume_sidecar(
    pool: State<'_, SqlitePool>,
) -> Result<Option<ApplyInstallPlanResult>, AppError> {
    consume_default_sidecar_and_apply(&pool).await
}

/// Apply an explicit install plan (e.g. from onboarding UI).
#[tauri::command]
pub async fn install_plan_apply(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    plan: InstallPlan,
) -> Result<ApplyInstallPlanResult, AppError> {
    require_ops_after_onboarding(&pool, &session_state).await?;
    apply_install_plan(&pool, &plan).await
}

/// Active provisioning window from USB install_plan (pairing / scan / open ports).
#[tauri::command]
pub async fn install_plan_provisioning_status(
    pool: State<'_, SqlitePool>,
) -> Result<Option<ProvisioningWindowState>, AppError> {
    get_provisioning_window(&pool).await
}

/// Run discover/scan tasks while provisioning window is active (chain install helper).
#[tauri::command]
pub async fn install_plan_run_provisioning(
    pool: State<'_, SqlitePool>,
) -> Result<Option<String>, AppError> {
    run_provisioning_tasks(&pool).await
}

fn decode_handshake_transcript_b64(s: &str) -> Result<Vec<u8>, AppError> {
    let t = s.trim();
    if t.is_empty() {
        return Ok(Vec::new());
    }
    base64::Engine::decode(&base64::engine::general_purpose::STANDARD, t)
        .map_err(|e| AppError::Validation(format!("handshake transcript base64: {e}")))
}

#[tauri::command]
pub async fn cluster_discover_admins() -> Result<Vec<AdminEndpoint>, AppError> {
    tokio::task::spawn_blocking(|| scan_admins(Duration::from_secs(3)))
        .await
        .map_err(|e| AppError::Internal(format!("discover join: {e}")))?
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
pub async fn cluster_send_join_request(
    pool: State<'_, SqlitePool>,
    payload: JoinRequestPayload,
) -> Result<JoinRequestResult, AppError> {
    if payload.admin_host.trim().is_empty() || payload.admin_port == 0 {
        return Err(AppError::Validation("Admin host and port required".into()));
    }
    let role = SeatRole::parse(&payload.requested_role).unwrap_or(SeatRole::Member);
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
    store_join_admin_endpoint(&pool, payload.admin_host.trim(), payload.admin_port).await?;
    let transcript_b64 = base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &outcome.handshake_transcript,
    );
    Ok(JoinRequestResult {
        handle: PairingHandle {
            session_id: outcome.session_id,
            fingerprint: outcome.fingerprint,
        },
        handshake_transcript_b64: transcript_b64,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SasSubmitPayload {
    pub handle: PairingHandle,
    pub digits: String,
    #[serde(default)]
    pub handshake_transcript_b64: String,
}

#[tauri::command]
pub async fn cluster_submit_sas(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    payload: SasSubmitPayload,
) -> Result<ProvisionResult, AppError> {
    let uid = user_id(&session_state).unwrap_or_else(|_| "joiner".into());
    let transcript = decode_handshake_transcript_b64(&payload.handshake_transcript_b64)?;
    let result = submit_sas(&pool, &uid, &payload.handle, &payload.digits, &transcript).await?;
    if result.success {
        if let Err(e) = sync_staff_from_stored_admin_endpoint(&pool).await {
            tracing::warn!(
                target: "medoc::cluster",
                event = "STAFF_DIRECTORY_SYNC_FAILED",
                error = %e
            );
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn cluster_sync_staff_directory(pool: State<'_, SqlitePool>) -> Result<u32, AppError> {
    sync_staff_from_stored_admin_endpoint(&pool).await
}

/// Spawn TCP+mDNS receive port with the desktop app (pairing / mesh).
pub async fn auto_start_cluster_if_ready(pool: &SqlitePool, listener: &ClusterListenerControl) {
    if medoc_sync::pairing::is_network_hidden(pool)
        .await
        .unwrap_or(false)
    {
        tracing::info!(
            target: "medoc::cluster",
            event = "CLUSTER_LISTENER_SKIP_HIDDEN"
        );
        return;
    }
    if crate::commands::network::lan::lan_server_listen_disabled() {
        tracing::info!(
            target: "medoc::cluster",
            event = "CLUSTER_LISTENER_SKIP_INSTANCE"
        );
        return;
    }
    if let Ok(snap) = medoc_sync::engine::SyncEngine::status(pool).await {
        if snap.deployment.role == medoc_sync::deployment::DeviceRole::Replica {
            tracing::info!(
                target: "medoc::cluster",
                event = "CLUSTER_LISTENER_SKIP_REPLICA"
            );
            return;
        }
    }
    if let Err(e) = start_cluster_listener_task(pool.clone(), listener).await {
        tracing::warn!(
            target: "medoc::cluster",
            event = "CLUSTER_LISTENER_AUTO_SKIP",
            error = %e
        );
    }
}

async fn start_cluster_listener_task(
    pool: SqlitePool,
    listener: &ClusterListenerControl,
) -> Result<(), AppError> {
    if listener.is_running().await {
        return Ok(());
    }
    let _ = listener.cancel_existing.send(false);
    listener.stop().await;
    let (addr, iface_name) = match medoc_core::discovery::pick_private_lan_ipv4_bind() {
        Some(bind) => (IpAddr::V4(bind.ip), bind.iface_name),
        None => {
            tracing::info!(
                target: "medoc::cluster",
                event = "CLUSTER_LISTENER_LOOPBACK_FALLBACK"
            );
            (IpAddr::V4(Ipv4Addr::LOCALHOST), "lo".into())
        }
    };
    let bound = match bind_cluster_listener(addr, DEFAULT_CLUSTER_PORT).await {
        Ok(l) => l,
        Err(e) if matches!(e, AppError::Conflict(_)) => {
            tracing::info!(
                target: "medoc::cluster",
                event = "CLUSTER_LISTENER_ALREADY_BOUND",
                error = %e
            );
            return Ok(());
        }
        Err(e) => return Err(e),
    };
    let cancel = listener.cancel_existing.subscribe();
    let cluster_id = cluster_status(&pool)
        .await?
        .cluster_id
        .unwrap_or_else(|| "cluster".into());
    let host = addr.to_string();
    let listener_task = tokio::spawn(async move {
        let cancel = cancel;
        let _mdns = match MdnsResponder::advertise(&host, DEFAULT_CLUSTER_PORT, &cluster_id) {
            Ok(r) => Some(r),
            Err(e) => {
                tracing::warn!(
                    target: "medoc::cluster",
                    event = "CLUSTER_MDNS_SKIP",
                    error = %e
                );
                None
            }
        };
        tracing::info!(
            target: "medoc::cluster",
            event = "CLUSTER_LISTENER_START",
            iface = %iface_name,
            bind_ip = %addr,
            port = DEFAULT_CLUSTER_PORT
        );
        loop {
            match bound.accept().await {
                Ok((stream, peer)) => {
                    tracing::debug!(
                        target: "medoc::cluster",
                        event = "CLUSTER_INBOUND",
                        peer = %peer
                    );
                    let pool = pool.clone();
                    spawn_cluster_connection_handler_until(stream, pool, cancel.clone());
                }
                Err(e) => {
                    tracing::warn!(
                        target: "medoc::cluster",
                        event = "CLUSTER_ACCEPT_ERR",
                        error = %e
                    );
                    break;
                }
            }
        }
        drop(_mdns);
    });
    *listener.inner.lock().await = Some(listener_task);
    Ok(())
}

#[tauri::command]
pub async fn cluster_start_listener(
    pool: State<'_, SqlitePool>,
    listener: State<'_, ClusterListenerControl>,
) -> Result<(), AppError> {
    let status = cluster_status(&pool).await?;
    if !cluster_network_ready(&status) {
        return Err(AppError::Validation(
            "Practice-network listener requires an active license (owner) or license/provisioning (member)".into(),
        ));
    }
    start_cluster_listener_task(pool.inner().clone(), &listener).await
}

#[tauri::command]
pub async fn network_set_hidden(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    listener: State<'_, ClusterListenerControl>,
    hidden: bool,
) -> Result<(), AppError> {
    require(&session_state, "ops.system")?;
    crate::infrastructure::database::repos::admin::app_kv::set(
        &pool,
        medoc_sync::pairing::APP_KV_NETWORK_HIDDEN,
        if hidden { "1" } else { "0" },
    )
    .await?;
    if hidden {
        listener.close_all().await;
        if let Some(lan) = app.try_state::<crate::commands::network::lan::LanServerControl>() {
            crate::commands::network::lan::stop_lan_listener(&lan).await;
        }
        tracing::info!(target: "medoc::cluster", event = "NETWORK_HIDDEN_PORT_CLOSED");
        return Ok(());
    }
    if let Err(error) = start_cluster_listener_task(pool.inner().clone(), &listener).await {
        tracing::warn!(
            target: "medoc::cluster",
            event = "NETWORK_UNHIDE_CLUSTER_SKIP",
            error = %error
        );
    }
    if let Some(lan) = app.try_state::<crate::commands::network::lan::LanServerControl>() {
        match crate::commands::network::lan::start_lan_embedded(&app, pool.inner().clone(), &lan)
            .await
        {
            Ok(_) => {}
            Err(error) if matches!(error, AppError::Conflict(_)) => {}
            Err(error) => {
                tracing::warn!(
                    target: "medoc::lan",
                    event = "NETWORK_UNHIDE_LAN_SKIP",
                    error = %error
                );
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn cluster_list_pending(
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
pub async fn cluster_accept_request(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    payload: AcceptRequestPayload,
) -> Result<SasCode, AppError> {
    let uid = user_id(&session_state)?;
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    let transcript = decode_handshake_transcript_b64(&payload.handshake_transcript_b64)?;
    accept_join_request(
        &pool,
        &uid,
        &payload.id,
        &transcript,
        payload.replace_fingerprint.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn cluster_reclaim_device(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    fingerprint: String,
) -> Result<(), AppError> {
    let uid = user_id(&session_state)?;
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    reclaim_stale_seat(&pool, &uid, &fingerprint).await
}

#[tauri::command]
pub async fn cluster_reject_request(
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
pub async fn cluster_list_devices(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<Vec<DeviceView>, AppError> {
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    list_devices(&pool).await
}

#[tauri::command]
pub async fn cluster_revoke_device(
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
pub async fn cluster_block_device(
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
pub async fn cluster_unblock_device(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    fingerprint: String,
) -> Result<(), AppError> {
    let uid = user_id(&session_state)?;
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    unblock_device(&pool, &uid, &fingerprint).await
}

/// Background poll for member devices to detect owner-initiated cluster reset.
pub fn spawn_member_cluster_watch_task(app: tauri::AppHandle, pool: SqlitePool) {
    let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
        dirs::home_dir()
            .map(|h| h.join("Library/Application Support/de.medoc.app"))
            .unwrap_or_else(|| std::path::PathBuf::from("./medoc-data"))
    });
    let emit_app = app.clone();
    medoc_sync::net::member_cluster_watch::spawn_member_cluster_watch(
        pool,
        app_data_dir,
        move || {
            let restart_app = emit_app.clone();
            crate::commands::app_lifecycle::schedule_app_restart(restart_app);
        },
    );
}

#[tauri::command]
pub async fn cluster_cluster_reset_preview(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<medoc_sync::cluster::services::ClusterResetPreview, AppError> {
    require(&session_state, "ops.system")?;
    require_admin_seat(&pool).await?;
    medoc_sync::cluster::services::cluster_reset_preview(&pool).await
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClusterResetExecuteRequest {
    pub mode: String,
    pub password: String,
    // TODO(deferred-security): 2FA unwired
    // #[serde(default)]
    // pub totp_code: Option<String>,
    pub confirm_phrase: String,
}

async fn validate_cluster_reset_reauth(
    pool: &SqlitePool,
    session_state: &State<'_, SessionState>,
    password: &str,
    confirm_phrase: &str,
) -> Result<String, AppError> {
    let session = require(session_state, "ops.system")?;

    let user =
        crate::infrastructure::database::repos::admin::staff::find_by_id(pool, &session.user_id)
            .await?
            .ok_or(AppError::NotFound("error.entity.staff".into()))?;
    let ok = medoc_core::infrastructure::crypto::verify_password(password, &user.password_hash)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if !ok {
        return Err(AppError::Unauthorized);
    }

    /*
    // TODO(deferred-security): 2FA cluster-reset reauth unwired
    if crate::infrastructure::database::repos::admin::staff::is_totp_enrolled(&user) {
        let code = totp_code
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .ok_or(AppError::TotpRequired)?;
        let secret = user
            .totp_secret
            .as_deref()
            .ok_or_else(|| AppError::Internal("TOTP secret missing".into()))?;
        if !crate::infrastructure::totp::verify_code(secret, code)? {
            return Err(AppError::Unauthorized);
        }
    }
    */

    let preview = medoc_sync::cluster::services::cluster_reset_preview(pool).await?;
    let phrase = confirm_phrase.trim();
    let slug_ok = preview
        .practice_slug
        .as_ref()
        .is_some_and(|s| s.eq_ignore_ascii_case(phrase));
    let reset_ok = phrase.eq_ignore_ascii_case(&preview.confirm_phrase_hint);
    if !slug_ok && !reset_ok {
        return Err(AppError::Validation(
            "Confirmation phrase does not match.".into(),
        ));
    }

    Ok(session.user_id)
}

#[tauri::command]
#[tracing::instrument(level = "warn", skip(app, pool, session_state, _listener, request))]
pub async fn cluster_execute_cluster_reset(
    app: AppHandle,
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    _listener: State<'_, ClusterListenerControl>,
    request: ClusterResetExecuteRequest,
) -> Result<medoc_sync::cluster::services::ClusterResetReport, AppError> {
    let uid = validate_cluster_reset_reauth(
        &pool,
        &session_state,
        &request.password,
        &request.confirm_phrase,
    )
    .await?;
    require_admin_seat(&pool).await?;

    crate::commands::app_lifecycle::stop_network_services(&app).await;

    let mode = medoc_sync::cluster::services::ClusterResetMode::parse(&request.mode)?;
    let app_data_dir = crate::commands::app_data_dir(&app)?;

    let report = medoc_sync::cluster::services::execute_owner_cluster_reset(
        &pool,
        &app_data_dir,
        &uid,
        mode,
    )
    .await?;

    {
        let mut guard = session_state.lock_session();
        *guard = None;
    }

    crate::commands::app_lifecycle::schedule_app_restart(app);

    Ok(report)
}
