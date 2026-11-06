//! Peer replication controls (serverless mode).

use std::time::Duration;

use medoc_sync::cluster::services::{
    refresh_replica_lan_auth, sync_staff_from_stored_admin_endpoint,
};
use medoc_sync::deployment::SyncDeploymentConfig;
use medoc_sync::engine::{SyncEngine, SyncRunReport};
use medoc_sync::repo::SyncStatusSnapshot;
use serde::Deserialize;
use sqlx::SqlitePool;
use tauri::State;

use crate::commands::auth_commands::SessionState;
use crate::commands::rbac_state::{require, require_authenticated};
use crate::error::AppError;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSetDeploymentPayload {
    pub deployment: SyncDeploymentConfig,
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_get_status(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<SyncStatusSnapshot, AppError> {
    require_authenticated(&session_state)?;
    SyncEngine::status(&pool).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_set_deployment(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    payload: SyncSetDeploymentPayload,
) -> Result<(), AppError> {
    require(&session_state, "ops.system")?;
    SyncEngine::set_deployment(&pool, payload.deployment).await
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_run_now(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<SyncRunReport, AppError> {
    require_authenticated(&session_state)?;
    let snap = SyncEngine::status(&pool).await?;
    let is_replica = snap.deployment.mode == medoc_sync::deployment::DeploymentMode::ServerlessPeer
        && snap.deployment.role == medoc_sync::deployment::DeviceRole::Replica;
    if !is_replica {
        require(&session_state, "ops.system")?;
    }
    run_replica_sync_recovering(&pool).await
}

/// Replica topbar: reach the master's LAN HTTPS with the same TLS policy as sync (self-signed OK).
#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_probe_master(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
) -> Result<bool, AppError> {
    require_authenticated(&session_state)?;
    probe_master_reachable(&pool).await
}

pub async fn probe_master_reachable(pool: &SqlitePool) -> Result<bool, AppError> {
    let snap = SyncEngine::status(pool).await?;
    let base = snap.deployment.master_base_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Ok(false);
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(4))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| AppError::Internal(format!("probe http client: {e}")))?;
    for path in ["/health", "/api/v1/ping"] {
        let url = format!("{base}{path}");
        match client.get(&url).send().await {
            Ok(resp) if resp.status().is_success() => return Ok(true),
            _ => {}
        }
    }
    Ok(false)
}

#[tauri::command]
#[tracing::instrument(level = "info", skip(pool, session_state))]
pub async fn sync_record_change(
    pool: State<'_, SqlitePool>,
    session_state: State<'_, SessionState>,
    entity_table: String,
    entity_id: String,
    op: String,
    payload_json: String,
) -> Result<(), AppError> {
    require(&session_state, "ops.system")?;
    let snap = SyncEngine::status(&pool).await?;
    if snap.deployment.mode != medoc_sync::deployment::DeploymentMode::ServerlessPeer {
        return Ok(());
    }
    medoc_sync::repo::append_outbox(
        &pool,
        &snap.local_device_id,
        &entity_table,
        &entity_id,
        &op,
        &payload_json,
    )
    .await?;
    Ok(())
}

/// Queue a local mutation for later push/pull. No-op unless this device is a serverless peer.
pub async fn enqueue_local_sync(
    pool: &SqlitePool,
    entity_table: &str,
    entity_id: &str,
    op: &str,
    payload: &impl serde::Serialize,
) {
    let payload_json = match serde_json::to_string(payload) {
        Ok(s) => s,
        Err(_) => return,
    };
    let _ = medoc_sync::repo::sync_record_or_noop(pool, entity_table, entity_id, op, &payload_json)
        .await;
}

/// Replicas push and pull automatically. The first tick runs immediately.
const REPLICA_SYNC_INTERVAL: Duration = Duration::from_millis(500);
const REPLICA_CATCHUP_KV: &str = "sync.replica.catchup.done.v1";

/// The host loop and the window both call sync. One run at a time.
static REPLICA_SYNC_GATE: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

fn sync_auth_rejected(msg: &str) -> bool {
    let lower = msg.to_ascii_lowercase();
    lower.contains("401") || lower.contains("unauthorized")
}

fn replica_report_needs_auth_refresh(report: &SyncRunReport) -> bool {
    report
        .error
        .as_deref()
        .is_some_and(sync_auth_rejected)
}

fn replica_token_needs_refresh(deployment: &SyncDeploymentConfig) -> bool {
    let token = deployment.activation_token.trim();
    if token.is_empty() {
        return deployment.master_access_token.trim().is_empty();
    }
    if !token.starts_with(medoc_sync::pairing::ACTIVATION_TOKEN_PREFIX) {
        return true;
    }
    let pk = deployment.master_pubkey.trim();
    if pk.is_empty() {
        return false;
    }
    match medoc_sync::master_keys::parse_pubkey_b64(pk) {
        Ok(key) => medoc_sync::pairing::verify_activation_token(token, &key).is_err(),
        Err(_) => true,
    }
}

async fn run_replica_sync_recovering(pool: &SqlitePool) -> Result<SyncRunReport, AppError> {
    let _gate = REPLICA_SYNC_GATE.lock().await;
    let snap = SyncEngine::status(pool).await?;
    if replica_token_needs_refresh(&snap.deployment) {
        if let Err(e) = refresh_replica_lan_auth(pool).await {
            tracing::warn!(
                target: "medoc::sync",
                event = "REPLICA_AUTH_REFRESH_FAILED",
                error = %e
            );
        }
    }
    let first = SyncEngine::run_replica_sync(pool).await?;
    if !replica_report_needs_auth_refresh(&first) {
        return Ok(first);
    }
    tracing::warn!(
        target: "medoc::sync",
        event = "REPLICA_SYNC_401_RETRY",
        error = first.error.as_deref().unwrap_or("")
    );
    match refresh_replica_lan_auth(pool).await {
        Ok(_) => SyncEngine::run_replica_sync(pool).await,
        Err(e) => {
            tracing::warn!(
                target: "medoc::sync",
                event = "REPLICA_AUTH_REFRESH_FAILED",
                error = %e
            );
            Ok(first)
        }
    }
}

async fn run_replica_catchup_recovering(pool: &SqlitePool) -> Result<SyncRunReport, AppError> {
    let _gate = REPLICA_SYNC_GATE.lock().await;
    let snap = SyncEngine::status(pool).await?;
    if replica_token_needs_refresh(&snap.deployment) {
        if let Err(e) = refresh_replica_lan_auth(pool).await {
            tracing::warn!(
                target: "medoc::sync",
                event = "REPLICA_AUTH_REFRESH_FAILED",
                error = %e
            );
        }
    }
    let first = SyncEngine::run_replica_sync_until_caught_up(pool).await?;
    if !replica_report_needs_auth_refresh(&first) {
        return Ok(first);
    }
    tracing::warn!(
        target: "medoc::sync",
        event = "REPLICA_SYNC_401_RETRY",
        error = first.error.as_deref().unwrap_or("")
    );
    match refresh_replica_lan_auth(pool).await {
        Ok(_) => SyncEngine::run_replica_sync_until_caught_up(pool).await,
        Err(e) => {
            tracing::warn!(
                target: "medoc::sync",
                event = "REPLICA_AUTH_REFRESH_FAILED",
                error = %e
            );
            Ok(first)
        }
    }
}

/// Own OS thread: scan shared admin/user rows, queue the ones that changed,
/// and on a replica push that queue to the master immediately.
pub fn spawn_shared_change_sync_thread(pool: SqlitePool) {
    if let Err(e) = std::thread::Builder::new()
        .name("medoc-shared-sync".into())
        .spawn(move || {
            tauri::async_runtime::block_on(async move {
                let mut ticker = tokio::time::interval(REPLICA_SYNC_INTERVAL);
                ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
                loop {
                    ticker.tick().await;
                    let changes = match medoc_sync::watch::queue_shared_changes(&pool).await {
                        Ok(n) => n,
                        Err(e) => {
                            tracing::warn!(
                                target: "medoc::sync",
                                event = "SHARED_SYNC_SCAN_FAILED",
                                error = %e
                            );
                            continue;
                        }
                    };
                    if changes == 0 {
                        continue;
                    }
                    tracing::info!(
                        target: "medoc::sync",
                        event = "SHARED_SYNC_QUEUED",
                        changes
                    );
                    let Ok(snap) = SyncEngine::status(&pool).await else {
                        continue;
                    };
                    let is_replica = snap.deployment.mode
                        == medoc_sync::deployment::DeploymentMode::ServerlessPeer
                        && snap.deployment.role == medoc_sync::deployment::DeviceRole::Replica;
                    if !is_replica {
                        continue;
                    }
                    match run_replica_sync_recovering(&pool).await {
                        Ok(report) => {
                            if let Some(err) = report.error.as_deref() {
                                tracing::warn!(
                                    target: "medoc::sync",
                                    event = "SHARED_SYNC_SEND_DEFERRED",
                                    error = %err
                                );
                            } else {
                                tracing::info!(
                                    target: "medoc::sync",
                                    event = "SHARED_SYNC_SENT",
                                    changes
                                );
                            }
                        }
                        Err(e) => tracing::warn!(
                            target: "medoc::sync",
                            event = "SHARED_SYNC_SEND_FAILED",
                            error = %e
                        ),
                    }
                }
            });
        })
    {
        tracing::warn!(
            target: "medoc::sync",
            event = "SHARED_SYNC_THREAD_FAILED",
            error = %e
        );
    }
}

pub fn spawn_replica_offline_sync_loop(pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        if let Err(e) = medoc_sync::repo::enqueue_calendar_controls(&pool).await {
            tracing::warn!(
                target: "medoc::sync",
                event = "CALENDAR_CONTROLS_ENQUEUE_FAILED",
                error = %e
            );
        }
        let mut ticker = tokio::time::interval(REPLICA_SYNC_INTERVAL);
        ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            ticker.tick().await;
            let Ok(snap) = SyncEngine::status(&pool).await else {
                continue;
            };
            if snap.deployment.mode != medoc_sync::deployment::DeploymentMode::ServerlessPeer
                || snap.deployment.role != medoc_sync::deployment::DeviceRole::Replica
            {
                continue;
            }
            if replica_token_needs_refresh(&snap.deployment)
                || snap.deployment.master_base_url.trim().is_empty()
            {
                match refresh_replica_lan_auth(&pool).await {
                    Ok(_) => {}
                    Err(e) => tracing::warn!(
                        target: "medoc::sync",
                        event = "REPLICA_AUTH_REFRESH_FAILED",
                        error = %e
                    ),
                }
            }
            let Ok(again) = SyncEngine::status(&pool).await else {
                continue;
            };
            let has_url = !again.deployment.master_base_url.trim().is_empty();
            let has_token = !again.deployment.activation_token.trim().is_empty()
                || !again.deployment.master_access_token.trim().is_empty();
            if !has_url || !has_token {
                tracing::warn!(
                    target: "medoc::sync",
                    event = "REPLICA_SYNC_SKIP_NO_CREDENTIALS",
                    has_url,
                    has_token
                );
                continue;
            }
            let _ = sync_staff_from_stored_admin_endpoint(&pool).await;
            let catchup_done = medoc_core::infrastructure::database::app_kv_repo::get(
                &pool,
                REPLICA_CATCHUP_KV,
            )
            .await
            .ok()
            .flatten()
            .as_deref()
                == Some("1");
            let result = if catchup_done {
                run_replica_sync_recovering(&pool).await
            } else {
                run_replica_catchup_recovering(&pool).await
            };
            match result {
                Ok(report) => {
                    if let Some(err) = report.error.as_deref() {
                        tracing::warn!(
                            target: "medoc::sync",
                            event = "REPLICA_SYNC_DEFERRED",
                            error = %err
                        );
                    }
                    if !catchup_done {
                        let pulled = report
                            .pull
                            .as_ref()
                            .map(|p| p.applied.saturating_add(p.skipped))
                            .unwrap_or(0);
                        if pulled < 500 && report.error.is_none() {
                            let _ = medoc_core::infrastructure::database::app_kv_repo::set(
                                &pool,
                                REPLICA_CATCHUP_KV,
                                "1",
                            )
                            .await;
                            tracing::info!(
                                target: "medoc::sync",
                                event = "REPLICA_INITIAL_SYNC_DONE",
                                applied = report.pull.as_ref().map(|p| p.applied).unwrap_or(0)
                            );
                        }
                    }
                }
                Err(e) => tracing::warn!(
                    target: "medoc::sync",
                    event = "REPLICA_SYNC_DEFERRED",
                    error = %e
                ),
            }
        }
    });
}
